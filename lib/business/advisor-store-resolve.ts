/**
 * Public/member/coach token → company id without scanning profiles.metadata.
 * Gym/clinic blobs live in company_module_stores; metadata only holds token indexes.
 */
import {
  isAdvisorModuleKey,
  isAdvisorTokenIndexKey,
  loadAdvisorModuleStore,
  type AdvisorModuleKey,
} from '@/lib/business/company-data';
import { getSupabaseServer } from '@/lib/supabase/server-client';

const MIN_TOKEN_LEN = 8;

export async function resolveAdvisorCompanyId(opts: {
  token: string;
  moduleKey: AdvisorModuleKey;
  parseCompanyId?: (token: string) => number | null;
  indexKeys?: string[];
}): Promise<number | null> {
  const clean = String(opts.token || '').trim();
  if (clean.length < MIN_TOKEN_LEN) return null;
  if (!isAdvisorModuleKey(opts.moduleKey)) return null;

  const parsed = opts.parseCompanyId?.(clean);
  if (parsed != null && Number.isFinite(parsed) && parsed > 0) return parsed;

  const supabase = getSupabaseServer();
  const byStore = await supabase
    .from('company_module_stores')
    .select('company_id')
    .eq('module', opts.moduleKey)
    .eq('public_token', clean)
    .maybeSingle();
  if (!byStore.error && byStore.data?.company_id) {
    const id = Number(byStore.data.company_id);
    if (Number.isFinite(id) && id > 0) return id;
  }

  for (const key of opts.indexKeys || []) {
    if (!isAdvisorTokenIndexKey(key)) continue;
    const rpc = await supabase.rpc('sa_find_company_by_token_index', {
      p_index_key: key,
      p_token: clean,
    });
    if (!rpc.error && rpc.data != null) {
      const id = Number(rpc.data);
      if (Number.isFinite(id) && id > 0) return id;
    }
    if (key.endsWith('_tokens')) continue;
    const row = await supabase
      .from('profiles')
      .select('id')
      .eq(`metadata->>${key}`, clean)
      .maybeSingle();
    if (!row.error && row.data?.id) {
      const id = Number(row.data.id);
      if (Number.isFinite(id) && id > 0) return id;
    }
  }

  return null;
}

export async function loadAdvisorStoreForPublicToken<T>(opts: {
  token: string;
  moduleKey: AdvisorModuleKey;
  read: (meta: Record<string, unknown>) => T;
  parseCompanyId?: (token: string) => number | null;
  indexKeys?: string[];
}): Promise<{
  companyId: number;
  meta: Record<string, unknown>;
  store: T;
} | null> {
  const companyId = await resolveAdvisorCompanyId(opts);
  if (companyId == null) return null;
  const loaded = await loadAdvisorModuleStore(
    companyId,
    opts.moduleKey,
    opts.read
  );
  return { companyId, meta: loaded.meta, store: loaded.store };
}
