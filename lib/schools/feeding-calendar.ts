/**
 * DBE NSNP annual feeding calendar — terms, public holidays, day flags.
 * Cascades to schools & SPs; drives MPS feeding-day counts.
 */

export type FeedingTerm = {
  term: number;
  name: string;
  from: string;
  to: string;
};

export type FeedingDayType =
  | 'school_day'
  | 'weekend'
  | 'public_holiday'
  | 'school_holiday'
  | 'admin_closed'
  | 'special_feeding';

export type FeedingCalendarDay = {
  feed_date: string;
  is_feeding: boolean;
  day_type: FeedingDayType | string;
  label?: string | null;
  term_number?: number | null;
};

export type FeedingCalendar = {
  id?: number;
  agency_profile_id: number;
  year: number;
  name: string;
  status: 'draft' | 'published' | string;
  default_weekdays: number[];
  terms: FeedingTerm[];
  notes?: string | null;
  published_at?: string | null;
  days?: FeedingCalendarDay[];
};

export type MonthSummary = {
  month: number; // 1–12
  label: string;
  feeding_days: number;
  non_feeding_days: number;
  term_numbers: number[];
};

export type TermSummary = {
  term: number;
  name: string;
  from: string;
  to: string;
  feeding_days: number;
  calendar_days: number;
};

const MONTH_LABELS = [
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
];

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIso(s: string): Date {
  return new Date(`${s.slice(0, 10)}T12:00:00`);
}

/** JS getDay 0=Sun…6=Sat → ISO 1=Mon…7=Sun */
export function isoWeekday(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

/** Western (Gregorian) Easter Sunday for a year */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12, 0, 0);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * South African public holidays for a calendar year (fixed + Easter-based).
 * If a holiday falls on Sunday, the following Monday is also treated as a public holiday
 * (observed) where that is standard practice.
 */
export function saPublicHolidays(year: number): Map<string, string> {
  const map = new Map<string, string>();
  const add = (month: number, day: number, name: string, observeSunday = true) => {
    const d = new Date(year, month - 1, day, 12, 0, 0);
    map.set(isoDate(d), name);
    if (observeSunday && d.getDay() === 0) {
      const mon = addDays(d, 1);
      map.set(isoDate(mon), `${name} (observed)`);
    }
  };

  add(1, 1, "New Year's Day");
  add(3, 21, 'Human Rights Day');

  const easter = easterSunday(year);
  map.set(isoDate(addDays(easter, -2)), 'Good Friday');
  map.set(isoDate(addDays(easter, 1)), 'Family Day');

  add(4, 27, 'Freedom Day');
  add(5, 1, "Workers' Day");
  add(6, 16, 'Youth Day');
  add(8, 9, "National Women's Day");
  add(9, 24, 'Heritage Day');
  add(12, 16, 'Day of Reconciliation');
  add(12, 25, 'Christmas Day');
  add(12, 26, 'Day of Goodwill');

  return map;
}

/**
 * Default SA-style 4-term school calendar for a year.
 * Approximate mid-year pattern; DBE should edit to match the official circular.
 */
export function defaultSaTerms(year: number): FeedingTerm[] {
  return [
    {
      term: 1,
      name: 'Term 1',
      from: `${year}-01-15`,
      to: `${year}-03-27`,
    },
    {
      term: 2,
      name: 'Term 2',
      from: `${year}-04-08`,
      to: `${year}-06-26`,
    },
    {
      term: 3,
      name: 'Term 3',
      from: `${year}-07-21`,
      to: `${year}-10-02`,
    },
    {
      term: 4,
      name: 'Term 4',
      from: `${year}-10-13`,
      to: `${year}-12-09`,
    },
  ];
}

export function normalizeTerms(raw: unknown): FeedingTerm[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t, i) => {
      const o = t as Record<string, unknown>;
      const term = Number(o.term ?? i + 1);
      return {
        term: Number.isFinite(term) ? term : i + 1,
        name: String(o.name || `Term ${i + 1}`),
        from: String(o.from || '').slice(0, 10),
        to: String(o.to || '').slice(0, 10),
      };
    })
    .filter((t) => t.from && t.to);
}

export function normalizeWeekdays(raw: unknown): number[] {
  if (!Array.isArray(raw) || !raw.length) return [1, 2, 3, 4, 5];
  const set = new Set(
    raw
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 7)
  );
  return [...set].sort((a, b) => a - b);
}

function termForDate(
  dateIso: string,
  terms: FeedingTerm[]
): FeedingTerm | null {
  for (const t of terms) {
    if (dateIso >= t.from && dateIso <= t.to) return t;
  }
  return null;
}

/**
 * Generate every day of the year from terms + weekdays + SA public holidays.
 */
export function generateYearDays(opts: {
  year: number;
  terms: FeedingTerm[];
  defaultWeekdays?: number[];
  extraHolidays?: Array<{ date: string; label?: string }>;
}): FeedingCalendarDay[] {
  const weekdays = opts.defaultWeekdays?.length
    ? opts.defaultWeekdays
    : [1, 2, 3, 4, 5];
  const holidays = saPublicHolidays(opts.year);
  for (const h of opts.extraHolidays || []) {
    if (h.date) holidays.set(h.date.slice(0, 10), h.label || 'Closed');
  }

  const days: FeedingCalendarDay[] = [];
  const start = new Date(opts.year, 0, 1, 12, 0, 0);
  const end = new Date(opts.year, 11, 31, 12, 0, 0);
  const d = new Date(start);

  while (d <= end) {
    const feed_date = isoDate(d);
    const wd = isoWeekday(d);
    const holidayName = holidays.get(feed_date);
    const term = termForDate(feed_date, opts.terms);

    if (holidayName) {
      days.push({
        feed_date,
        is_feeding: false,
        day_type: 'public_holiday',
        label: holidayName,
        term_number: term?.term ?? null,
      });
    } else if (!weekdays.includes(wd)) {
      days.push({
        feed_date,
        is_feeding: false,
        day_type: 'weekend',
        label: null,
        term_number: term?.term ?? null,
      });
    } else if (!term) {
      days.push({
        feed_date,
        is_feeding: false,
        day_type: 'school_holiday',
        label: 'School holiday',
        term_number: null,
      });
    } else {
      days.push({
        feed_date,
        is_feeding: true,
        day_type: 'school_day',
        label: term.name,
        term_number: term.term,
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function summarizeMonths(days: FeedingCalendarDay[]): MonthSummary[] {
  const byMonth = new Map<number, MonthSummary>();
  for (let m = 1; m <= 12; m++) {
    byMonth.set(m, {
      month: m,
      label: MONTH_LABELS[m - 1],
      feeding_days: 0,
      non_feeding_days: 0,
      term_numbers: [],
    });
  }
  for (const day of days) {
    const m = Number(day.feed_date.slice(5, 7));
    const row = byMonth.get(m);
    if (!row) continue;
    if (day.is_feeding) row.feeding_days += 1;
    else row.non_feeding_days += 1;
    if (day.term_number != null && !row.term_numbers.includes(day.term_number)) {
      row.term_numbers.push(day.term_number);
    }
  }
  for (const row of byMonth.values()) {
    row.term_numbers.sort((a, b) => a - b);
  }
  return [...byMonth.values()];
}

export function summarizeTerms(
  terms: FeedingTerm[],
  days: FeedingCalendarDay[]
): TermSummary[] {
  return terms.map((t) => {
    const inTerm = days.filter(
      (d) => d.feed_date >= t.from && d.feed_date <= t.to
    );
    return {
      term: t.term,
      name: t.name,
      from: t.from,
      to: t.to,
      feeding_days: inTerm.filter((d) => d.is_feeding).length,
      calendar_days: inTerm.length,
    };
  });
}

export function yearFeedingTotal(days: FeedingCalendarDay[]): number {
  return days.filter((d) => d.is_feeding).length;
}

/** Count feeding days in [from, to] using a calendar day list (inclusive). */
export function countFeedingDaysFromCalendar(
  days: FeedingCalendarDay[],
  from: string,
  to: string
): number {
  const a = from.slice(0, 10);
  const b = to.slice(0, 10);
  let n = 0;
  for (const d of days) {
    if (d.is_feeding && d.feed_date >= a && d.feed_date <= b) n += 1;
  }
  return n;
}

/** Set of ISO dates that are feeding days (for fast MPS range checks). */
export function feedingDateSet(days: FeedingCalendarDay[]): Set<string> {
  const set = new Set<string>();
  for (const d of days) {
    if (d.is_feeding) set.add(d.feed_date.slice(0, 10));
  }
  return set;
}

export function countInSet(
  feedingDates: Set<string>,
  from: string,
  to: string
): number {
  if (!feedingDates.size) return 0;
  const a = parseIso(from);
  const b = parseIso(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a > b) return 0;
  let n = 0;
  const d = new Date(a);
  while (d <= b) {
    if (feedingDates.has(isoDate(d))) n += 1;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

export function dayTypeTone(dayType: string, isFeeding: boolean): string {
  if (isFeeding) {
    if (dayType === 'special_feeding') return 'bg-emerald-600 text-white';
    return 'bg-sky-600 text-white';
  }
  switch (dayType) {
    case 'public_holiday':
      return 'bg-rose-100 text-rose-800 border border-rose-200';
    case 'school_holiday':
      return 'bg-amber-50 text-amber-900 border border-amber-200';
    case 'admin_closed':
      return 'bg-slate-200 text-slate-700';
    case 'weekend':
      return 'bg-slate-50 text-slate-400';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}
