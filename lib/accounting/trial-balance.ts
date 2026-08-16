/**
 * Trial balance integrity — total debits must equal total credits for posted journals.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { round2 } from '@/lib/accounting/server';
import {
  fetchJournalLinesByEntryIds,
  fetchPostedJournalIds,
} from '@/lib/accounting/journal-query';

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

  const { ids, warning: idWarn } = await fetchPostedJournalIds({
    profileId: params.profileId,
    from: params.from,
    to: params.to,
  });
  if (idWarn && !ids.length) {
    return {
      ok: false,
      balanced: false,
      total_debit: 0,
      total_credit: 0,
      difference: 0,
      rows: [],
      entry_count: 0,
      warning: idWarn,
    };
  }
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

  const { lines: rawLines, warning: lErr } = await fetchJournalLinesByEntryIds(
    ids,
    'account_id, debit, credit'
  );

  if (lErr) {
    return {
      ok: false,
      balanced: false,
      total_debit: 0,
      total_credit: 0,
      difference: 0,
      rows: [],
      entry_count: ids.length,
      warning: lErr,
    };
  }
  const lines = rawLines;

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
    warning: idWarn,
  };
}
