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

/** Hour bounds for day timeline (inclusive start, exclusive-ish end) */
export function hourBounds(
  hours: WorkingHours | null | undefined,
  isoDate?: string
): { startHour: number; endHour: number } {
  const h = normalizeWorkingHours(hours);
  let minOpen = 24;
  let maxClose = 0;

  const consider = (open: string, close: string) => {
    const [oh] = open.split(':').map(Number);
    const [ch, cm] = close.split(':').map(Number);
    minOpen = Math.min(minOpen, oh || 0);
    maxClose = Math.max(maxClose, (ch || 0) + ((cm || 0) > 0 ? 1 : 0));
  };

  if (isoDate) {
    const oc = openCloseOn(h, isoDate);
    if (!oc.closed) consider(oc.open, oc.close);
    else {
      // closed day — still show a reasonable window
      consider(h.default_open || '08:00', h.default_close || '17:00');
    }
  } else {
    for (let i = 0; i <= 6; i++) {
      const d = dayHours(h, i);
      if (d.closed) continue;
      consider(d.open || '08:00', d.close || '17:00');
    }
  }

  if (minOpen >= 24) minOpen = 6;
  if (maxClose <= 0) maxClose = 21;
  // pad one hour either side for spillover appointments
  return {
    startHour: Math.max(0, minOpen - 1),
    endHour: Math.min(23, Math.max(minOpen + 1, maxClose + 1)),
  };
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
