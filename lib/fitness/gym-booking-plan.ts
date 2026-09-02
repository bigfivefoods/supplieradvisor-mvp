/**
 * Gym Bookings “call in the plan”: scheduled classes, assigned coach,
 * planned members (bookings + class subscribers).
 */
import { mondayOf } from '@/lib/advisors/member-week-calendar';
import { addDaysIso } from '@/lib/schedule/recurrence';
import {
  WEEKDAY_LABELS,
  openCloseOn,
  type WorkingHours,
} from '@/lib/schedule/working-hours';
import {
  sessionRosterRows,
  type SessionRosterRow,
} from '@/lib/fitness/class-allocate';
import {
  sessionBookingCount,
  type FitgraphStore,
  type FitSession,
} from '@/lib/fitness/fitgraph';
import {
  SYS_COACH_AWAY_CODE,
  SYS_COACH_TIME_CODE,
  SYS_PT_CODE,
  normalizeSessionKind,
} from '@/lib/fitness/session-times';

const HIDE_CLASS = new Set([
  SYS_PT_CODE,
  SYS_COACH_TIME_CODE,
  SYS_COACH_AWAY_CODE,
]);

const MONTHS = [
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

export type GymPlanMember = SessionRosterRow & {
  code: string;
  feedback_token?: string | null;
  feedback_submitted_at?: string | null;
};

export type GymPlanClass = {
  session: FitSession;
  className: string;
  classTypeId: string;
  coachName: string;
  coachId: string | null;
  cap: number;
  booked: number;
  members: GymPlanMember[];
};

export type GymPlanDay = {
  date: string;
  weekday: number;
  label: string;
  short: string;
  dateLabel: string;
  hoursLabel: string;
  closed: boolean;
  classes: GymPlanClass[];
};

export type GymPlanFilter = {
  classId?: string;
  memberQ?: string;
  status?: string;
};

export function gymPlanMonday(iso: string): string {
  return mondayOf(String(iso || '').slice(0, 10));
}

export function gymPlanDateLabel(iso: string): string {
  const [y, m, d] = String(iso || '')
    .slice(0, 10)
    .split('-')
    .map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1] || ''}`;
}

export function gymPlanDayHeading(iso: string): {
  label: string;
  short: string;
  dateLabel: string;
  weekday: number;
} {
  const date = String(iso || '').slice(0, 10);
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const meta =
    WEEKDAY_LABELS.find((w) => w.day === weekday) || WEEKDAY_LABELS[0];
  return {
    label: meta.label,
    short: meta.short,
    dateLabel: gymPlanDateLabel(date),
    weekday,
  };
}

export function isGymPlanSession(
  store: FitgraphStore,
  session: FitSession
): boolean {
  if (session.status === 'cancelled') return false;
  const kind = normalizeSessionKind(session.session_kind, 'class');
  if (kind === 'coach_personal' || kind === 'away') return false;
  const ct = (store.class_types || []).find(
    (c) => c.id === session.class_type_id
  );
  if (HIDE_CLASS.has(String(ct?.code || ''))) return false;
  return true;
}

export function gymPlanClass(
  store: FitgraphStore,
  session: FitSession
): GymPlanClass {
  const ct = (store.class_types || []).find(
    (c) => c.id === session.class_type_id
  );
  const coach = (store.coaches || []).find((c) => c.id === session.coach_id);
  const kind = normalizeSessionKind(session.session_kind, 'class');
  const members = sessionRosterRows(store, session.id).map((row) => {
    const client = (store.clients || []).find((c) => c.id === row.client_id);
    const booking = (store.bookings || []).find((b) => b.id === row.booking_id);
    return {
      ...row,
      code: client?.code || '',
      feedback_token: booking?.feedback_token || null,
      feedback_submitted_at: booking?.feedback_submitted_at || null,
    };
  });
  return {
    session,
    className:
      ct?.name || (kind === 'private_pt' ? 'Private PT' : 'Class'),
    classTypeId: session.class_type_id,
    coachName: coach?.name || 'Unassigned',
    coachId: session.coach_id || null,
    cap: session.capacity ?? ct?.capacity ?? 0,
    booked: sessionBookingCount(store, session.id),
    members,
  };
}

function matchesFilter(card: GymPlanClass, opts?: GymPlanFilter): boolean {
  if (opts?.classId && card.classTypeId !== opts.classId) return false;
  const status = String(opts?.status || '').trim();
  if (status && !card.members.some((m) => m.status === status)) return false;
  const needle = String(opts?.memberQ || '')
    .trim()
    .toLowerCase();
  if (!needle) return true;
  if (card.className.toLowerCase().includes(needle)) return true;
  if (card.coachName.toLowerCase().includes(needle)) return true;
  return card.members.some((m) =>
    `${m.name} ${m.code} ${m.status}`.toLowerCase().includes(needle)
  );
}

function visibleMembers(
  card: GymPlanClass,
  opts?: GymPlanFilter
): GymPlanMember[] {
  const status = String(opts?.status || '').trim();
  const needle = String(opts?.memberQ || '')
    .trim()
    .toLowerCase();
  return card.members.filter((m) => {
    if (status && m.status !== status) return false;
    if (!needle) return true;
    if (card.className.toLowerCase().includes(needle)) return true;
    if (card.coachName.toLowerCase().includes(needle)) return true;
    return `${m.name} ${m.code} ${m.status}`.toLowerCase().includes(needle);
  });
}

export function gymPlanClassesOnDate(
  store: FitgraphStore,
  date: string,
  opts?: GymPlanFilter
): GymPlanClass[] {
  const day = String(date || '').slice(0, 10);
  return (store.sessions || [])
    .filter((s) => s.date === day && isGymPlanSession(store, s))
    .sort(
      (a, b) =>
        String(a.start_time || '').localeCompare(String(b.start_time || '')) ||
        String(a.id).localeCompare(String(b.id))
    )
    .map((s) => gymPlanClass(store, s))
    .filter((card) => matchesFilter(card, opts))
    .map((card) => ({ ...card, members: visibleMembers(card, opts) }));
}

export function gymPlanWeekDays(
  hours: WorkingHours | null | undefined,
  weekStartMonday: string,
  extraDates?: Iterable<string>
): Omit<GymPlanDay, 'classes'>[] {
  const extra = new Set(
    [...(extraDates || [])].map((d) => String(d).slice(0, 10))
  );
  const start = String(weekStartMonday || '').slice(0, 10);
  const build = (date: string) => {
    const oc = openCloseOn(hours, date);
    const heading = gymPlanDayHeading(date);
    return {
      date,
      weekday: heading.weekday,
      label: heading.label,
      short: heading.short,
      dateLabel: heading.dateLabel,
      hoursLabel: oc.closed ? 'Closed' : `${oc.open}–${oc.close}`,
      closed: oc.closed === true,
    };
  };
  const days: Omit<GymPlanDay, 'classes'>[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDaysIso(start, i);
    const oc = openCloseOn(hours, date);
    if (oc.closed === true && !extra.has(date)) continue;
    days.push(build(date));
  }
  if (!days.length) {
    for (let i = 0; i < 7; i += 1) days.push(build(addDaysIso(start, i)));
  }
  return days;
}

export function gymPlanWeek(
  store: FitgraphStore,
  hours: WorkingHours | null | undefined,
  weekStartMonday: string,
  opts?: GymPlanFilter
): GymPlanDay[] {
  const start = gymPlanMonday(weekStartMonday);
  const end = addDaysIso(start, 6);
  const classDates = (store.sessions || [])
    .filter(
      (s) =>
        s.date >= start && s.date <= end && isGymPlanSession(store, s)
    )
    .map((s) => s.date);
  return gymPlanWeekDays(hours, start, classDates).map((day) => ({
    ...day,
    classes: gymPlanClassesOnDate(store, day.date, opts),
  }));
}
