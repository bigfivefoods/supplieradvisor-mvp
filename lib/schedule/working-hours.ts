/**
 * Shared practice / gym working hours for schedule calendars.
 * Stored on module settings.working_hours.
 */

/** 0 = Sunday … 6 = Saturday (JS Date.getDay()) */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DayWorkingHours = {
  /** Closed this day */
  closed?: boolean;
  /** HH:mm open */
  open?: string;
  /** HH:mm close */
  close?: string;
};

export type WorkingHours = {
  /** Default open if a day is missing */
  default_open?: string;
  default_close?: string;
  /** Keys "0".."6" for Sun..Sat */
  days?: Partial<Record<string, DayWorkingHours>>;
};

export const WEEKDAY_LABELS: { day: WeekdayIndex; label: string; short: string }[] =
  [
    { day: 1, label: 'Monday', short: 'Mon' },
    { day: 2, label: 'Tuesday', short: 'Tue' },
    { day: 3, label: 'Wednesday', short: 'Wed' },
    { day: 4, label: 'Thursday', short: 'Thu' },
    { day: 5, label: 'Friday', short: 'Fri' },
    { day: 6, label: 'Saturday', short: 'Sat' },
    { day: 0, label: 'Sunday', short: 'Sun' },
  ];

export function defaultWorkingHours(): WorkingHours {
  const days: WorkingHours['days'] = {};
  // Mon–Fri 08:00–17:00, Sat 08:00–13:00, Sun closed
  for (const d of [1, 2, 3, 4, 5] as WeekdayIndex[]) {
    days[String(d)] = { closed: false, open: '08:00', close: '17:00' };
  }
  days['6'] = { closed: false, open: '08:00', close: '13:00' };
  days['0'] = { closed: true, open: '08:00', close: '17:00' };
  return {
    default_open: '08:00',
    default_close: '17:00',
    days,
  };
}

export function normalizeWorkingHours(
  raw: unknown
): WorkingHours {
  const base = defaultWorkingHours();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as WorkingHours;
  const days: WorkingHours['days'] = { ...(base.days || {}) };
  if (o.days && typeof o.days === 'object') {
    for (let i = 0; i <= 6; i++) {
      const key = String(i);
      const d = o.days[key];
      if (!d || typeof d !== 'object') continue;
      days[key] = {
        closed: d.closed === true,
        open: d.open ? String(d.open).slice(0, 5) : base.default_open,
        close: d.close ? String(d.close).slice(0, 5) : base.default_close,
      };
    }
  }
  return {
    default_open: o.default_open
      ? String(o.default_open).slice(0, 5)
      : base.default_open,
    default_close: o.default_close
      ? String(o.default_close).slice(0, 5)
      : base.default_close,
    days,
  };
}

export function dayHours(
  hours: WorkingHours | null | undefined,
  weekday: number
): DayWorkingHours {
  const h = normalizeWorkingHours(hours);
  const d = h.days?.[String(weekday)];
  if (d) return d;
  return {
    closed: false,
    open: h.default_open || '08:00',
    close: h.default_close || '17:00',
  };
}

/** True if practice is closed on this YYYY-MM-DD */
export function isClosedOn(
  hours: WorkingHours | null | undefined,
  isoDate: string
): boolean {
  const [y, m, d] = isoDate.split('-').map(Number);
  const wd = new Date(y, (m || 1) - 1, d || 1).getDay();
  return dayHours(hours, wd).closed === true;
}

export function openCloseOn(
  hours: WorkingHours | null | undefined,
  isoDate: string
): { closed: boolean; open: string; close: string } {
  const [y, m, d] = isoDate.split('-').map(Number);
  const wd = new Date(y, (m || 1) - 1, d || 1).getDay();
  const day = dayHours(hours, wd);
  return {
    closed: day.closed === true,
    open: (day.open || '08:00').slice(0, 5),
    close: (day.close || '17:00').slice(0, 5),
  };
}

function minutesFromMidnight(t: string): number {
  const [h, m] = String(t || '00:00')
    .slice(0, 5)
    .split(':')
    .map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Hour / minute bounds for day & week timelines.
 * @param pad — when true, add 1h buffer either side (legacy). Default false = exact open–close.
 */
export function hourBounds(
  hours: WorkingHours | null | undefined,
  isoDate?: string,
  opts?: { pad?: boolean }
): {
  startHour: number;
  endHour: number;
  startMinute: number;
  endMinute: number;
} {
  const pad = opts?.pad === true;
  const h = normalizeWorkingHours(hours);
  let minOpenMin = 24 * 60;
  let maxCloseMin = 0;

  const consider = (open: string, close: string) => {
    minOpenMin = Math.min(minOpenMin, minutesFromMidnight(open));
    maxCloseMin = Math.max(maxCloseMin, minutesFromMidnight(close));
  };

  if (isoDate) {
    const oc = openCloseOn(h, isoDate);
    if (!oc.closed) consider(oc.open, oc.close);
    else {
      consider(h.default_open || '08:00', h.default_close || '17:00');
    }
  } else {
    for (let i = 0; i <= 6; i++) {
      const d = dayHours(h, i);
      if (d.closed) continue;
      consider(d.open || '08:00', d.close || '17:00');
    }
  }

  if (minOpenMin >= 24 * 60) minOpenMin = 8 * 60;
  if (maxCloseMin <= 0) maxCloseMin = 17 * 60;
  if (maxCloseMin <= minOpenMin) maxCloseMin = minOpenMin + 60;

  let startMinute = minOpenMin;
  let endMinute = maxCloseMin;
  if (pad) {
    startMinute = Math.max(0, startMinute - 60);
    endMinute = Math.min(24 * 60, endMinute + 60);
  }

  return {
    startMinute,
    endMinute,
    startHour: Math.floor(startMinute / 60),
    // endHour is last hour tick to show (inclusive label at open of that hour)
    endHour: Math.max(
      Math.floor(startMinute / 60),
      Math.ceil(endMinute / 60) - (endMinute % 60 === 0 ? 1 : 0)
    ),
  };
}

/** Total open minutes for a day (0 if closed) */
export function openDurationMinutes(
  hours: WorkingHours | null | undefined,
  isoDate: string
): number {
  const oc = openCloseOn(hours, isoDate);
  if (oc.closed) return 0;
  return Math.max(
    0,
    minutesFromMidnight(oc.close) - minutesFromMidnight(oc.open)
  );
}

export function summarizeWorkingHours(hours: WorkingHours | null | undefined): string {
  const h = normalizeWorkingHours(hours);
  const parts: string[] = [];
  for (const { day, short } of WEEKDAY_LABELS) {
    const d = dayHours(h, day);
    if (d.closed) parts.push(`${short} closed`);
    else parts.push(`${short} ${d.open}–${d.close}`);
  }
  return parts.join(' · ');
}
