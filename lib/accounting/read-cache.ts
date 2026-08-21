/**
 * Short in-process cache for CoA + accounting_settings (read-mostly).
 */
import { ttlDel, ttlGet, ttlSet } from '@/lib/system/memory-ttl';
import { getOrCreateSettings } from '@/lib/accounting/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import type { AccountingSettings, CoaAccount } from '@/lib/accounting/types';

const SETTINGS_TTL_MS = 60_000;
const COA_TTL_MS = 60_000;

const settingsKey = (companyId: number) => `acct-settings:${companyId}`;
const coaKey = (companyId: number) => `acct-coa:${companyId}`;

export function invalidateAccountingReads(companyId: number): void {
  if (!Number.isFinite(companyId) || companyId <= 0) return;
  ttlDel(settingsKey(companyId));
  ttlDel(coaKey(companyId));
}

export async function getCachedSettings(
  companyId: number
): Promise<AccountingSettings> {
  const hit = ttlGet<AccountingSettings>(settingsKey(companyId));
  if (hit) return hit;
  const settings = await getOrCreateSettings(companyId);
  ttlSet(settingsKey(companyId), settings, SETTINGS_TTL_MS);
  return settings;
}

export async function getCachedCoa(companyId: number): Promise<CoaAccount[]> {
  const hit = ttlGet<CoaAccount[]>(coaKey(companyId));
  if (hit) return hit;
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select(
      'id, profile_id, code, name, account_type, subtype, parent_id, is_active, is_header, is_system, tax_code, normal_balance, description, sort_order, entity_id'
    )
    .eq('profile_id', companyId)
    .order('code');
  if (error) return [];
  const rows = (data || []) as CoaAccount[];
  ttlSet(coaKey(companyId), rows, COA_TTL_MS);
  return rows;
}
