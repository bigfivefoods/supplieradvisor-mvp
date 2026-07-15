import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  normalizeCommissionTiers,
  parseStoredTiers,
  type CommissionTier,
} from '@/lib/sales-contractor/commission';
import { buildPlatformDefaultProgram } from './defaults';
import type {
  ProgramCriterion,
  SalesProgramPatch,
  SalesProgramSettings,
} from './types';

function asCriteria(raw: unknown): ProgramCriterion[] {
  if (!raw) return [];
  let arr: unknown = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item, i) => {
      const o = item as Record<string, unknown>;
      const title = String(o?.title || '').trim();
      const detail = String(o?.detail || '').trim();
      if (!title) return null;
      return {
        key: String(o?.key || `c${i + 1}`).slice(0, 64),
        title: title.slice(0, 200),
        detail: detail.slice(0, 2000),
        required: o?.required !== false,
      } satisfies ProgramCriterion;
    })
    .filter(Boolean) as ProgramCriterion[];
}

/** Strip dangerous tags from company HTML fields. */
export function sanitizeProgramHtml(
  html: string | null | undefined
): string | null {
  if (html == null) return null;
  const s = String(html).trim();
  if (!s) return null;
  return s
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .slice(0, 200_000);
}

export function mapProgramRow(
  row: Record<string, unknown>,
  companyId: number
): SalesProgramSettings {
  const fallback = buildPlatformDefaultProgram(companyId);
  const tiersRaw = row.commission_tiers;
  let tiers: CommissionTier[] = fallback.commission_tiers;
  if (Array.isArray(tiersRaw) && tiersRaw.length) {
    tiers = normalizeCommissionTiers(tiersRaw as CommissionTier[], {
      minPct: Number(row.min_commission_pct ?? 0),
      maxPct: Number(row.max_commission_pct ?? 100),
    });
  } else if (typeof tiersRaw === 'string' && tiersRaw.trim()) {
    tiers = parseStoredTiers(tiersRaw, {
      minPct: Number(row.min_commission_pct ?? 0),
      maxPct: Number(row.max_commission_pct ?? 100),
    });
  }

  const salesCrit = asCriteria(row.sales_criteria);
  const resellerCrit = asCriteria(row.reseller_criteria);

  return {
    id: row.id != null ? Number(row.id) : null,
    profile_id: Number(row.profile_id ?? companyId),
    program_name: String(row.program_name || fallback.program_name),
    program_summary: String(row.program_summary || fallback.program_summary),
    is_enabled: row.is_enabled !== false,
    contract_title: String(row.contract_title || fallback.contract_title),
    contract_version: String(row.contract_version || fallback.contract_version),
    legal_body_html: row.legal_body_html ? String(row.legal_body_html) : null,
    legal_addendum_html: row.legal_addendum_html
      ? String(row.legal_addendum_html)
      : null,
    email_domain: row.email_domain
      ? String(row.email_domain).replace(/^@/, '')
      : null,
    require_re_sign_on_change: row.require_re_sign_on_change !== false,
    commission_model: 'stepped',
    commission_tiers: tiers.length ? tiers : fallback.commission_tiers,
    min_commission_pct: Number(row.min_commission_pct ?? 0),
    max_commission_pct: Number(row.max_commission_pct ?? 100),
    currency: String(row.currency || 'ZAR'),
    example_units:
      row.example_units != null && row.example_units !== ''
        ? Number(row.example_units)
        : fallback.example_units,
    example_unit_price:
      row.example_unit_price != null && row.example_unit_price !== ''
        ? Number(row.example_unit_price)
        : fallback.example_unit_price,
    example_label: row.example_label
      ? String(row.example_label)
      : fallback.example_label,
    sales_criteria: salesCrit.length ? salesCrit : fallback.sales_criteria,
    reseller_criteria: resellerCrit.length
      ? resellerCrit
      : fallback.reseller_criteria,
    eligibility_notes: row.eligibility_notes
      ? String(row.eligibility_notes)
      : null,
    program_info_html: row.program_info_html
      ? String(row.program_info_html)
      : null,
    personal_sales_only: true,
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
    using_defaults: false,
  };
}

/**
 * Load company sales program settings, or platform defaults if missing / table absent.
 */
export async function resolveProgramSettings(
  companyId: number
): Promise<SalesProgramSettings> {
  const fallback = buildPlatformDefaultProgram(companyId);
  if (!Number.isFinite(companyId) || companyId <= 0) return fallback;

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('sales_program_settings')
      .select('*')
      .eq('profile_id', companyId)
      .maybeSingle();

    if (error) {
      if (/relation|does not exist|schema cache/i.test(error.message)) {
        return fallback;
      }
      console.error('resolveProgramSettings:', error.message);
      return fallback;
    }
    if (!data) return fallback;
    return mapProgramRow(data as Record<string, unknown>, companyId);
  } catch (e) {
    console.error('resolveProgramSettings exception:', e);
    return fallback;
  }
}

/**
 * Ensure a DB row exists (seeded from platform defaults), then return it.
 */
export async function getOrCreateSalesProgramSettings(
  companyId: number
): Promise<
  | { ok: true; settings: SalesProgramSettings }
  | { ok: false; error: string; status: number }
> {
  const existing = await resolveProgramSettings(companyId);
  if (existing.id != null) {
    return { ok: true, settings: existing };
  }

  const seed = buildPlatformDefaultProgram(companyId);
  const now = new Date().toISOString();
  const insert = {
    profile_id: companyId,
    program_name: seed.program_name,
    program_summary: seed.program_summary,
    is_enabled: true,
    contract_title: seed.contract_title,
    contract_version: seed.contract_version,
    legal_body_html: null,
    legal_addendum_html: null,
    email_domain: seed.email_domain,
    require_re_sign_on_change: true,
    commission_model: 'stepped',
    commission_tiers: seed.commission_tiers,
    min_commission_pct: seed.min_commission_pct,
    max_commission_pct: seed.max_commission_pct,
    currency: seed.currency,
    example_units: seed.example_units,
    example_unit_price: seed.example_unit_price,
    example_label: seed.example_label,
    sales_criteria: seed.sales_criteria,
    reseller_criteria: seed.reseller_criteria,
    eligibility_notes: null,
    program_info_html: null,
    personal_sales_only: true,
    metadata: {},
    created_at: now,
    updated_at: now,
  };

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('sales_program_settings')
      .upsert(insert, { onConflict: 'profile_id' })
      .select('*')
      .single();

    if (error) {
      if (/relation|does not exist|schema cache/i.test(error.message)) {
        return {
          ok: false,
          error:
            'Sales program settings table missing. Run supabase/migrations/20260715_sales_program_settings.sql',
          status: 503,
        };
      }
      const again = await resolveProgramSettings(companyId);
      if (again.id != null) return { ok: true, settings: again };
      return { ok: false, error: error.message, status: 500 };
    }
    return {
      ok: true,
      settings: mapProgramRow(data as Record<string, unknown>, companyId),
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error creating program settings',
      status: 500,
    };
  }
}

export function validateCommissionTiers(
  tiers: CommissionTier[],
  minPct: number,
  maxPct: number
): { ok: true; tiers: CommissionTier[] } | { ok: false; error: string } {
  if (!Array.isArray(tiers) || tiers.length < 1 || tiers.length > 8) {
    return { ok: false, error: 'Provide 1–8 commission tiers.' };
  }
  const norm = normalizeCommissionTiers(tiers, { minPct, maxPct });
  if (!norm.length) {
    return { ok: false, error: 'Invalid commission tiers.' };
  }
  const last = norm[norm.length - 1];
  if (last.upTo != null) {
    return {
      ok: false,
      error: 'The top tier must have no upper limit (upTo = null / open-ended).',
    };
  }
  for (let i = 0; i < norm.length - 1; i++) {
    if (norm[i].upTo == null) {
      return { ok: false, error: 'Only the last tier may be open-ended.' };
    }
    const next = norm[i + 1].upTo;
    if (next != null && Number(norm[i].upTo) >= Number(next)) {
      return { ok: false, error: 'Tier thresholds must increase.' };
    }
  }
  for (const t of norm) {
    if (t.ratePct < minPct || t.ratePct > maxPct) {
      return {
        ok: false,
        error: `Rates must be between ${minPct}% and ${maxPct}%.`,
      };
    }
  }
  return { ok: true, tiers: norm };
}

export function validateCriteria(
  list: unknown,
  label: string
): { ok: true; criteria: ProgramCriterion[] } | { ok: false; error: string } {
  if (list == null) return { ok: true, criteria: [] };
  if (!Array.isArray(list)) {
    return { ok: false, error: `${label} must be an array.` };
  }
  if (list.length > 20) {
    return { ok: false, error: `${label}: max 20 items.` };
  }
  const criteria = asCriteria(list);
  if (list.length && !criteria.length) {
    return { ok: false, error: `${label}: each item needs a title.` };
  }
  return { ok: true, criteria };
}

/** Snapshot fields frozen onto a contractor agreement at create/sign. */
export function programSnapshotForAgreement(program: SalesProgramSettings) {
  return {
    program_name: program.program_name,
    contract_version: program.contract_version,
    contract_title: program.contract_title,
    commission_tiers: program.commission_tiers,
    min_commission_pct: program.min_commission_pct,
    max_commission_pct: program.max_commission_pct,
    currency: program.currency,
    sales_criteria: program.sales_criteria,
    personal_sales_only: true as const,
    email_domain: program.email_domain,
    example_units: program.example_units,
    example_unit_price: program.example_unit_price,
    example_label: program.example_label,
  };
}

export async function updateSalesProgramSettings(
  companyId: number,
  patch: SalesProgramPatch
): Promise<
  | { ok: true; settings: SalesProgramSettings }
  | { ok: false; error: string; status: number }
> {
  const created = await getOrCreateSalesProgramSettings(companyId);
  if (!created.ok) return created;

  const current = created.settings;
  const minPct =
    patch.min_commission_pct != null
      ? Number(patch.min_commission_pct)
      : current.min_commission_pct;
  const maxPct =
    patch.max_commission_pct != null
      ? Number(patch.max_commission_pct)
      : current.max_commission_pct;

  if (minPct < 0 || maxPct > 100 || minPct > maxPct) {
    return {
      ok: false,
      error: 'min/max commission % must be 0–100 with min ≤ max.',
      status: 400,
    };
  }

  let tiers = current.commission_tiers;
  if (patch.commission_tiers !== undefined) {
    const v = validateCommissionTiers(patch.commission_tiers, minPct, maxPct);
    if (!v.ok) return { ok: false, error: v.error, status: 400 };
    tiers = v.tiers;
  } else {
    const v = validateCommissionTiers(tiers, minPct, maxPct);
    if (v.ok) tiers = v.tiers;
  }

  let sales_criteria = current.sales_criteria;
  if (patch.sales_criteria !== undefined) {
    const v = validateCriteria(patch.sales_criteria, 'Sales criteria');
    if (!v.ok) return { ok: false, error: v.error, status: 400 };
    sales_criteria = v.criteria.length ? v.criteria : current.sales_criteria;
  }

  let reseller_criteria = current.reseller_criteria;
  if (patch.reseller_criteria !== undefined) {
    const v = validateCriteria(patch.reseller_criteria, 'Reseller criteria');
    if (!v.ok) return { ok: false, error: v.error, status: 400 };
    reseller_criteria = v.criteria;
  }

  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    updated_at: now,
    personal_sales_only: true,
    commission_model: 'stepped',
    commission_tiers: tiers,
    min_commission_pct: minPct,
    max_commission_pct: maxPct,
    sales_criteria,
    reseller_criteria,
  };

  if (patch.program_name !== undefined) {
    row.program_name =
      String(patch.program_name || '').slice(0, 200) || current.program_name;
  }
  if (patch.program_summary !== undefined) {
    row.program_summary = String(patch.program_summary || '').slice(0, 2000);
  }
  if (patch.is_enabled !== undefined) row.is_enabled = Boolean(patch.is_enabled);
  if (patch.contract_title !== undefined) {
    row.contract_title =
      String(patch.contract_title || '').slice(0, 300) || current.contract_title;
  }
  if (patch.contract_version !== undefined) {
    row.contract_version =
      String(patch.contract_version || '').slice(0, 80) ||
      current.contract_version;
  }
  if (patch.legal_body_html !== undefined) {
    row.legal_body_html = sanitizeProgramHtml(patch.legal_body_html);
  }
  if (patch.legal_addendum_html !== undefined) {
    row.legal_addendum_html = sanitizeProgramHtml(patch.legal_addendum_html);
  }
  if (patch.email_domain !== undefined) {
    const d = patch.email_domain
      ? String(patch.email_domain).replace(/^@/, '').trim().slice(0, 120)
      : null;
    row.email_domain = d || null;
  }
  if (patch.require_re_sign_on_change !== undefined) {
    row.require_re_sign_on_change = Boolean(patch.require_re_sign_on_change);
  }
  if (patch.currency !== undefined) {
    row.currency = String(patch.currency || 'ZAR').slice(0, 8);
  }
  if (patch.example_units !== undefined) {
    row.example_units =
      patch.example_units == null ? null : Number(patch.example_units);
  }
  if (patch.example_unit_price !== undefined) {
    row.example_unit_price =
      patch.example_unit_price == null
        ? null
        : Number(patch.example_unit_price);
  }
  if (patch.example_label !== undefined) {
    row.example_label = patch.example_label
      ? String(patch.example_label).slice(0, 120)
      : null;
  }
  if (patch.eligibility_notes !== undefined) {
    row.eligibility_notes = patch.eligibility_notes
      ? String(patch.eligibility_notes).slice(0, 5000)
      : null;
  }
  if (patch.program_info_html !== undefined) {
    row.program_info_html = sanitizeProgramHtml(patch.program_info_html);
  }
  if (patch.metadata !== undefined && typeof patch.metadata === 'object') {
    row.metadata = { ...current.metadata, ...patch.metadata };
  }

  const materialChange =
    patch.commission_tiers !== undefined ||
    patch.legal_body_html !== undefined ||
    patch.legal_addendum_html !== undefined ||
    patch.sales_criteria !== undefined ||
    patch.contract_title !== undefined;
  if (
    materialChange &&
    current.require_re_sign_on_change &&
    patch.contract_version === undefined
  ) {
    const base = String(
      row.contract_version || current.contract_version
    ).replace(/\.co-\d+(-\d+)?$/i, '');
    const n = (Number(current.metadata?.version_seq) || 0) + 1;
    row.contract_version = `${base}.co-${companyId}-${n}`;
    row.metadata = {
      ...(typeof row.metadata === 'object' && row.metadata
        ? (row.metadata as object)
        : current.metadata),
      version_seq: n,
      last_material_change_at: now,
    };
  }

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('sales_program_settings')
      .update(row)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) {
      return { ok: false, error: error.message, status: 500 };
    }
    return {
      ok: true,
      settings: mapProgramRow(data as Record<string, unknown>, companyId),
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Update failed',
      status: 500,
    };
  }
}

export function tiersRatesSummary(tiers: CommissionTier[]): string {
  return tiers.map((t) => `${t.ratePct}%`).join(' · ');
}
