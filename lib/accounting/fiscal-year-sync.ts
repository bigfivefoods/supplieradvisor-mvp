/**
 * Company → Settings is the only writer of fiscal year start.
 * The ledger copies the month so budgets / AFS / period slicers stay fast.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { normalizeFyStartMonth } from '@/lib/accounting/fiscal';

export async function readCompanyFiscalYearStart(
  profileId: number
): Promise<number | null> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('profiles')
    .select('settings')
    .eq('id', profileId)
    .maybeSingle();
  const raw = data?.settings;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const n = Number((raw as Record<string, unknown>).fiscalYearStartMonth);
  if (!Number.isFinite(n) || n < 1 || n > 12) return null;
  return Math.round(n);
}

export async function applyCompanyFiscalYearToLedger(
  profileId: number,
  month: number
): Promise<void> {
  const sm = normalizeFyStartMonth(month);
  const now = new Date().toISOString();
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('accounting_settings')
    .update({ fiscal_year_start_month: sm, updated_at: now })
    .eq('profile_id', profileId)
    .select('id')
    .maybeSingle();
  if (!error && data?.id) return;
  await supabase.from('accounting_settings').upsert(
    {
      profile_id: profileId,
      fiscal_year_start_month: sm,
      base_currency: 'ZAR',
      default_tax_rate: 15,
      updated_at: now,
    },
    { onConflict: 'profile_id' }
  );
}


