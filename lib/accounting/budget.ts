/**
 * 12-month COA budget helpers — plan totals and variance vs actual.
 */

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

export function monthKey(month1to12: number): MonthKey {
  const m = Math.min(12, Math.max(1, Math.round(month1to12)));
  return `m${String(m).padStart(2, '0')}` as MonthKey;
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

/** Sum budget for months in [fromMonth, toMonth] inclusive (1–12). */
export function sumBudgetRange(
  row: Partial<BudgetMonthMap> | Record<string, unknown> | null | undefined,
  fromMonth: number,
  toMonth: number
): number {
  if (!row) return 0;
  const a = Math.min(12, Math.max(1, fromMonth));
  const b = Math.min(12, Math.max(1, toMonth));
  let s = 0;
  for (let m = a; m <= b; m++) {
    s += Number((row as Record<string, unknown>)[monthKey(m)] || 0);
  }
  return Math.round(s * 100) / 100;
}

/**
 * Given ISO dates, return which calendar months of `year` fall inside [from, to].
 * If dates span partial year, only those months of `year` are included.
 */
export function monthsInPeriod(
  year: number,
  from?: string | null,
  to?: string | null
): { fromMonth: number; toMonth: number } {
  const yearStart = new Date(`${year}-01-01T00:00:00`);
  const yearEnd = new Date(`${year}-12-31T23:59:59`);
  const fromD = from ? new Date(from + (from.length === 10 ? 'T00:00:00' : '')) : yearStart;
  const toD = to ? new Date(to + (to.length === 10 ? 'T23:59:59' : '')) : yearEnd;

  let fromMonth = 1;
  let toMonth = 12;

  if (fromD.getFullYear() === year) {
    fromMonth = fromD.getMonth() + 1;
  } else if (fromD.getFullYear() > year) {
    return { fromMonth: 1, toMonth: 0 }; // empty
  }

  if (toD.getFullYear() === year) {
    toMonth = toD.getMonth() + 1;
  } else if (toD.getFullYear() < year) {
    return { fromMonth: 1, toMonth: 0 };
  }

  if (fromMonth > toMonth) return { fromMonth: 1, toMonth: 0 };
  return { fromMonth, toMonth };
}

export function variance(actual: number, budget: number): {
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
