/**
 * Shared calendar recurrence for Fit + clinic Advisors
 * (Dental / Physio / Medical / Psychiatry).
 *
 * - daily: every `interval` days
 * - weekly: every `interval` weeks on `weekdays` (0=Sun…6=Sat)
 * - monthly: every `interval` months on the same calendar day (clamped)
 */

export type ScheduleFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

export type ScheduleRecurrence = {
  frequency: ScheduleFrequency;
  /** Every N units of frequency (default 1). Weekly interval 2 = every 2 weeks. */
  interval?: number | null;
  /** 0=Sun … 6=Sat; empty = use start date's weekday (weekly only) */
  weekdays?: number[];
  /** Inclusive end date YYYY-MM-DD */
  until?: string | null;
  /** Number of occurrences including the first */
  count?: number | null;
};

/** Add calendar days to YYYY-MM-DD (local noon to avoid DST edge). */
export function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(dateIso: string): number {
  return new Date(dateIso + 'T12:00:00').getDay();
}

/** Add calendar months, clamping day-of-month (e.g. 31 Jan → 28/29 Feb). */
export function addMonthsIso(dateIso: string, months: number): string {
  const d = new Date(dateIso + 'T12:00:00');
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

function defaultMaxCount(frequency: ScheduleFrequency): number {
  if (frequency === 'daily') return 60;
  if (frequency === 'monthly') return 24;
  return 52; // weekly
}

function defaultUntil(
  startDate: string,
  frequency: ScheduleFrequency,
  interval: number
): string {
  if (frequency === 'daily') {
    return addDaysIso(startDate, Math.min(90, 30 * interval));
  }
  if (frequency === 'monthly') {
    return addMonthsIso(startDate, Math.min(24, 12 * interval));
  }
  return addDaysIso(startDate, 7 * Math.min(52, 12 * interval));
}

/**
 * Expand a recurrence rule into concrete YYYY-MM-DD dates.
 * Always includes the start date as the first occurrence when it matches the rule.
 */
export function expandRecurrenceDates(
  startDate: string,
  recurrence?: ScheduleRecurrence | null
): string[] {
  if (!recurrence || recurrence.frequency === 'none') {
    return [startDate];
  }

  const frequency = recurrence.frequency;
  const interval = Math.max(1, Math.min(12, Number(recurrence.interval) || 1));
  const maxCap = defaultMaxCount(frequency);
  const explicitCount =
    recurrence.count != null && Number(recurrence.count) > 0
      ? Math.min(maxCap, Math.max(1, Number(recurrence.count)))
      : null;
  const maxCount =
    explicitCount ?? (recurrence.until ? maxCap : Math.min(12, maxCap));
  const until =
    recurrence.until && String(recurrence.until) >= startDate
      ? String(recurrence.until)
      : defaultUntil(startDate, frequency, interval);

  const out: string[] = [];
  let guard = 0;

  if (frequency === 'daily') {
    let cur = startDate;
    while (cur <= until && out.length < maxCount && guard < 500) {
      out.push(cur);
      cur = addDaysIso(cur, interval);
      guard += 1;
    }
    return out;
  }

  if (frequency === 'monthly') {
    const monthly: string[] = [];
    for (let i = 0; i < maxCount; i++) {
      const d = addMonthsIso(startDate, interval * i);
      if (d > until) break;
      monthly.push(d);
    }
    return monthly.length ? monthly : [startDate];
  }

  // weekly
  const weekdays =
    recurrence.weekdays && recurrence.weekdays.length > 0
      ? [...new Set(recurrence.weekdays.map(Number))].sort()
      : [weekdayOf(startDate)];

  const start = new Date(startDate + 'T12:00:00');
  const startDow = start.getDay();
  const daysFromMonday = (startDow + 6) % 7;
  const week0Monday = addDaysIso(startDate, -daysFromMonday);

  let cur = startDate;
  while (cur <= until && out.length < maxCount && guard < 800) {
    const curDow = weekdayOf(cur);
    if (weekdays.includes(curDow)) {
      const curDaysFromWeek0 =
        (new Date(cur + 'T12:00:00').getTime() -
          new Date(week0Monday + 'T12:00:00').getTime()) /
        (24 * 60 * 60 * 1000);
      const weekIndex = Math.floor(curDaysFromWeek0 / 7);
      if (weekIndex >= 0 && weekIndex % interval === 0) {
        out.push(cur);
      }
    }
    cur = addDaysIso(cur, 1);
    guard += 1;
  }

  if (!out.includes(startDate) && out.length < maxCount) {
    out.unshift(startDate);
    out.sort();
  }
  return [...new Set(out)].sort().slice(0, maxCount);
}

/** Parse frequency/repeat fields from an API or form body. */
export function parseRecurrenceBody(
  body: Record<string, unknown>,
  opts?: { seriesDefault?: ScheduleFrequency }
): ScheduleRecurrence {
  const rawFreq = String(body.frequency || body.repeat || '')
    .toLowerCase()
    .trim();
  const freq: ScheduleFrequency =
    rawFreq === 'daily' || rawFreq === 'weekly' || rawFreq === 'monthly'
      ? rawFreq
      : opts?.seriesDefault || 'none';

  if (freq === 'none') return { frequency: 'none' };

  return {
    frequency: freq,
    interval:
      body.interval != null && body.interval !== ''
        ? Number(body.interval)
        : 1,
    weekdays: Array.isArray(body.weekdays)
      ? (body.weekdays as unknown[]).map(Number)
      : undefined,
    until: body.until ? String(body.until) : null,
    count:
      body.count != null && body.count !== '' ? Number(body.count) : null,
  };
}
