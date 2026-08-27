/**
 * Load a company for SA Member wallet link.
 * Advisor gym/clinic blobs live in company_module_stores — overlay them on
 * read, and never write those blobs back into profiles.metadata.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  ADVISOR_MODULE_KEYS,
  COMPANY_CHROME_META_KEYS,
  isAdvisorModuleKey,
  isMissingRelation,
  isModuleIndexKey,
  mergeProfileMetadata,
  saveModuleSlice,
  type AdvisorModuleKey,
} from '@/lib/business/company-data';

const WALLET_SAVE_SKIP = new Set<string>([
  ...COMPANY_CHROME_META_KEYS,
  'billing_ledger',
  'industry_packs_paid_until',
]);

export type WalletCompany = {
  id: number;
  name: string;
  meta: Record<string, unknown>;
  logoUrl?: string | null;
};

const SELECT_SAFE =
  'id, trading_name, legal_name, logo_url, metadata';

export function overlayAdvisorStores(
  meta: Record<string, unknown>,
  rows: Array<{ module?: unknown; data?: unknown } | null | undefined>
): Record<string, unknown> {
  const out = { ...meta };
  for (const row of rows) {
    const key = String(row?.module || '');
    if (!isAdvisorModuleKey(key)) continue;
    if (row?.data && typeof row.data === 'object' && !Array.isArray(row.data)) {
      out[key] = row.data;
    }
  }
  return out;
}

export function splitWalletMetaForSave(meta: Record<string, unknown>): {
  modules: Array<{ key: AdvisorModuleKey; slice: Record<string, unknown> }>;
  patch: Record<string, unknown>;
} {
  const patch: Record<string, unknown> = { ...meta };
  const modules: Array<{
    key: AdvisorModuleKey;
    slice: Record<string, unknown>;
  }> = [];
  for (const key of ADVISOR_MODULE_KEYS) {
    if (!(key in patch)) continue;
    const data = patch[key];
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const slice: Record<string, unknown> = { [key]: data };
      for (const [k, v] of Object.entries(patch)) {
        if (isModuleIndexKey(key, k)) slice[k] = v;
      }
      modules.push({ key, slice });
    }
    delete patch[key];
    for (const k of Object.keys(patch)) {
      if (isModuleIndexKey(key, k)) delete patch[k];
    }
  }
  return { modules, patch };
}

export async function loadWalletCompany(
  companyId: number
): Promise<WalletCompany | null> {
  if (!Number.isFinite(companyId) || companyId <= 0) return null;
  const supabase = getSupabaseServer();
  const [prof, stores] = await Promise.all([
    supabase
      .from('profiles')
      .select(SELECT_SAFE)
      .eq('id', companyId)
      .maybeSingle(),
    supabase
      .from('company_module_stores')
      .select('module, data')
      .eq('company_id', companyId),
  ]);
  if (prof.error) {
    console.warn('loadWalletCompany', companyId, prof.error.message);
    return null;
  }
  if (!prof.data) return null;
  let meta =
    prof.data.metadata && typeof prof.data.metadata === 'object'
      ? { ...(prof.data.metadata as Record<string, unknown>) }
      : {};
  if (!stores.error) {
    meta = overlayAdvisorStores(meta, stores.data || []);
  } else if (!isMissingRelation(stores.error)) {
    console.warn('loadWalletCompany stores', companyId, stores.error.message);
  }
  const name = String(
    prof.data.trading_name || prof.data.legal_name || `Company #${prof.data.id}`
  ).trim();
  const logoUrl = String(prof.data.logo_url || '').trim() || null;
  return {
    id: Number(prof.data.id),
    name: name || `Company #${prof.data.id}`,
    meta,
    logoUrl,
  };
}

export async function saveWalletCompanyMeta(
  companyId: number,
  meta: Record<string, unknown>
) {
  const { modules, patch } = splitWalletMetaForSave(meta);
  const leftover: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (WALLET_SAVE_SKIP.has(k)) continue;
    leftover[k] = v;
  }
  await Promise.all([
    ...modules.map(async (m) => {
      if (m.key === 'fitgraph') {
        const { readFitgraphFromMetadata } = await import(
          '@/lib/fitness/fitgraph'
        );
        const { saveFitgraphMerged } = await import(
          '@/lib/fitness/fitgraph-io'
        );
        await saveFitgraphMerged(
          companyId,
          readFitgraphFromMetadata(m.slice)
        );
        return;
      }
      await saveModuleSlice(companyId, m.key, m.slice);
    }),
    Object.keys(leftover).length
      ? mergeProfileMetadata(companyId, leftover)
      : Promise.resolve(),
  ]);
}
