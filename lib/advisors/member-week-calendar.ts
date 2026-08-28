import { addDaysIso } from '@/lib/schedule/recurrence';

export type MemberCalendarEvent = {
  id: string;
  date: string;
  start_time: string;
  end_time?: string | null;
  duration_min?: number | null;
  title: string;
  person?: string;
  location?: string;
  my_status?: string | null;
  my_booking_id?: string | null;
  full?: boolean;
  can_book?: boolean;
  book_hint?: string | null;
  /** Coach diary: class vs own workout vs private client */
  kind?: 'class' | 'workout' | 'client';
};

export function mondayOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDay();
  const monOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + monOffset);
  return d.toISOString().slice(0, 10);
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));
}

const SHORT_MONTHS = [
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

function isoDayMonth(iso: string): string {
  const month = SHORT_MONTHS[Math.max(0, Number(iso.slice(5, 7)) - 1)] || '';
  return `${Number(iso.slice(8, 10))} ${month}`;
}

/** Locale-stable week caption, e.g. "17–23 Aug" or "28 Jul – 3 Aug". */
export function weekRangeLabel(weekStart: string): string {
  const days = weekDays(weekStart);
  const a = days[0];
  const b = days[6];
  if (!a || !b) return weekStart;
  if (a.slice(0, 7) === b.slice(0, 7)) {
    return `${Number(a.slice(8, 10))}–${isoDayMonth(b)}`;
  }
  return `${isoDayMonth(a)} – ${isoDayMonth(b)}`;
}

/** Shared week-grid template: time gutter + 7 equal day columns. */
export const WEEK_CALENDAR_COLUMNS = '2.25rem repeat(7, minmax(0, 1fr))';
export const DAY_CALENDAR_COLUMNS = '2.25rem minmax(0, 1fr)';

export function minutesFromMidnight(t: string): number {
  const [h, m] = String(t || '00:00')
    .slice(0, 5)
    .split(':')
    .map((n) => Number(n) || 0);
  return h * 60 + m;
}

export function eventEndMinutes(ev: MemberCalendarEvent): number {
  if (ev.end_time) return minutesFromMidnight(ev.end_time);
  return minutesFromMidnight(ev.start_time) + (Number(ev.duration_min) || 45);
}

export function hourRange(
  events: MemberCalendarEvent[],
  fallbackStart = 6,
  fallbackEnd = 20
): { start: number; end: number } {
  if (!events.length) return { start: fallbackStart, end: fallbackEnd };
  let minM = 24 * 60;
  let maxM = 0;
  for (const ev of events) {
    minM = Math.min(minM, minutesFromMidnight(ev.start_time));
    maxM = Math.max(maxM, eventEndMinutes(ev));
  }
  const start = Math.max(5, Math.floor(minM / 60));
  const end = Math.min(22, Math.max(start + 4, Math.ceil(maxM / 60)));
  return { start, end };
}

export function eventKey(ev: Pick<MemberCalendarEvent, 'date' | 'start_time' | 'title'>): string {
  return `${ev.date}|${String(ev.start_time).slice(0, 5)}|${ev.title}`;
}

export function slotsToMemberCalendarEvents(
  slots: Array<{
    id: string;
    date: string;
    start_time: string;
    end_time?: string | null;
    duration_min?: number | null;
    title?: string;
    class_name?: string;
    service_name?: string;
    coach_name?: string;
    practitioner_name?: string;
    clinician_name?: string;
    location?: string;
    my_status?: string | null;
    my_booking_id?: string | null;
    full?: boolean;
    can_book?: boolean;
    book_hint?: string | null;
  }>
): MemberCalendarEvent[] {
  return slots.map((s) => ({
    id: s.id,
    date: s.date,
    start_time: String(s.start_time || '').slice(0, 5),
    end_time: s.end_time ? String(s.end_time).slice(0, 5) : null,
    duration_min: s.duration_min,
    title: s.title || s.class_name || s.service_name || 'Slot',
    person: s.coach_name || s.practitioner_name || s.clinician_name,
    location: s.location,
    my_status: s.my_status || null,
    my_booking_id: s.my_booking_id || null,
    full: s.full === true,
    can_book: s.can_book,
    book_hint: s.book_hint,
  }));
}

export function bookingsToMemberCalendarEvents(
  bookings: Array<{
    booking_id?: string;
    id?: string;
    date: string;
    start_time: string;
    end_time?: string | null;
    title?: string;
    class_name?: string;
    service_name?: string;
    coach_name?: string;
    practitioner_name?: string;
    status?: string;
  }>
): MemberCalendarEvent[] {
  return bookings.map((b) => ({
    id: b.booking_id || b.id || `${b.date}-${b.start_time}`,
    date: b.date,
    start_time: String(b.start_time || '').slice(0, 5),
    end_time: b.end_time ? String(b.end_time).slice(0, 5) : null,
    title: b.title || b.class_name || b.service_name || 'Booked',
    person: b.coach_name || b.practitioner_name,
    my_status: b.status || 'booked',
    my_booking_id: b.booking_id || b.id || null,
    full: false,
  }));
}

export function mergeMemberCalendarEvents(
  open: MemberCalendarEvent[],
  mine: MemberCalendarEvent[]
): MemberCalendarEvent[] {
  const keys = new Set(open.map(eventKey));
  const extra = mine.filter((e) => !keys.has(eventKey(e)));
  return [...open, ...extra];
}

export type LaidOutEvent = {
  ev: MemberCalendarEvent;
  col: number;
  colCount: number;
  startMin: number;
  endMin: number;
};

export function layoutDayEvents(events: MemberCalendarEvent[]): LaidOutEvent[] {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );
  const colEnds: Array<{ endMin: number; col: number }> = [];
  const assigned: LaidOutEvent[] = [];
  for (const ev of sorted) {
    const startMin = minutesFromMidnight(ev.start_time);
    const endMin = eventEndMinutes(ev);
    for (let i = colEnds.length - 1; i >= 0; i--) {
      if (colEnds[i].endMin <= startMin) colEnds.splice(i, 1);
    }
    const used = new Set(colEnds.map((c) => c.col));
    let col = 0;
    while (used.has(col)) col += 1;
    colEnds.push({ endMin, col });
    assigned.push({ ev, col, colCount: 1, startMin, endMin });
  }
  return assigned.map((a) => {
    let maxCol = a.col;
    for (const b of assigned) {
      if (a.startMin < b.endMin && b.startMin < a.endMin) {
        maxCol = Math.max(maxCol, b.col);
      }
    }
    return { ...a, colCount: maxCol + 1 };
  });
}
