/**
 * Build plan vs actual by COA for a period, using accounting_budgets.
 * Budget months are fiscal periods aligned to the company's FY start month.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getOrCreateSettings, round2 } from '@/lib/accounting/server';
import {
  budgetFyMeta,
  dateToBudgetPeriod,
  fiscalYearsInDateRange,
  fyMonthColumns,
  sumBudgetForDateRange,
  variance,
  normalizeFyStartMonth,
  fiscalYearStartYear,
} from '@/lib/accounting/budget';
import {
  fiscalYearEnd,
  fiscalYearStart,
  toIsoDate,
} from '@/lib/accounting/fiscal';

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
  /** FY start year (calendar year FY begins). Prefer from/to. */
  year?: number;
  accounts: Array<Record<string, unknown>>;
  actualByAccount: Record<number, { debit: number; credit: number }>;
  /** Override settings lookup */
  fyStartMonth?: number | null;
}): Promise<{
  year: number;
  fyStartMonth: number;
  fyLabel: string;
  fyRangeLabel: string;
  from: string;
  to: string;
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
    period: number;
    label: string;
    budgetRevenue: number;
    budgetExpenses: number;
  }>;
  warning?: string;
}> {
  const settings = opts.fyStartMonth
    ? { fiscal_year_start_month: opts.fyStartMonth }
    : await getOrCreateSettings(opts.companyId);
  const fyStartMonth = normalizeFyStartMonth(
    settings.fiscal_year_start_month ?? opts.fyStartMonth
  );

  const defaultYear =
    opts.year && Number.isFinite(opts.year)
      ? Number(opts.year)
      : fiscalYearStartYear(new Date(), fyStartMonth);

  const from =
    opts.from ||
    toIsoDate(fiscalYearStart(new Date(defaultYear, fyStartMonth - 1, 15), fyStartMonth));
  const to =
    opts.to ||
    toIsoDate(fiscalYearEnd(new Date(defaultYear, fyStartMonth - 1, 15), fyStartMonth));

  // Primary FY for labelling (first month of range)
  const primaryFy = dateToBudgetPeriod(from, fyStartMonth).fiscalYear;
  const meta = budgetFyMeta(primaryFy, fyStartMonth);

  const years = fiscalYearsInDateRange(from, to, fyStartMonth);
  const supabase = getSupabaseServer();

  const { data: budgets, error } = await supabase
    .from('accounting_budgets')
    .select('*')
    .eq('profile_id', opts.companyId)
    .in('fiscal_year', years.length ? years : [primaryFy]);

  if (error) {
    return {
      year: primaryFy,
      fyStartMonth,
      fyLabel: meta.fyLabel,
      fyRangeLabel: meta.fyRangeLabel,
      from,
      to,
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

  // account_id → Map(fiscal_year → row)
  const byAccount = new Map<
    number,
    Map<number, Record<string, unknown>>
  >();
  for (const b of budgets || []) {
    const aid = Number(b.account_id);
    const fy = Number(b.fiscal_year);
    if (!byAccount.has(aid)) byAccount.set(aid, new Map());
    byAccount.get(aid)!.set(fy, b as Record<string, unknown>);
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

    const fyMap = byAccount.get(aid) || new Map();
    const budget = sumBudgetForDateRange(fyMap, from, to, fyStartMonth);

    if (actual === 0 && budget === 0) continue;

    const v = variance(actual, budget);
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

  // Monthly budget profile in FY order for the primary FY
  const columns = fyMonthColumns(primaryFy, fyStartMonth);
  const monthly = columns.map((col) => {
    let br = 0;
    let be = 0;
    for (const a of opts.accounts) {
      if (a.is_header) continue;
      const type = String(a.account_type || '').toLowerCase();
      const row = byAccount.get(Number(a.id))?.get(primaryFy);
      if (!row) continue;
      const amt = Number(row[col.key] || 0);
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
    return {
      month: col.calendarMonth,
      period: col.period,
      label: col.shortLabel,
      budgetRevenue: round2(br),
      budgetExpenses: round2(be),
    };
  });

  return {
    year: primaryFy,
    fyStartMonth,
    fyLabel: meta.fyLabel,
    fyRangeLabel: meta.fyRangeLabel,
    from,
    to,
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
