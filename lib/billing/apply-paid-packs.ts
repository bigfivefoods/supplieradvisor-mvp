/**
 * Apply paid Industry Packs onto a company profile (metadata + module unlocks).
 * Shared by subscription activate + Paystack webhook.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { MODULE_NAV } from '@/lib/chrome/module-nav';
import {
  enabledModulesMapFromPacks,
  packagingFromSelection,
  packagingMetadataBlob,
  readPackagingFromMetadata,
  getIndustryPack,
} from '@/lib/product/architecture';
import {
  extractEnabledModulesFromMetadata,
  mergeEnabledModulesIntoMetadata,
} from '@/lib/business/company-modules';

export type ApplyPaidPacksResult = {
  ok: boolean;
  packIds: string[];
  paidUntil: string | null;
  error?: string;
};

function parsePackIdsFromMeta(meta: unknown): string[] {
  if (!meta || typeof meta !== 'object') return [];
  const m = meta as Record<string, unknown>;
  // Paystack custom_fields array or flat keys
  if (Array.isArray(m.custom_fields)) {
    for (const f of m.custom_fields as Array<Record<string, unknown>>) {
      const vn = String(f.variable_name || f.display_name || '').toLowerCase();
      if (vn.includes('pack_id') || vn === 'pack_ids') {
        return String(f.value || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
  }
  if (m.pack_ids != null) {
    return String(m.pack_ids)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(m.packIds)) return m.packIds.map(String);
  return [];
}

export function packIdsFromPaystackData(
  data: Record<string, unknown>
): string[] {
  const fromMeta = parsePackIdsFromMeta(data.metadata);
  if (fromMeta.length) return fromMeta.filter((id) => getIndustryPack(id));
  return [];
}

export function productFromPaystackData(
  data: Record<string, unknown>
): string {
  const meta = data.metadata;
  if (meta && typeof meta === 'object') {
    const m = meta as Record<string, unknown>;
    if (m.product != null) return String(m.product).toLowerCase();
    if (Array.isArray(m.custom_fields)) {
      for (const f of m.custom_fields as Array<Record<string, unknown>>) {
        const vn = String(f.variable_name || '').toLowerCase();
        if (vn === 'product') return String(f.value || '').toLowerCase();
      }
    }
  }
  return '';
}

export function companyIdFromPaystackData(
  data: Record<string, unknown>
): number | null {
  const meta = data.metadata;
  if (meta && typeof meta === 'object') {
    const m = meta as Record<string, unknown>;
    if (m.company_id != null && Number.isFinite(Number(m.company_id))) {
      return Number(m.company_id);
    }
    if (Array.isArray(m.custom_fields)) {
      for (const f of m.custom_fields as Array<Record<string, unknown>>) {
        const vn = String(f.variable_name || '').toLowerCase();
        if (vn === 'company_id' || vn === 'companyid') {
          const n = Number(f.value);
          if (Number.isFinite(n)) return n;
        }
      }
    }
  }
  return null;
}

/**
 * Merge pack ids into packaging metadata and enable unlocked hubs.
 */
export async function applyPaidIndustryPacks(
  supabase: SupabaseClient,
  opts: {
    companyId: number;
    packIds: string[];
    paidUntil: string;
    paystackReference?: string | null;
    channel?: string | null;
  }
): Promise<ApplyPaidPacksResult> {
  const packIds = [
    ...new Set(opts.packIds.filter((id) => Boolean(getIndustryPack(id)))),
  ];
  if (!packIds.length) {
    return { ok: false, packIds: [], paidUntil: null, error: 'No valid packs' };
  }

  try {
    const { data: fullProf } = await supabase
      .from('profiles')
      .select('metadata, business_type')
      .eq('id', opts.companyId)
      .maybeSingle();
    if (!fullProf) {
      return { ok: false, packIds, paidUntil: null, error: 'Company not found' };
    }

    const meta =
      fullProf.metadata && typeof fullProf.metadata === 'object'
        ? { ...(fullProf.metadata as Record<string, unknown>) }
        : {};
    const currentPack = readPackagingFromMetadata(meta);
    const nextPackIds = [
      ...new Set([...(currentPack?.packIds || []), ...packIds]),
    ];
    const isSchool =
      String(fullProf.business_type || '') === 'school' ||
      String(fullProf.business_type || '').includes('school') ||
      currentPack?.entityTypeId === 'school';
    const selection = packagingFromSelection({
      entityTypeId:
        currentPack?.entityTypeId ||
        (isSchool ? 'school' : 'private_company'),
      // SchoolAdvisor always uses public-sector government process
      sectorId: isSchool
        ? 'public_sector'
        : currentPack?.sectorId || 'secondary',
      packIds: isSchool
        ? [...new Set([...nextPackIds, 'public_procurement'])]
        : nextPackIds,
      moduleIds: isSchool
        ? [...new Set([...(currentPack?.moduleIds || []), 'schools'])]
        : currentPack?.moduleIds || [],
    });
    Object.assign(meta, packagingMetadataBlob(selection));
    if (opts.paystackReference) {
      meta.industry_packs_last_ref = opts.paystackReference;
    }
    meta.industry_packs_paid_until = opts.paidUntil;
    if (opts.channel) meta.industry_packs_channel = opts.channel;

    const baseEnable = Object.entries(extractEnabledModulesFromMetadata(meta))
      .filter(([, on]) => on)
      .map(([id]) => id);
    const fromPacks = enabledModulesMapFromPacks(
      selection.packIds,
      selection.moduleIds,
      MODULE_NAV.map((m) => m.id),
      { basePresetEnable: baseEnable }
    );
    const merged = { ...extractEnabledModulesFromMetadata(meta) };
    for (const [id, on] of Object.entries(fromPacks)) {
      if (on) merged[id] = true;
    }
    const nextMeta = mergeEnabledModulesIntoMetadata(meta, merged);

    const { error } = await supabase
      .from('profiles')
      .update({
        metadata: nextMeta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opts.companyId);

    if (error) {
      return { ok: false, packIds, paidUntil: opts.paidUntil, error: error.message };
    }

    return {
      ok: true,
      packIds: selection.packIds,
      paidUntil: opts.paidUntil,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      packIds,
      paidUntil: opts.paidUntil,
      error: e instanceof Error ? e.message : 'apply packs failed',
    };
  }
}
