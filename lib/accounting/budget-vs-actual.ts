/**
 * Build plan vs actual by COA for a period, using accounting_budgets.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { round2 } from '@/lib/accounting/server';
import {
  monthsInPeriod,
  sumBudgetRange,
  variance,
  MONTH_KEYS,
} from '@/lib/accounting/budget';

export type BudgetVsActualRow = {
  account_id: number;
  code: string;
  name: string;
  account_type: string;
  budget: number;
  actual: number;
  variance: number;
  variancePct: number | null;
  /** For expense/cogs: actual > budget is unfavourable; for revenue opposite */
  favourable: boolean | null;
};

export async function buildBudgetVsActual(opts: {
  companyId: number;
  from?: string | null;
  to?: string | null;
  year?: number;
  accounts: Array<Record<string, unknown>>;
  actualByAccount: Record<number, { debit: number; credit: number }>;
}): Promise<{
  year: number;
  fromMonth: number;
  toMonth: number;
  rows: BudgetVsActualRow[];
  summary: {
    budgetRevenue: number;
    actualRevenue: number;
    budgetCogs: number;
    actualCogs: number;
    budgetExpenses: number;
    actualExpenses: number;
    budgetNet: number;
    actualNet: number;
    hasBudget: boolean;
  };
  monthly?: Array<{
    month: number;
    label: string;
    budgetRevenue: number;
    budgetExpenses: number;
  }>;
  warning?: string;
}> {
  const from = opts.from || null;
  const to = opts.to || null;
  const year =
    opts.year ||
    (from ? Number(from.slice(0, 4)) : new Date().getFullYear());

  const { fromMonth, toMonth } = monthsInPeriod(year, from, to);
  const supabase = getSupabaseServer();

  const { data: budgets, error } = await supabase
    .from('accounting_budgets')
    .select('*')
    .eq('profile_id', opts.companyId)
    .eq('fiscal_year', year);

  if (error) {
    return {
      year,
      fromMonth,
      toMonth,
      rows: [],
      summary: {
        budgetRevenue: 0,
        actualRevenue: 0,
        budgetCogs: 0,
        actualCogs: 0,
        budgetExpenses: 0,
        actualExpenses: 0,
        budgetNet: 0,
        actualNet: 0,
        hasBudget: false,
      },
      warning: error.message,
    };
  }

  const budgetByAcct = new Map<number, Record<string, unknown>>();
  for (const b of budgets || []) {
    budgetByAcct.set(Number(b.account_id), b as Record<string, unknown>);
  }

  const rows: BudgetVsActualRow[] = [];
  let budgetRevenue = 0;
  let actualRevenue = 0;
  let budgetCogs = 0;
  let actualCogs = 0;
  let budgetExpenses = 0;
  let actualExpenses = 0;

  for (const a of opts.accounts) {
    if (a.is_header) continue;
    const aid = Number(a.id);
    if (!Number.isFinite(aid)) continue;
    const type = String(a.account_type || '').toLowerCase();
    const isRevenue =
      type === 'revenue' || type === 'income' || type === 'sales';
    const isCogs =
      type === 'cogs' || type === 'cost_of_sales' || type === 'cost_of_goods';
    const isExpense =
      type === 'expense' || type === 'expenses' || type === 'opex';
    if (!isRevenue && !isCogs && !isExpense) continue;

    const t = opts.actualByAccount[aid] || { debit: 0, credit: 0 };
    const actual = isRevenue
      ? round2(t.credit - t.debit)
      : round2(t.debit - t.credit);

    const b = budgetByAcct.get(aid);
    const budget =
      toMonth >= fromMonth
        ? sumBudgetRange(b, fromMonth, toMonth)
        : 0;

    if (actual === 0 && budget === 0) continue;

    const v = variance(actual, budget);
    // For P&L: revenue over budget is favourable; expense over is unfavourable
    let favourable: boolean | null = null;
    if (v.status !== 'n/a' && v.status !== 'on') {
      if (isRevenue) favourable = actual >= budget;
      else favourable = actual <= budget;
    } else if (v.status === 'on') {
      favourable = true;
    }

    rows.push({
      account_id: aid,
      code: String(a.code || ''),
      name: String(a.name || ''),
      account_type: isRevenue ? 'revenue' : isCogs ? 'cogs' : 'expense',
      budget,
      actual,
      variance: v.variance,
      variancePct: v.variancePct,
      favourable,
    });

    if (isRevenue) {
      budgetRevenue += budget;
      actualRevenue += actual;
    } else if (isCogs) {
      budgetCogs += budget;
      actualCogs += actual;
    } else {
      budgetExpenses += budget;
      actualExpenses += actual;
    }
  }

  rows.sort((a, b) => a.code.localeCompare(b.code));

  budgetRevenue = round2(budgetRevenue);
  actualRevenue = round2(actualRevenue);
  budgetCogs = round2(budgetCogs);
  actualCogs = round2(actualCogs);
  budgetExpenses = round2(budgetExpenses);
  actualExpenses = round2(actualExpenses);

  const budgetNet = round2(budgetRevenue - budgetCogs - budgetExpenses);
  const actualNet = round2(actualRevenue - actualCogs - actualExpenses);

  // Monthly budget profile for charts
  const monthly = [];
  const labels = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  for (let m = 1; m <= 12; m++) {
    let br = 0;
    let be = 0;
    for (const a of opts.accounts) {
      if (a.is_header) continue;
      const type = String(a.account_type || '').toLowerCase();
      const b = budgetByAcct.get(Number(a.id));
      if (!b) continue;
      const amt = Number(b[MONTH_KEYS[m - 1]] || 0);
      if (type === 'revenue' || type === 'income' || type === 'sales') br += amt;
      else if (
        type === 'expense' ||
        type === 'expenses' ||
        type === 'opex' ||
        type === 'cogs' ||
        type === 'cost_of_sales'
      ) {
        be += amt;
      }
    }
    monthly.push({
      month: m,
      label: labels[m - 1],
      budgetRevenue: round2(br),
      budgetExpenses: round2(be),
    });
  }

  return {
    year,
    fromMonth,
    toMonth,
    rows,
    summary: {
      budgetRevenue,
      actualRevenue,
      budgetCogs,
      actualCogs,
      budgetExpenses,
      actualExpenses,
      budgetNet,
      actualNet,
      hasBudget: (budgets || []).length > 0,
    },
    monthly,
  };
}
