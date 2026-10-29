/**
 * South African debit-order action dates.
 * Business days skip weekends and public holidays (Public Holidays Act:
 * a holiday on Sunday is also observed on Monday).
 * Africa/Johannesburg is UTC+2 with no daylight saving.
 *
 * Default Netcash-style rule used here: the file must be in before the
 * cut-off (14:00 SAST) on the business day that is `leadBusinessDays`
 * (default 2) before the action date. The action date itself is a business day.
 */

export type SastStamp = { date: string; minutes: number };

export type ActionDatePlan = {
  requested: string;
  actionDate: string;
  deadlineDate: string;
  deadlineMinutes: number;
  cutoffApplied: boolean;
  holidayShifted: boolean;
  note: string;
};

const FIXED: Array<[number, number, string]> = [
  [1, 1, 'New Year'],
  [3, 21, 'Human Rights Day'],
  [4, 27, 'Freedom Day'],
  [5, 1, "Workers' Day"],
  [6, 16, 'Youth Day'],
  [8, 9, "National Women's Day"],
  [9, 24, 'Heritage Day'],
  [12, 16, 'Day of Reconciliation'],
  [12, 25, 'Christmas Day'],
  [12, 26, 'Day of Goodwill'],
];

export function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12));
  return dt.toISOString().slice(0, 10);
}

export function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
}

/** Gregorian Computus. Returns Easter Sunday as YYYY-MM-DD. */
export function easterSunday(year: number): string {
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
  return isoDate(year, month, day);
}

export function publicHolidays(year: number): Map<string, string> {
  const map = new Map<string, string>();
  for (const [month, day, name] of FIXED) map.set(isoDate(year, month, day), name);
  const easter = easterSunday(year);
  map.set(addDays(easter, -2), 'Good Friday');
  map.set(addDays(easter, 1), 'Family Day');
  const extras: Array<[string, string]> = [];
  for (const [date, name] of map) {
    if (weekday(date) !== 0) continue;
    let observed = addDays(date, 1);
    while (map.has(observed) || extras.some(([d]) => d === observed)) {
      observed = addDays(observed, 1);
    }
    extras.push([observed, `${name} observed`]);
  }
  for (const [date, name] of extras) map.set(date, name);
  return map;
}

const holidayCache = new Map<number, Map<string, string>>();

export function holidayName(iso: string): string | null {
  const year = Number(iso.slice(0, 4));
  if (!holidayCache.has(year)) holidayCache.set(year, publicHolidays(year));
  return holidayCache.get(year)?.get(iso) || null;
}

export function isWeekend(iso: string): boolean {
  const day = weekday(iso);
  return day === 0 || day === 6;
}

export function isBusinessDay(iso: string): boolean {
  return !isWeekend(iso) && !holidayName(iso);
}

export function nextBusinessDay(iso: string): string {
  let cursor = iso;
  while (!isBusinessDay(cursor)) cursor = addDays(cursor, 1);
  return cursor;
}

export function addBusinessDays(iso: string, days: number): string {
  let cursor = iso;
  let left = Math.abs(days);
  const step = days >= 0 ? 1 : -1;
  while (left > 0) {
    cursor = addDays(cursor, step);
    if (isBusinessDay(cursor)) left -= 1;
  }
  return cursor;
}

export function sastStamp(date: Date): SastStamp {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function clampDebitDay(year: number, month: number, debitDay: number): string {
  const day = Math.min(Math.max(1, debitDay), daysInMonth(year, month));
  return isoDate(year, month, day);
}

export function periodFor(cadence: 'monthly' | 'weekly' | 'fortnightly', sastDate: string, debitDay: number): {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  requested: string;
} {
  const year = Number(sastDate.slice(0, 4));
  const month = Number(sastDate.slice(5, 7));
  if (cadence === 'monthly') {
    const start = isoDate(year, month, 1);
    const end = isoDate(year, month, daysInMonth(year, month));
    return {
      periodKey: sastDate.slice(0, 7),
      periodStart: start,
      periodEnd: end,
      requested: clampDebitDay(year, month, debitDay),
    };
  }
  const start = addDays(sastDate, -((weekday(sastDate) + 6) % 7));
  const end = addDays(start, cadence === 'weekly' ? 6 : 13);
  const requested = nextBusinessDay(start);
  const key = cadence === 'weekly' ? `W${start}` : `F${start}`;
  return { periodKey: key, periodStart: start, periodEnd: end, requested };
}

/**
 * Pick an action date that is a business day and still meets the cut-off.
 * Walks forward at most 40 business days.
 */
export function planActionDate(input: {
  requested: string;
  now: Date;
  leadBusinessDays: number;
  cutoffHourSast: number;
  cutoffMinute: number;
}): ActionDatePlan {
  const lead = Math.min(10, Math.max(0, Math.round(input.leadBusinessDays)));
  const cutoff = Math.min(23, Math.max(0, input.cutoffHourSast)) * 60 + Math.min(59, Math.max(0, input.cutoffMinute));
  const now = sastStamp(input.now);
  let requested = input.requested;
  let holidayShifted = false;
  if (!isBusinessDay(requested)) {
    requested = nextBusinessDay(requested);
    holidayShifted = true;
  }
  let actionDate = requested;
  let cutoffApplied = false;
  for (let i = 0; i < 40; i += 1) {
    const deadlineDate = lead === 0 ? actionDate : addBusinessDays(actionDate, -lead);
    const deadlinePassed =
      now.date > deadlineDate || (now.date === deadlineDate && now.minutes >= cutoff);
    if (!deadlinePassed) {
      const shifted = actionDate !== input.requested;
      const notes: string[] = [];
      if (holidayShifted || (shifted && !isBusinessDay(input.requested))) {
        notes.push(`Action date moved to the next business day (${actionDate}).`);
      }
      if (cutoffApplied) {
        notes.push(`Cut-off is ${String(Math.floor(cutoff / 60)).padStart(2, '0')}:${String(cutoff % 60).padStart(2, '0')} SAST, ${lead} business day${lead === 1 ? '' : 's'} before the action date.`);
      }
      if (!notes.length) notes.push('Action date is inside the cut-off.');
      return {
        requested: input.requested,
        actionDate,
        deadlineDate,
        deadlineMinutes: cutoff,
        cutoffApplied,
        holidayShifted: holidayShifted || actionDate !== input.requested,
        note: notes.join(' '),
      };
    }
    cutoffApplied = true;
    actionDate = nextBusinessDay(addDays(actionDate, 1));
  }
  return {
    requested: input.requested,
    actionDate,
    deadlineDate: actionDate,
    deadlineMinutes: cutoff,
    cutoffApplied: true,
    holidayShifted: true,
    note: 'No action date was open in the next 40 business days.',
  };
}
