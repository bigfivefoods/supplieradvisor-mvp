import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isMigrationPending, MigrationPendingError, readFeatureResult } from './recovergraph-db';

export async function loadAccountsForAgent(input: {
  companyId: number;
  staffId: string;
  limit: number;
  after: string | null;
  afterId: string | null;
  state: string | null;
  search: string | null;
  accountId?: string | null;
}) {
  const supabase = getSupabaseServer();
  const result = await supabase.rpc('recover_accounts_for_agent', {
    p_company_id: input.companyId,
    p_staff_id: input.staffId,
    p_limit: input.limit,
    p_after: input.after,
    p_state: input.state,
    p_after_id: input.afterId,
    p_search: input.search,
    p_account_id: input.accountId || null,
  });
  const pending = readFeatureResult(result.error, 'accounts');
  if (!pending.ready) return pending;
  if (isMigrationPending(result.error)) throw new MigrationPendingError();
  if (result.error) throw new Error('accounts');
  return { ready: true as const, rows: result.data || [] };
}
