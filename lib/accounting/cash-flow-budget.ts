/**
 * Overlay the annual P&L budget onto an IAS 7 operating cash view.
 * This is a plan proxy (revenue ≈ receipts, expenses ≈ payments), not a
 * separate cash-flow budget. IAS 7 does not require a budget.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getOrCreateSettings, round2 } from '@/lib/accounting/server';
import {
  dateToBudgetPeriod,
  fiscalYearsInDateRange,
  monthKey,
} from '@/lib/accounting/budget';
import { monthsInRange } from '@/lib/accounting/cash-flow-ias7';
import type { CashFlowBudget } from '@/lib/accounting/statement-types';

export type BudgetPlanRow = {
  account_id: number;
  account_type: string;
  fiscal_year: number;
  months: Record<string, number>;
};

export function planOperatingCashFromBudgetRows(opts: {
  rows: BudgetPlanRow[];
  from: string;
  to: string;
  fyStartMonth: number;
}): CashFlowBudget {
  const months = monthsInRange(opts.from, opts.to);
  const byMonth = months.map((month) => {
    const d = `${month}-01`;
    const { fiscalYear, period } = dateToBudgetPeriod(d, opts.fyStartMonth);
    const mk = monthKey(period);
    let inflow = 0;
    let outflow = 0;
    for (const row of opts.rows) {
      if (row.fiscal_year !== fiscalYear) continue;
      const amt = Number(row.months[mk] || 0);
      if (!(amt > 0)) continue;
      const t = String(row.account_type || '').toLowerCase();
      if (t === 'revenue') inflow += amt;
      else if (t === 'expense' || t === 'cogs') outflow += amt;
    }
    inflow = round2(inflow);
    outflow = round2(outflow);
    return { month, inflow, outflow, net: round2(inflow - outflow) };
  });
  const operatingInflow = round2(byMonth.reduce((s, m) => s + m.inflow, 0));
  const operatingOutflow = round2(byMonth.reduce((s, m) => s + m.outflow, 0));
  const netOperating = round2(operatingInflow - operatingOutflow);
  const set = operatingInflow > 0.005 || operatingOutflow > 0.005;
  return {
    set,
    note: set
      ? 'Annual P&L budget mapped to this period as an operating cash plan (revenue ≈ receipts, costs ≈ payments). Timing of collections and payments can differ from recognition (IFRS 15 / IAS 7).'
      : 'No annual budget amounts in this period.',
    operatingInflow,
    operatingOutflow,
    netOperating,
    months: byMonth,
  };
}

export async function buildCashFlowBudget(opts: {
  profileId: number;
  from: string;
  to: string;
}): Promise<CashFlowBudget> {
  const empty: CashFlowBudget = {
    set: false,
    note: 'No annual budget amounts in this period.',
    operatingInflow: 0,
    operatingOutflow: 0,
    netOperating: 0,
    months: monthsInRange(opts.from, opts.to).map((month) => ({
      month,
      inflow: 0,
      outflow: 0,
      net: 0,
    })),
  };
  try {
    const settings = await getOrCreateSettings(opts.profileId);
    const fyStartMonth = Number(settings.fiscal_year_start_month || 3);
    const years = fiscalYearsInDateRange(opts.from, opts.to, fyStartMonth);
    if (!years.length) return empty;
    const supabase = getSupabaseServer();
    const { data: budgets, error } = await supabase
      .from('accounting_budgets')
      .select(
        'account_id, fiscal_year, m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12'
      )
      .eq('profile_id', opts.profileId)
      .in('fiscal_year', years);
    if (error || !budgets?.length) return empty;
    const { data: accounts } = await supabase
      .from('chart_of_accounts')
      .select('id, account_type')
      .eq('profile_id', opts.profileId);
    const typeById = new Map(
      (accounts || []).map((a) => [Number(a.id), String(a.account_type || '')])
    );
    const rows: BudgetPlanRow[] = [];
    for (const b of budgets) {
      const account_id = Number(b.account_id);
      const account_type = typeById.get(account_id) || '';
      if (!account_type) continue;
      rows.push({
        account_id,
        account_type,
        fiscal_year: Number(b.fiscal_year),
        months: {
          m01: Number(b.m01 || 0),
          m02: Number(b.m02 || 0),
          m03: Number(b.m03 || 0),
          m04: Number(b.m04 || 0),
          m05: Number(b.m05 || 0),
          m06: Number(b.m06 || 0),
          m07: Number(b.m07 || 0),
          m08: Number(b.m08 || 0),
          m09: Number(b.m09 || 0),
          m10: Number(b.m10 || 0),
          m11: Number(b.m11 || 0),
          m12: Number(b.m12 || 0),
        },
      });
    }
    return planOperatingCashFromBudgetRows({
      rows,
      from: opts.from,
      to: opts.to,
      fyStartMonth,
    });
  } catch {
    return empty;
  }
}
