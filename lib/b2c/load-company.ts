/**
 * Load a company for SA Member wallet link.
 * profiles has trading_name / legal_name — not company_name.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

export type WalletCompany = {
  id: number;
  name: string;
  meta: Record<string, unknown>;
};

const SELECT_SAFE =
  'id, trading_name, legal_name, metadata';

export async function loadWalletCompany(
  companyId: number
): Promise<WalletCompany | null> {
  if (!Number.isFinite(companyId) || companyId <= 0) return null;
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .select(SELECT_SAFE)
    .eq('id', companyId)
    .maybeSingle();
  if (error) {
    console.warn('loadWalletCompany', companyId, error.message);
    return null;
  }
  if (!data) return null;
  const meta =
    data.metadata && typeof data.metadata === 'object'
      ? { ...(data.metadata as Record<string, unknown>) }
      : {};
  const name = String(
    data.trading_name || data.legal_name || `Company #${data.id}`
  ).trim();
  return {
    id: Number(data.id),
    name: name || `Company #${data.id}`,
    meta,
  };
}

export async function saveWalletCompanyMeta(
  companyId: number,
  meta: Record<string, unknown>
) {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('profiles')
    .update({ metadata: meta, updated_at: new Date().toISOString() })
    .eq('id', companyId);
  if (error) throw new Error(error.message);
}
