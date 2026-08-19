/**
 * Upcoming member birthdays and gym membership anniversaries.
 */
import { ageFromDob, memberBirthday } from '@/lib/fitness/member-profile';
import type { FitClient, FitgraphStore } from '@/lib/fitness/fitgraph';

export const SPECIAL_DATE_KINDS = [
  'birthday',
  'membership_anniversary',
  'joined',
] as const;
export type MemberSpecialDateKind = (typeof SPECIAL_DATE_KINDS)[number];

export type MemberSpecialDate = {
  id: string;
  client_id: string;
  name: string;
  kind: MemberSpecialDateKind;
  /** YYYY-MM-DD this occurrence (today or upcoming). */
  on: string;
  /** Original date (DOB or membership start). */
  since: string;
  days_until: number;
  years?: number | null;
  coach_id?: string | null;
  label: string;
};

export type SpecialDatePerson = Pick<
  FitClient,
  | 'id'
  | 'name'
  | 'date_of_birth'
  | 'start_date'
  | 'coach_id'
  | 'active'
  | 'passport'
  | 'medical'
> & {
  /** Desk records always have this; Command hub payloads may omit it. */
  created_at?: string;
};

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayDiff(from: string, to: string): number {
  const a = Date.parse(`${from}T12:00:00.000Z`);
  const b = Date.parse(`${to}T12:00:00.000Z`);
  return Math.round((b - a) / 86400000);
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Next MM-DD on or after `from` (Feb 29 → Feb 28 in non-leap years). */
export function nextMonthDayOccurrence(
  monthDay: string,
  fromIso: string
): string | null {
  const md = String(monthDay || '').slice(0, 5);
  if (!/^\d{2}-\d{2}$/.test(md)) return null;
  let mm = Number(md.slice(0, 2));
  let dd = Number(md.slice(3, 5));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const fromYear = Number(fromIso.slice(0, 4));
  const pin = (year: number) => {
    let d = dd;
    if (mm === 2 && d === 29 && !isLeap(year)) d = 28;
    return `${year}-${String(mm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };
  let candidate = pin(fromYear);
  if (candidate < fromIso) candidate = pin(fromYear + 1);
  return candidate;
}

export function membershipStartDate(c: SpecialDatePerson): string | null {
  const start = String(c.start_date || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) return start;
  const created = String(c.created_at || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(created) ? created : null;
}

export function specialDateLabel(row: MemberSpecialDate): string {
  if (row.kind === 'birthday') {
    return row.years != null
      ? `Birthday · turns ${row.years}`
      : 'Birthday';
  }
  if (row.kind === 'membership_anniversary') {
    return row.years != null
      ? `Gym anniversary · ${row.years} year${row.years === 1 ? '' : 's'}`
      : 'Gym anniversary';
  }
  if (row.days_until === 0) return 'Joined the gym today';
  if (row.days_until < 0) {
    const ago = Math.abs(row.days_until);
    return `Joined ${ago} day${ago === 1 ? '' : 's'} ago`;
  }
  return 'New member';
}

export function clientIdsForCoach(
  store: Pick<FitgraphStore, 'clients' | 'sessions' | 'bookings'>,
  coachId: string
): Set<string> {
  const ids = new Set<string>();
  for (const c of store.clients || []) {
    if (c.active === false) continue;
    if (c.coach_id === coachId) ids.add(c.id);
  }
  const sessionIds = new Set(
    (store.sessions || [])
      .filter((s) => s.coach_id === coachId && s.status !== 'cancelled')
      .map((s) => s.id)
  );
  for (const b of store.bookings || []) {
    if (b.status === 'cancelled') continue;
    if (sessionIds.has(b.session_id) && b.client_id) ids.add(b.client_id);
  }
  return ids;
}

export function memberSpecialDates(
  people: SpecialDatePerson[],
  opts?: {
    from?: string;
    days?: number;
    coachId?: string | null;
    coachClientIds?: Set<string> | string[];
  }
): MemberSpecialDate[] {
  const from = (opts?.from || new Date().toISOString()).slice(0, 10);
  const windowDays = opts?.days ?? 14;
  const until = addDays(from, windowDays);
  const coachFilter = opts?.coachClientIds
    ? opts.coachClientIds instanceof Set
      ? opts.coachClientIds
      : new Set(opts.coachClientIds)
    : null;
  const out: MemberSpecialDate[] = [];

  for (const c of people) {
    if (c.active === false) continue;
    if (opts?.coachId && c.coach_id !== opts.coachId && !coachFilter) continue;
    if (coachFilter && !coachFilter.has(c.id)) continue;

    const dob = memberBirthday(c as FitClient);
    if (dob) {
      const on = nextMonthDayOccurrence(dob.slice(5, 10), from);
      if (on && on <= until) {
        const years = ageFromDob(dob, on);
        const row: MemberSpecialDate = {
          id: `bday-${c.id}-${on}`,
          client_id: c.id,
          name: c.name,
          kind: 'birthday',
          on,
          since: dob,
          days_until: dayDiff(from, on),
          years,
          coach_id: c.coach_id || null,
          label: '',
        };
        row.label = specialDateLabel(row);
        out.push(row);
      }
    }

    const start = membershipStartDate(c);
    if (start && start <= from) {
      const yearsSoFar = ageFromDob(start, from) || 0;
      if (yearsSoFar >= 1) {
        const on = nextMonthDayOccurrence(start.slice(5, 10), from);
        if (on && on <= until) {
          const years = ageFromDob(start, on);
          const row: MemberSpecialDate = {
            id: `ann-${c.id}-${on}`,
            client_id: c.id,
            name: c.name,
            kind: 'membership_anniversary',
            on,
            since: start,
            days_until: dayDiff(from, on),
            years,
            coach_id: c.coach_id || null,
            label: '',
          };
          row.label = specialDateLabel(row);
          out.push(row);
        }
      } else {
        const joinedAgo = dayDiff(start, from);
        if (joinedAgo >= 0 && joinedAgo <= 7) {
          const row: MemberSpecialDate = {
            id: `join-${c.id}-${start}`,
            client_id: c.id,
            name: c.name,
            kind: 'joined',
            on: start,
            since: start,
            days_until: -joinedAgo,
            years: 0,
            coach_id: c.coach_id || null,
            label: '',
          };
          row.label = specialDateLabel(row);
          out.push(row);
        }
      }
    }
  }

  return out.sort((a, b) => {
    const aJoin = a.kind === 'joined' ? 1 : 0;
    const bJoin = b.kind === 'joined' ? 1 : 0;
    if (aJoin !== bJoin) return aJoin - bJoin;
    const aDays = a.kind === 'joined' ? Math.abs(a.days_until) : a.days_until;
    const bDays = b.kind === 'joined' ? Math.abs(b.days_until) : b.days_until;
    return aDays - bDays || a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind);
  });
}

export function memberSpecialDatesForStore(
  store: Pick<FitgraphStore, 'clients' | 'sessions' | 'bookings'>,
  opts?: { from?: string; days?: number; coachId?: string | null }
): MemberSpecialDate[] {
  const coachIds =
    opts?.coachId
      ? clientIdsForCoach(store, opts.coachId)
      : undefined;
  return memberSpecialDates(store.clients || [], {
    from: opts?.from,
    days: opts?.days,
    coachClientIds: coachIds,
  });
}
