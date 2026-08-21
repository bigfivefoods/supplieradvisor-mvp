/**
 * Trial balance integrity — total debits must equal total credits for posted journals.
 */
import { round2 } from '@/lib/accounting/server';
import { fetchAccountTotals } from '@/lib/accounting/account-totals';

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
  const totals = await fetchAccountTotals({
    profileId: params.profileId,
    from: params.from,
    to: params.to,
  });
  if (!totals.ok && !totals.rows.length) {
    return {
      ok: false,
      balanced: false,
      total_debit: 0,
      total_credit: 0,
      difference: 0,
      rows: [],
      entry_count: 0,
      from: params.from,
      to: params.to,
      warning: totals.warning,
    };
  }

  const difference = round2(totals.total_debit - totals.total_credit);
  const rows: TrialBalanceRow[] = totals.rows
    .map((r) => ({
      account_id: r.account_id,
      code: r.code,
      name: r.name,
      account_type: r.account_type,
      debit: r.debit,
      credit: r.credit,
      balance: round2(r.debit - r.credit),
    }))
    .sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));

  return {
    ok: true,
    balanced: Math.abs(difference) < 0.005,
    total_debit: totals.total_debit,
    total_credit: totals.total_credit,
    difference,
    rows,
    entry_count: totals.entry_count,
    from: params.from,
    to: params.to,
    warning: totals.warning,
  };
}
