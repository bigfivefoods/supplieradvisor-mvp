/**
 * Financial year helpers.
 * Default FY runs March → February (common SA / many mid-market businesses).
 */

export const FY_START_MONTH = 2; // March (0-indexed)

export type PeriodPreset =
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'ytd'
  | 'full_fy'
  | 'custom';

export type DateRange = {
  from: string; // YYYY-MM-DD
  to: string;
  label: string;
  preset: PeriodPreset;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Local calendar date as YYYY-MM-DD (no UTC shift). */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/**
 * First day of the financial year containing `ref`.
 * March–Feb: if month >= March, FY started this calendar year; else previous.
 */
export function fiscalYearStart(ref: Date = new Date()): Date {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  if (m >= FY_START_MONTH) return new Date(y, FY_START_MONTH, 1);
  return new Date(y - 1, FY_START_MONTH, 1);
}

/** Last day of the financial year containing `ref` (28/29 Feb). */
export function fiscalYearEnd(ref: Date = new Date()): Date {
  const start = fiscalYearStart(ref);
  return endOfMonth(new Date(start.getFullYear() + 1, 1, 1)); // Feb of next calendar year
}

/** e.g. "2026/27" for FY starting March 2026 */
export function fiscalYearLabel(ref: Date = new Date()): string {
  const start = fiscalYearStart(ref);
  const y0 = start.getFullYear();
  const y1 = (y0 + 1) % 100;
  return `${y0}/${String(y1).padStart(2, '0')}`;
}

/**
 * Fiscal quarter 1–4 for March–Feb FY:
 * Q1 Mar–May, Q2 Jun–Aug, Q3 Sep–Nov, Q4 Dec–Feb
 */
export function fiscalQuarter(ref: Date = new Date()): 1 | 2 | 3 | 4 {
  const m = ref.getMonth(); // 0–11
  if (m >= 2 && m <= 4) return 1; // Mar–May
  if (m >= 5 && m <= 7) return 2; // Jun–Aug
  if (m >= 8 && m <= 10) return 3; // Sep–Nov
  return 4; // Dec–Feb
}

const Q_START_MONTH: Record<1 | 2 | 3 | 4, number> = {
  1: 2, // Mar
  2: 5, // Jun
  3: 8, // Sep
  4: 11, // Dec
};

export function fiscalQuarterRange(
  ref: Date = new Date(),
  quarter?: 1 | 2 | 3 | 4
): { from: Date; to: Date; quarter: 1 | 2 | 3 | 4 } {
  const q = quarter ?? fiscalQuarter(ref);
  const fyStart = fiscalYearStart(ref);
  const startMonth = Q_START_MONTH[q];
  // Q1–Q3 same calendar year as FY start; Q4 starts Dec of FY start year
  const from = new Date(fyStart.getFullYear(), startMonth, 1);
  const to = endOfMonth(new Date(from.getFullYear(), from.getMonth() + 2, 1));
  return { from, to, quarter: q };
}

const MONTH_SHORT = [
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

export function formatMonthLabel(d: Date): string {
  return `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatRangeLabel(from: string, to: string): string {
  return `${from} → ${to}`;
}

const Q_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: 'Q1 (Mar–May)',
  2: 'Q2 (Jun–Aug)',
  3: 'Q3 (Sep–Nov)',
  4: 'Q4 (Dec–Feb)',
};

/** Resolve a preset to a date range relative to `today`. */
export function resolvePeriodPreset(
  preset: Exclude<PeriodPreset, 'custom'>,
  today: Date = new Date()
): DateRange {
  if (preset === 'this_month') {
    const from = startOfMonth(today);
    const to = endOfMonth(today);
    return {
      from: toIsoDate(from),
      to: toIsoDate(to),
      label: formatMonthLabel(from),
      preset,
    };
  }

  if (preset === 'last_month') {
    const ref = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const from = startOfMonth(ref);
    const to = endOfMonth(ref);
    return {
      from: toIsoDate(from),
      to: toIsoDate(to),
      label: formatMonthLabel(from),
      preset,
    };
  }

  if (preset === 'this_quarter') {
    const { from, to, quarter } = fiscalQuarterRange(today);
    return {
      from: toIsoDate(from),
      to: toIsoDate(to),
      label: `FY ${fiscalYearLabel(today)} ${Q_LABELS[quarter]}`,
      preset,
    };
  }

  if (preset === 'last_quarter') {
    // Step back one day before current quarter start
    const { from: qStart } = fiscalQuarterRange(today);
    const prevRef = new Date(qStart.getFullYear(), qStart.getMonth(), 0); // last day of prior month
    const { from, to, quarter } = fiscalQuarterRange(prevRef);
    return {
      from: toIsoDate(from),
      to: toIsoDate(to),
      label: `FY ${fiscalYearLabel(prevRef)} ${Q_LABELS[quarter]}`,
      preset,
    };
  }

  if (preset === 'ytd') {
    const from = fiscalYearStart(today);
    // YTD ends today (not future month-end)
    const to = today;
    return {
      from: toIsoDate(from),
      to: toIsoDate(to),
      label: `YTD FY ${fiscalYearLabel(today)}`,
      preset,
    };
  }

  // full_fy
  const from = fiscalYearStart(today);
  const to = fiscalYearEnd(today);
  return {
    from: toIsoDate(from),
    to: toIsoDate(to),
    label: `Full FY ${fiscalYearLabel(today)}`,
    preset: 'full_fy',
  };
}

/**
 * Build month chips for the current FY (Mar … Feb).
 * Each item is a full calendar month within the FY.
 */
export function fiscalYearMonths(ref: Date = new Date()): Array<{
  from: string;
  to: string;
  label: string;
  monthIndex: number; // 0–11 within FY (0 = March)
  isCurrent: boolean;
}> {
  const start = fiscalYearStart(ref);
  const today = new Date();
  const items: Array<{
    from: string;
    to: string;
    label: string;
    monthIndex: number;
    isCurrent: boolean;
  }> = [];

  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const from = startOfMonth(d);
    const to = endOfMonth(d);
    items.push({
      from: toIsoDate(from),
      to: toIsoDate(to),
      label: MONTH_SHORT[d.getMonth()],
      monthIndex: i,
      isCurrent:
        today.getFullYear() === d.getFullYear() && today.getMonth() === d.getMonth(),
    });
  }
  return items;
}

/** Quarter chips for current FY */
export function fiscalYearQuarters(ref: Date = new Date()): Array<{
  quarter: 1 | 2 | 3 | 4;
  from: string;
  to: string;
  label: string;
  isCurrent: boolean;
}> {
  const currentQ = fiscalQuarter(ref);
  return ([1, 2, 3, 4] as const).map((q) => {
    const { from, to } = fiscalQuarterRange(ref, q);
    return {
      quarter: q,
      from: toIsoDate(from),
      to: toIsoDate(to),
      label: Q_LABELS[q],
      isCurrent: q === currentQ,
    };
  });
}
