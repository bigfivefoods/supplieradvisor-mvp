/**
 * 12-month COA budget helpers — plan totals and variance vs actual.
 *
 * Storage: m01…m12 are **fiscal periods** (period 1 = first month of the FY),
 * not necessarily January–December. `fiscal_year` is the calendar year in which
 * that financial year **starts**.
 *
 * Example (FY starts March, fiscal_year = 2026):
 *   m01 = Mar 2026 … m10 = Dec 2026 … m12 = Feb 2027
 */

import {
  DEFAULT_FY_START_MONTH,
  MONTH_SHORT,
  fiscalYearLabelForStartYear,
  fiscalYearRangeLabel,
  fiscalYearStart,
  fiscalYearStartYear,
  normalizeFyStartMonth,
} from '@/lib/accounting/fiscal';

export const MONTH_KEYS = [
  'm01',
  'm02',
  'm03',
  'm04',
  'm05',
  'm06',
  'm07',
  'm08',
  'm09',
  'm10',
  'm11',
  'm12',
] as const;

export type MonthKey = (typeof MONTH_KEYS)[number];

export type BudgetMonthMap = Record<MonthKey, number>;

/** @deprecated Prefer fyMonthColumns() — calendar Jan–Dec labels only when FY starts in January. */
export const MONTH_LABELS = [
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
] as const;

export type FyMonthColumn = {
  key: MonthKey;
  /** 1–12 within the financial year */
  period: number;
  /** Calendar month 1–12 */
  calendarMonth: number;
  calendarYear: number;
  shortLabel: string;
  /** e.g. "Mar 2026" */
  label: string;
};

export function emptyMonths(): BudgetMonthMap {
  return {
    m01: 0,
    m02: 0,
    m03: 0,
    m04: 0,
    m05: 0,
    m06: 0,
    m07: 0,
    m08: 0,
    m09: 0,
    m10: 0,
    m11: 0,
    m12: 0,
  };
}

export function monthKey(period1to12: number): MonthKey {
  const m = Math.min(12, Math.max(1, Math.round(period1to12)));
  return `m${String(m).padStart(2, '0')}` as MonthKey;
}

/**
 * Column headers for a budget FY (ordered period 1 → 12).
 * `startYear` = calendar year when the FY starts.
 */
export function fyMonthColumns(
  startYear: number,
  fyStartMonth: number | null | undefined = DEFAULT_FY_START_MONTH
): FyMonthColumn[] {
  const sm = normalizeFyStartMonth(fyStartMonth);
  return MONTH_KEYS.map((key, i) => {
    const d = new Date(startYear, sm - 1 + i, 1);
    const calM = d.getMonth() + 1;
    const calY = d.getFullYear();
    return {
      key,
      period: i + 1,
      calendarMonth: calM,
      calendarYear: calY,
      shortLabel: MONTH_SHORT[d.getMonth()],
      label: `${MONTH_SHORT[d.getMonth()]} ${calY}`,
    };
  });
}

export function budgetFyMeta(
  startYear: number,
  fyStartMonth: number | null | undefined = DEFAULT_FY_START_MONTH
) {
  const sm = normalizeFyStartMonth(fyStartMonth);
  const columns = fyMonthColumns(startYear, sm);
  return {
    fiscalYear: startYear,
    fiscalYearStartMonth: sm,
    fyLabel: fiscalYearLabelForStartYear(startYear, sm),
    fyRangeLabel: fiscalYearRangeLabel(startYear, sm),
    startsIn: MONTH_SHORT[sm - 1],
    columns,
  };
}

/** Map a calendar date to its budget FY + period. */
export function dateToBudgetPeriod(
  date: Date | string,
  fyStartMonth: number | null | undefined = DEFAULT_FY_START_MONTH
): { fiscalYear: number; period: number; monthKey: MonthKey } {
  const sm = normalizeFyStartMonth(fyStartMonth);
  const d =
    typeof date === 'string'
      ? new Date(
          date.length === 10 ? `${date}T00:00:00` : date
        )
      : date;
  const start = fiscalYearStart(d, sm);
  const fiscalYear = start.getFullYear();
  const monthsSince =
    (d.getFullYear() - start.getFullYear()) * 12 +
    (d.getMonth() - start.getMonth());
  const period = Math.min(12, Math.max(1, monthsSince + 1));
  return { fiscalYear, period, monthKey: monthKey(period) };
}

/** Distinct fiscal_year values touched by [from, to] inclusive months. */
export function fiscalYearsInDateRange(
  from: string,
  to: string,
  fyStartMonth: number | null | undefined = DEFAULT_FY_START_MONTH
): number[] {
  const sm = normalizeFyStartMonth(fyStartMonth);
  const fromD = new Date(from.slice(0, 10) + 'T00:00:00');
  const toD = new Date(to.slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime())) {
    return [fiscalYearStartYear(new Date(), sm)];
  }
  const years = new Set<number>();
  let cur = new Date(fromD.getFullYear(), fromD.getMonth(), 1);
  const end = new Date(toD.getFullYear(), toD.getMonth(), 1);
  // safety cap
  for (let i = 0; i < 48 && cur <= end; i++) {
    years.add(dateToBudgetPeriod(cur, sm).fiscalYear);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return Array.from(years).sort((a, b) => a - b);
}

/**
 * Sum one account's budget across every calendar month in [from, to].
 * `budgetsByFy` maps fiscal_year → budget row (with m01…m12).
 */
export function sumBudgetForDateRange(
  budgetsByFy: Map<number, Partial<BudgetMonthMap> | Record<string, unknown> | null | undefined>,
  from: string,
  to: string,
  fyStartMonth: number | null | undefined = DEFAULT_FY_START_MONTH
): number {
  const sm = normalizeFyStartMonth(fyStartMonth);
  const fromD = new Date(from.slice(0, 10) + 'T00:00:00');
  const toD = new Date(to.slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime())) return 0;

  let s = 0;
  let cur = new Date(fromD.getFullYear(), fromD.getMonth(), 1);
  const end = new Date(toD.getFullYear(), toD.getMonth(), 1);
  for (let i = 0; i < 48 && cur <= end; i++) {
    const { fiscalYear, monthKey: mk } = dateToBudgetPeriod(cur, sm);
    const row = budgetsByFy.get(fiscalYear);
    if (row) s += Number((row as Record<string, unknown>)[mk] || 0);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return Math.round(s * 100) / 100;
}

export function sumBudgetMonths(
  row: Partial<BudgetMonthMap> | Record<string, unknown> | null | undefined
): number {
  if (!row) return 0;
  let s = 0;
  for (const k of MONTH_KEYS) {
    s += Number((row as Record<string, unknown>)[k] || 0);
  }
  return Math.round(s * 100) / 100;
}

/** Sum budget for FY periods in [fromPeriod, toPeriod] inclusive (1–12). */
export function sumBudgetRange(
  row: Partial<BudgetMonthMap> | Record<string, unknown> | null | undefined,
  fromPeriod: number,
  toPeriod: number
): number {
  if (!row) return 0;
  const a = Math.min(12, Math.max(1, fromPeriod));
  const b = Math.min(12, Math.max(1, toPeriod));
  let s = 0;
  for (let m = a; m <= b; m++) {
    s += Number((row as Record<string, unknown>)[monthKey(m)] || 0);
  }
  return Math.round(s * 100) / 100;
}

/**
 * Given ISO dates and a calendar year, return which calendar months of that
 * year fall inside [from, to]. Prefer sumBudgetForDateRange for FY budgets.
 */
export function monthsInPeriod(
  year: number,
  from?: string | null,
  to?: string | null
): { fromMonth: number; toMonth: number } {
  const yearStart = new Date(`${year}-01-01T00:00:00`);
  const yearEnd = new Date(`${year}-12-31T23:59:59`);
  const fromD = from
    ? new Date(from + (from.length === 10 ? 'T00:00:00' : ''))
    : yearStart;
  const toD = to
    ? new Date(to + (to.length === 10 ? 'T23:59:59' : ''))
    : yearEnd;

  let fromMonth = 1;
  let toMonth = 12;

  if (fromD.getFullYear() === year) {
    fromMonth = fromD.getMonth() + 1;
  } else if (fromD.getFullYear() > year) {
    return { fromMonth: 1, toMonth: 0 };
  }

  if (toD.getFullYear() === year) {
    toMonth = toD.getMonth() + 1;
  } else if (toD.getFullYear() < year) {
    return { fromMonth: 1, toMonth: 0 };
  }

  if (fromMonth > toMonth) return { fromMonth: 1, toMonth: 0 };
  return { fromMonth, toMonth };
}

export function variance(
  actual: number,
  budget: number
): {
  variance: number;
  variancePct: number | null;
  status: 'over' | 'under' | 'on' | 'n/a';
} {
  const v = Math.round((actual - budget) * 100) / 100;
  if (Math.abs(budget) < 0.005 && Math.abs(actual) < 0.005) {
    return { variance: 0, variancePct: null, status: 'n/a' };
  }
  const pct =
    Math.abs(budget) < 0.005
      ? null
      : Math.round((v / Math.abs(budget)) * 1000) / 10;
  const status =
    Math.abs(v) < 0.5 ? 'on' : v > 0 ? 'over' : 'under';
  return { variance: v, variancePct: pct, status };
}

export { DEFAULT_FY_START_MONTH, normalizeFyStartMonth, fiscalYearStartYear };
