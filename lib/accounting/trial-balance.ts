/**
 * Trial balance integrity — total debits must equal total credits for posted journals.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { round2 } from '@/lib/accounting/server';

export type TrialBalanceRow = {
  account_id: number;
  code?: string | null;
  name?: string | null;
  account_type?: string | null;
  debit: number;
  credit: number;
  balance: number;
};

export type TrialBalanceResult = {
  ok: boolean;
  balanced: boolean;
  total_debit: number;
  total_credit: number;
  difference: number;
  rows: TrialBalanceRow[];
  entry_count: number;
  as_of?: string | null;
  from?: string | null;
  to?: string | null;
  warning?: string;
};

export async function computeTrialBalance(params: {
  profileId: number;
  from?: string | null;
  to?: string | null;
}): Promise<TrialBalanceResult> {
  const supabase = getSupabaseServer();

  let q = supabase
    .from('journal_entries')
    .select('id, entry_date, status')
    .eq('profile_id', params.profileId)
    .eq('status', 'posted');

  if (params.from) q = q.gte('entry_date', params.from);
  if (params.to) q = q.lte('entry_date', params.to);

  const { data: entries, error: eErr } = await q.limit(5000);
  if (eErr) {
    return {
      ok: false,
      balanced: false,
      total_debit: 0,
      total_credit: 0,
      difference: 0,
      rows: [],
      entry_count: 0,
      warning: eErr.message,
    };
  }

  const ids = (entries || []).map((e) => e.id);
  if (!ids.length) {
    return {
      ok: true,
      balanced: true,
      total_debit: 0,
      total_credit: 0,
      difference: 0,
      rows: [],
      entry_count: 0,
      from: params.from,
      to: params.to,
    };
  }

  const { data: lines, error: lErr } = await supabase
    .from('journal_lines')
    .select('account_id, debit, credit')
    .in('journal_entry_id', ids);

  if (lErr) {
    return {
      ok: false,
      balanced: false,
      total_debit: 0,
      total_credit: 0,
      difference: 0,
      rows: [],
      entry_count: ids.length,
      warning: lErr.message,
    };
  }

  const byAcct = new Map<number, { debit: number; credit: number }>();
  let totalDebit = 0;
  let totalCredit = 0;

  for (const l of lines || []) {
    const aid = Number(l.account_id);
    if (!Number.isFinite(aid)) continue;
    const d = Number(l.debit || 0);
    const c = Number(l.credit || 0);
    totalDebit += d;
    totalCredit += c;
    const cur = byAcct.get(aid) || { debit: 0, credit: 0 };
    cur.debit += d;
    cur.credit += c;
    byAcct.set(aid, cur);
  }

  totalDebit = round2(totalDebit);
  totalCredit = round2(totalCredit);
  const difference = round2(totalDebit - totalCredit);
  const balanced = Math.abs(difference) < 0.005;

  const accountIds = [...byAcct.keys()];
  let aMap: Record<number, { code?: string; name?: string; account_type?: string }> = {};
  if (accountIds.length) {
    const { data: accounts } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, account_type')
      .in('id', accountIds);
    for (const a of accounts || []) {
      aMap[a.id] = a;
    }
  }

  const rows: TrialBalanceRow[] = [...byAcct.entries()]
    .map(([account_id, v]) => {
      const debit = round2(v.debit);
      const credit = round2(v.credit);
      return {
        account_id,
        code: aMap[account_id]?.code,
        name: aMap[account_id]?.name,
        account_type: aMap[account_id]?.account_type,
        debit,
        credit,
        balance: round2(debit - credit),
      };
    })
    .sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));

  return {
    ok: true,
    balanced,
    total_debit: totalDebit,
    total_credit: totalCredit,
    difference,
    rows,
    entry_count: ids.length,
    from: params.from,
    to: params.to,
  };
}
