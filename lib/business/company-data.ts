/**
 * Company chrome + per-module Advisor stores.
 *
 * Dashboard boot used to SELECT the entire profiles.metadata blob (gym
 * diaries, clinic charts, movement libraries, …) just to paint the sidebar.
 * Writes read that blob, patched one key, and wrote it all back — two
 * Advisors saving at once could overwrite each other.
 *
 * This layer:
 * - reads only chrome keys (or company_workspace) for membership
 * - reads / writes one module at a time
 * - writes token indexes only — never the full gym/clinic blob — to metadata
 * - requires the service role; module RPCs are allowlisted
 */

import {
  getSupabaseServer,
  hasServiceRole,
} from '@/lib/supabase/server-client';

export const COMPANY_CHROME_META_KEYS = [
  'enabled_modules',
  'user_sidebar_orders',
  'os_entity_type',
  'os_sector',
  'os_industry',
  'os_industries',
  'os_business_type_id',
  'os_business_type_ids',
  'industry_packs',
  'industry_modules',
  'setup_status',
  'setup_path',
] as const;

export type CompanyChromeMeta = Record<string, unknown>;

/** Overlay chrome layers: later objects win on the same key, missing keys keep earlier values. */
export function mergeCompanyChromeLayers(
  ...layers: Array<Record<string, unknown> | null | undefined>
): CompanyChromeMeta {
  const out: CompanyChromeMeta = {};
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) continue;
    Object.assign(out, layer);
  }
  return out;
}

export const ADVISOR_MODULE_KEYS = [
  'fitgraph',
  'physiograph',
  'medicalgraph',
  'psychiatrygraph',
  'dentalgraph',
  'hiregraph',
  'retailgraph',
  'fieldgraph',
  'quarrygraph',
] as const;

export type AdvisorModuleKey = (typeof ADVISOR_MODULE_KEYS)[number];

export const ADVISOR_TOKEN_INDEX_KEYS = [
  'fitgraph_public_token',
  'fitgraph_coach_tokens',
  'fitgraph_client_tokens',
  'physiograph_patient_tokens',
  'physiograph_staff_tokens',
  'medicalgraph_patient_tokens',
  'medicalgraph_staff_tokens',
  'psychiatrygraph_patient_tokens',
  'psychiatrygraph_staff_tokens',
  'dentalgraph_patient_tokens',
  'dentalgraph_staff_tokens',
  'hiregraph_customer_tokens',
  'hiregraph_public_token',
  'retailgraph_public_token',
] as const;

export type AdvisorTokenIndexKey = (typeof ADVISOR_TOKEN_INDEX_KEYS)[number];

export function isAdvisorModuleKey(key: string): key is AdvisorModuleKey {
  return (ADVISOR_MODULE_KEYS as readonly string[]).includes(key);
}

export function isAdvisorTokenIndexKey(
  key: string
): key is AdvisorTokenIndexKey {
  return (ADVISOR_TOKEN_INDEX_KEYS as readonly string[]).includes(key);
}

/** Metadata indexes: `{module}_public_token` and `{module}_*_tokens` only. */
export function isModuleIndexKey(moduleKey: string, key: string): boolean {
  if (!key || key === moduleKey) return false;
  if (!key.startsWith(`${moduleKey}_`)) return false;
  return key.endsWith('_token') || key.endsWith('_tokens');
}

export function isMissingRelation(error: unknown): boolean {
  const msg =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: string }).message || '')
      : String(error || '');
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code || '')
      : '';
  return (
    code === '42P01' ||
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    /relation|schema cache|does not exist|could not find the function/i.test(msg)
  );
}

function asObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

/** Pull index keys (token maps) out of a writeXToMetadata({}, store) slice. */
export function splitModuleWriteSlice(
  moduleKey: string,
  slice: Record<string, unknown>
): { data: unknown; indexes: Record<string, unknown>; publicToken: string | null } {
  const data = slice[moduleKey];
  const indexes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(slice)) {
    if (!isModuleIndexKey(moduleKey, k)) continue;
    indexes[k] = v;
  }
  const tokenRaw =
    indexes[`${moduleKey}_public_token`] ??
    (data && typeof data === 'object' && !Array.isArray(data)
      ? (data as { settings?: { public_token?: unknown } }).settings
          ?.public_token
      : null);
  const publicToken =
    tokenRaw != null && String(tokenRaw).trim() ? String(tokenRaw).trim() : null;
  return { data: data ?? {}, indexes, publicToken };
}

export async function loadCompanyChrome(
  companyId: number
): Promise<CompanyChromeMeta> {
  const supabase = getSupabaseServer();
  const chromeKeys = [...COMPANY_CHROME_META_KEYS];

  // Workspace chrome is a subset (e.g. only sidenav order). Never use it
  // instead of profile keys — that drops enabled_modules and hides Advisors.
  const [rpc, ws, keyed] = await Promise.all([
    supabase.rpc('sa_get_company_chrome', { p_company_id: companyId }),
    supabase
      .from('company_workspace')
      .select('chrome')
      .eq('company_id', companyId)
      .maybeSingle(),
    supabase.rpc('sa_get_profile_metadata_keys', {
      p_company_id: companyId,
      p_keys: chromeKeys,
    }),
  ]);

  if (rpc.error && !isMissingRelation(rpc.error)) {
    console.warn('loadCompanyChrome rpc', rpc.error.message);
  }

  const fromRpc =
    !rpc.error && rpc.data && typeof rpc.data === 'object'
      ? asObject(rpc.data)
      : {};
  const fromWs =
    !ws.error && ws.data?.chrome && typeof ws.data.chrome === 'object'
      ? asObject(ws.data.chrome)
      : {};
  const fromKeys =
    !keyed.error && keyed.data && typeof keyed.data === 'object'
      ? asObject(keyed.data)
      : {};

  let merged = mergeCompanyChromeLayers(fromKeys, fromRpc, fromWs);

  if (!('enabled_modules' in merged) && !('industry_packs' in merged)) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', companyId)
      .maybeSingle();
    const meta = asObject(prof?.metadata);
    const fromMeta: CompanyChromeMeta = {};
    for (const k of chromeKeys) {
      if (k in meta) fromMeta[k] = meta[k];
    }
    merged = mergeCompanyChromeLayers(fromMeta, merged);
  }

  return merged;
}

export async function loadCompanyProfileChrome(companyId: number): Promise<{
  chrome: CompanyChromeMeta;
  businessType: string | null;
  logoUrl: string | null;
  companyName: string | null;
}> {
  const supabase = getSupabaseServer();
  const [chrome, prof] = await Promise.all([
    loadCompanyChrome(companyId),
    supabase
      .from('profiles')
      .select('business_type, logo_url, trading_name, legal_name')
      .eq('id', companyId)
      .maybeSingle(),
  ]);
  const row = prof.data;
  return {
    chrome,
    businessType: row?.business_type != null ? String(row.business_type) : null,
    logoUrl: String(row?.logo_url || '').trim() || null,
    companyName:
      String(row?.trading_name || row?.legal_name || '').trim() || null,
  };
}

export async function putCompanyChrome(
  companyId: number,
  patch: CompanyChromeMeta
): Promise<void> {
  const supabase = getSupabaseServer();
  const rpc = await supabase.rpc('sa_put_company_chrome', {
    p_company_id: companyId,
    p_chrome: patch,
  });
  if (!rpc.error) return;
  if (!isMissingRelation(rpc.error)) {
    throw new Error(rpc.error.message);
  }
  await mergeProfileMetadata(companyId, patch);
}

export async function mergeProfileMetadata(
  companyId: number,
  patch: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseServer();
  const rpc = await supabase.rpc('sa_merge_profile_metadata', {
    p_company_id: companyId,
    p_patch: patch,
  });
  if (!rpc.error) return;
  if (!isMissingRelation(rpc.error)) {
    throw new Error(rpc.error.message);
  }
  const { data: prof, error } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', companyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const prev = asObject(prof?.metadata);
  const { error: upErr } = await supabase
    .from('profiles')
    .update({
      metadata: { ...prev, ...patch },
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId);
  if (upErr) throw new Error(upErr.message);
}

export async function loadModuleMeta(
  companyId: number,
  moduleKey: string,
  extraKeys: string[] = []
): Promise<Record<string, unknown>> {
  if (!isAdvisorModuleKey(moduleKey)) {
    throw new Error('unknown advisor module');
  }
  const supabase = getSupabaseServer();
  const wanted = [moduleKey, ...extraKeys];

  const rpc = await supabase.rpc('sa_get_module_store', {
    p_company_id: companyId,
    p_module: moduleKey,
  });
  if (!rpc.error && rpc.data && typeof rpc.data === 'object') {
    const base = asObject(rpc.data);
    if (extraKeys.length) {
      const extra = await supabase.rpc('sa_get_profile_metadata_keys', {
        p_company_id: companyId,
        p_keys: extraKeys,
      });
      if (!extra.error && extra.data && typeof extra.data === 'object') {
        return { ...asObject(extra.data), ...base };
      }
    }
    return base;
  }

  const row = await supabase
    .from('company_module_stores')
    .select('data')
    .eq('company_id', companyId)
    .eq('module', moduleKey)
    .maybeSingle();
  if (!row.error && row.data?.data) {
    return { [moduleKey]: row.data.data };
  }

  const keys = await supabase.rpc('sa_get_profile_metadata_keys', {
    p_company_id: companyId,
    p_keys: wanted,
  });
  if (!keys.error && keys.data && typeof keys.data === 'object') {
    return asObject(keys.data);
  }

  const { data: prof, error } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', companyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const meta = asObject(prof?.metadata);
  const out: Record<string, unknown> = {};
  for (const k of wanted) {
    if (k in meta) out[k] = meta[k];
  }
  return out;
}

async function tryEnsureSystemSchema(): Promise<boolean> {
  const supabase = getSupabaseServer();
  const rpc = await supabase.rpc('sa_ensure_system_schema');
  return !rpc.error;
}

export async function saveModuleSlice(
  companyId: number,
  moduleKey: string,
  slice: Record<string, unknown>
): Promise<void> {
  if (!isAdvisorModuleKey(moduleKey)) {
    throw new Error('unknown advisor module');
  }
  if (!hasServiceRole()) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY required to save advisor stores'
    );
  }
  const { data, indexes, publicToken } = splitModuleWriteSlice(moduleKey, slice);
  const supabase = getSupabaseServer();
  const args = {
    p_company_id: companyId,
    p_module: moduleKey,
    p_data: data ?? {},
    p_indexes: indexes,
    p_public_token: publicToken,
  };
  let rpc = await supabase.rpc('sa_put_module_store', args);
  if (rpc.error && isMissingRelation(rpc.error)) {
    await tryEnsureSystemSchema();
    rpc = await supabase.rpc('sa_put_module_store', args);
  }
  if (!rpc.error) return;
  throw new Error(
    isMissingRelation(rpc.error)
      ? `${rpc.error.message}. Run supabase/migrations/20260820_ensure_system_schema.sql in the Supabase SQL editor.`
      : rpc.error.message
  );
}

export async function loadAdvisorModuleStore<T>(
  companyId: number,
  moduleKey: string,
  read: (meta: Record<string, unknown>) => T,
  extraKeys: string[] = []
): Promise<{ meta: Record<string, unknown>; store: T }> {
  const meta = await loadModuleMeta(companyId, moduleKey, extraKeys);
  return { meta, store: read(meta) };
}

export async function saveAdvisorModuleStore<T>(
  companyId: number,
  moduleKey: string,
  store: T,
  write: (meta: Record<string, unknown>, store: T) => Record<string, unknown>
): Promise<void> {
  const slice = write({}, store);
  await saveModuleSlice(companyId, moduleKey, slice);
}
