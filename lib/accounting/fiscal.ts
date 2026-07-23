/**
 * Financial year helpers.
 * Default FY starts in March (common in South Africa). Companies set
 * `accounting_settings.fiscal_year_start_month` (1–12) to override.
 */

export const DEFAULT_FY_START_MONTH = 3; // March

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

export type FiscalOpts = {
  /** 1 = January … 12 = December */
  startMonth?: number | null;
};

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
] as const;

export const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Clamp / default fiscal year start month (1–12). */
export function normalizeFyStartMonth(m?: number | null): number {
  const n = Number(m);
  if (!Number.isFinite(n) || n < 1 || n > 12) return DEFAULT_FY_START_MONTH;
  return Math.round(n);
}

/** 0-indexed month for Date constructors */
function startMonthIndex(startMonth?: number | null): number {
  return normalizeFyStartMonth(startMonth) - 1;
}

/** @deprecated Prefer normalizeFyStartMonth — kept for older imports (0-indexed March). */
export const FY_START_MONTH = DEFAULT_FY_START_MONTH - 1;

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
 * If start is March: month >= March → FY started this calendar year; else previous.
 */
export function fiscalYearStart(
  ref: Date = new Date(),
  startMonth: number | FiscalOpts = DEFAULT_FY_START_MONTH
): Date {
  const sm = startMonthIndex(
    typeof startMonth === 'object' ? startMonth.startMonth : startMonth
  );
  const y = ref.getFullYear();
  const m = ref.getMonth();
  if (m >= sm) return new Date(y, sm, 1);
  return new Date(y - 1, sm, 1);
}

/** Last day of the financial year containing `ref`. */
export function fiscalYearEnd(
  ref: Date = new Date(),
  startMonth: number | FiscalOpts = DEFAULT_FY_START_MONTH
): Date {
  const start = fiscalYearStart(ref, startMonth);
  return endOfMonth(new Date(start.getFullYear(), start.getMonth() + 11, 1));
}

/** Calendar year in which the FY containing `ref` starts. */
export function fiscalYearStartYear(
  ref: Date = new Date(),
  startMonth: number | FiscalOpts = DEFAULT_FY_START_MONTH
): number {
  return fiscalYearStart(ref, startMonth).getFullYear();
}

/**
 * Label for the FY containing `ref`.
 * Calendar year (Jan start): "2026"
 * Otherwise: "2026/27" for FY starting in 2026.
 */
export function fiscalYearLabel(
  ref: Date = new Date(),
  startMonth: number | FiscalOpts = DEFAULT_FY_START_MONTH
): string {
  const sm = normalizeFyStartMonth(
    typeof startMonth === 'object' ? startMonth.startMonth : startMonth
  );
  const start = fiscalYearStart(ref, sm);
  const y0 = start.getFullYear();
  if (sm === 1) return String(y0);
  const y1 = (y0 + 1) % 100;
  return `${y0}/${String(y1).padStart(2, '0')}`;
}

/** Label for a known FY start year (not "containing ref"). */
export function fiscalYearLabelForStartYear(
  startYear: number,
  startMonth: number | FiscalOpts = DEFAULT_FY_START_MONTH
): string {
  const sm = normalizeFyStartMonth(
    typeof startMonth === 'object' ? startMonth.startMonth : startMonth
  );
  if (sm === 1) return String(startYear);
  const y1 = (startYear + 1) % 100;
  return `${startYear}/${String(y1).padStart(2, '0')}`;
}

/** Date range string for a FY start year, e.g. "1 Mar 2026 – 28 Feb 2027". */
export function fiscalYearRangeLabel(
  startYear: number,
  startMonth: number | FiscalOpts = DEFAULT_FY_START_MONTH
): string {
  const sm = normalizeFyStartMonth(
    typeof startMonth === 'object' ? startMonth.startMonth : startMonth
  );
  const from = new Date(startYear, sm - 1, 1);
  const to = endOfMonth(new Date(startYear, sm - 1 + 11, 1));
  const fmt = (d: Date) =>
    `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  return `${fmt(from)} – ${fmt(to)}`;
}

/**
 * Fiscal quarter 1–4: Q1 = first 3 months of FY, etc.
 */
export function fiscalQuarter(
  ref: Date = new Date(),
  startMonth: number | FiscalOpts = DEFAULT_FY_START_MONTH
): 1 | 2 | 3 | 4 {
  const sm = normalizeFyStartMonth(
    typeof startMonth === 'object' ? startMonth.startMonth : startMonth
  );
  const start = fiscalYearStart(ref, sm);
  const monthsSince =
    (ref.getFullYear() - start.getFullYear()) * 12 +
    (ref.getMonth() - start.getMonth());
  const q = Math.floor(Math.min(11, Math.max(0, monthsSince)) / 3) + 1;
  return q as 1 | 2 | 3 | 4;
}

export function fiscalQuarterRange(
  ref: Date = new Date(),
  quarter?: 1 | 2 | 3 | 4,
  startMonth: number | FiscalOpts = DEFAULT_FY_START_MONTH
): { from: Date; to: Date; quarter: 1 | 2 | 3 | 4 } {
  const sm = normalizeFyStartMonth(
    typeof startMonth === 'object' ? startMonth.startMonth : startMonth
  );
  const q = quarter ?? fiscalQuarter(ref, sm);
  const fyStart = fiscalYearStart(ref, sm);
  const from = new Date(fyStart.getFullYear(), fyStart.getMonth() + (q - 1) * 3, 1);
  const to = endOfMonth(new Date(from.getFullYear(), from.getMonth() + 2, 1));
  return { from, to, quarter: q };
}

function quarterLabel(
  q: 1 | 2 | 3 | 4,
  startMonth: number
): string {
  const months = fiscalYearMonths(
    new Date(2000, normalizeFyStartMonth(startMonth) - 1, 15),
    startMonth
  );
  const slice = months.filter(
    (m) => m.monthIndex >= (q - 1) * 3 && m.monthIndex < q * 3
  );
  const names = slice.map((m) => m.label).join('–');
  return `Q${q} (${names})`;
}

export function formatMonthLabel(d: Date): string {
  return `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatRangeLabel(from: string, to: string): string {
  return `${from} → ${to}`;
}

/** Resolve a preset to a date range relative to `today`. */
export function resolvePeriodPreset(
  preset: Exclude<PeriodPreset, 'custom'>,
  today: Date = new Date(),
  startMonth: number | FiscalOpts = DEFAULT_FY_START_MONTH
): DateRange {
  const sm = normalizeFyStartMonth(
    typeof startMonth === 'object' ? startMonth.startMonth : startMonth
  );

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
    const { from, to, quarter } = fiscalQuarterRange(today, undefined, sm);
    return {
      from: toIsoDate(from),
      to: toIsoDate(to),
      label: `FY ${fiscalYearLabel(today, sm)} ${quarterLabel(quarter, sm)}`,
      preset,
    };
  }

  if (preset === 'last_quarter') {
    const { from: qStart } = fiscalQuarterRange(today, undefined, sm);
    const prevRef = new Date(qStart.getFullYear(), qStart.getMonth(), 0);
    const { from, to, quarter } = fiscalQuarterRange(prevRef, undefined, sm);
    return {
      from: toIsoDate(from),
      to: toIsoDate(to),
      label: `FY ${fiscalYearLabel(prevRef, sm)} ${quarterLabel(quarter, sm)}`,
      preset,
    };
  }

  if (preset === 'ytd') {
    const from = fiscalYearStart(today, sm);
    const to = today;
    return {
      from: toIsoDate(from),
      to: toIsoDate(to),
      label: `YTD FY ${fiscalYearLabel(today, sm)}`,
      preset,
    };
  }

  // full_fy
  const from = fiscalYearStart(today, sm);
  const to = fiscalYearEnd(today, sm);
  return {
    from: toIsoDate(from),
    to: toIsoDate(to),
    label: `Full FY ${fiscalYearLabel(today, sm)}`,
    preset: 'full_fy',
  };
}

/**
 * Build month chips for the FY containing `ref`.
 * Each item is a full calendar month within the FY.
 */
export function fiscalYearMonths(
  ref: Date = new Date(),
  startMonth: number | FiscalOpts = DEFAULT_FY_START_MONTH
): Array<{
  from: string;
  to: string;
  label: string;
  monthIndex: number; // 0–11 within FY
  calendarMonth: number; // 1–12
  calendarYear: number;
  isCurrent: boolean;
}> {
  const sm = normalizeFyStartMonth(
    typeof startMonth === 'object' ? startMonth.startMonth : startMonth
  );
  const start = fiscalYearStart(ref, sm);
  const today = new Date();
  const items: Array<{
    from: string;
    to: string;
    label: string;
    monthIndex: number;
    calendarMonth: number;
    calendarYear: number;
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
      calendarMonth: d.getMonth() + 1,
      calendarYear: d.getFullYear(),
      isCurrent:
        today.getFullYear() === d.getFullYear() &&
        today.getMonth() === d.getMonth(),
    });
  }
  return items;
}

/** Quarter chips for the FY containing `ref`. */
export function fiscalYearQuarters(
  ref: Date = new Date(),
  startMonth: number | FiscalOpts = DEFAULT_FY_START_MONTH
): Array<{
  quarter: 1 | 2 | 3 | 4;
  from: string;
  to: string;
  label: string;
  isCurrent: boolean;
}> {
  const sm = normalizeFyStartMonth(
    typeof startMonth === 'object' ? startMonth.startMonth : startMonth
  );
  const currentQ = fiscalQuarter(ref, sm);
  return ([1, 2, 3, 4] as const).map((q) => {
    const { from, to } = fiscalQuarterRange(ref, q, sm);
    return {
      quarter: q,
      from: toIsoDate(from),
      to: toIsoDate(to),
      label: quarterLabel(q, sm),
      isCurrent: q === currentQ,
    };
  });
}

export { MONTH_SHORT };
