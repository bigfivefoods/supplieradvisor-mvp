/**
 * Upcoming member birthdays and gym membership anniversaries.
 * MedicalAdvisor patients use the same shape: medical.date_of_birth,
 * start_date, and created_at. Pass place: 'practice' for patient wording.
 */
import { relationshipLabel } from '@/lib/services/family-members';
import { ageFromDob, memberBirthday } from '@/lib/fitness/member-profile';
import type { FitClient, FitgraphStore } from '@/lib/fitness/fitgraph';

export const SPECIAL_DATE_KINDS = [
  'birthday',
  'membership_anniversary',
  'joined',
] as const;
export type MemberSpecialDateKind = (typeof SPECIAL_DATE_KINDS)[number];

/** Gym copy stays the default so the hub and coach diary do not change. */
export type SpecialDatePlace = 'gym' | 'practice';

export const SPECIAL_DATE_WINDOW_IDS = [
  '14',
  '30',
  '90',
  'month',
  'year',
] as const;
export type SpecialDateWindowId = (typeof SPECIAL_DATE_WINDOW_IDS)[number];

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
  /** Household member listed on the primary profile. */
  household?: boolean;
  label: string;
};

export type SpecialDateHousehold = {
  id: string;
  name: string;
  relationship?: string | null;
  date_of_birth?: string | null;
  active?: boolean;
};

/** Subset used for birthdays / anniversaries. Command hub sends this without created_at. */
export type SpecialDatePerson = {
  id: string;
  name: string;
  date_of_birth?: string | null;
  start_date?: string | null;
  created_at?: string | null;
  coach_id?: string | null;
  active?: boolean;
  /** Profile to open. Household rows point at the primary member or patient. */
  record_id?: string | null;
  passport?: { date_of_birth?: string | null } | null;
  medical?: { date_of_birth?: string | null } | null;
  family?: SpecialDateHousehold[] | null;
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

export function specialDateLabel(
  row: MemberSpecialDate,
  place: SpecialDatePlace = 'gym'
): string {
  if (row.kind === 'birthday') {
    return row.years != null
      ? `Birthday · turns ${row.years}`
      : 'Birthday';
  }
  if (row.kind === 'membership_anniversary') {
    const noun = place === 'practice' ? 'Patient anniversary' : 'Gym anniversary';
    return row.years != null
      ? `${noun} · ${row.years} year${row.years === 1 ? '' : 's'}`
      : noun;
  }
  if (row.days_until === 0) {
    return place === 'practice'
      ? 'Joined the practice today'
      : 'Joined the gym today';
  }
  if (row.days_until < 0) {
    const ago = Math.abs(row.days_until);
    return `Joined ${ago} day${ago === 1 ? '' : 's'} ago`;
  }
  return place === 'practice' ? 'New patient' : 'New member';
}

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
];

/** Desk day in Africa/Johannesburg (YYYY-MM-DD). */
export function specialDateToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  if (y && m && d) return `${y}-${m}-${d}`;
  return now.toISOString().slice(0, 10);
}

/** Days ahead of `from` that the report window includes, matching addDays + `on <= until`. */
export function specialDateWindowDays(
  id: SpecialDateWindowId,
  fromIso: string
): number {
  if (id === '14') return 14;
  if (id === '30') return 30;
  if (id === '90') return 90;
  if (id === 'year') return 366;
  const y = Number(fromIso.slice(0, 4));
  const m = Number(fromIso.slice(5, 7));
  const d = Number(fromIso.slice(8, 10));
  if (!y || m < 1 || m > 12 || d < 1) return 30;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Math.max(0, last - d);
}

export function formatSpecialDate(iso: string): string {
  const raw = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const month = MONTHS[Number(raw.slice(5, 7)) - 1];
  if (!month) return raw;
  return `${Number(raw.slice(8, 10))} ${month} ${raw.slice(0, 4)}`;
}

export function specialDateMonthLabel(iso: string): string {
  const raw = String(iso || '').slice(0, 10);
  const month = MONTHS[Number(raw.slice(5, 7)) - 1];
  if (!month) return raw;
  return `${month} ${raw.slice(0, 4)}`;
}

export function specialDateWhen(row: MemberSpecialDate): string {
  if (row.kind === 'joined') {
    if (row.days_until === 0) return 'Today';
    const n = Math.abs(row.days_until);
    return n === 1 ? 'Yesterday' : `${n} days ago`;
  }
  if (row.days_until === 0) return 'Today';
  if (row.days_until === 1) return 'Tomorrow';
  return `In ${row.days_until} days`;
}

export function specialDateKindLabel(
  kind: MemberSpecialDateKind,
  place: SpecialDatePlace = 'gym'
): string {
  if (kind === 'birthday') return 'Birthday';
  if (kind === 'membership_anniversary') {
    return place === 'practice' ? 'Patient anniversary' : 'Gym anniversary';
  }
  return 'New';
}

function validIsoDate(value: unknown): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10));
}

/** Active people and household members with no usable date of birth. */
export function missingBirthdayCount(people: SpecialDatePerson[]): {
  people: number;
  household: number;
} {
  let peopleN = 0;
  let household = 0;
  for (const person of people) {
    if (person.active === false) continue;
    if (!memberBirthday(person as FitClient)) peopleN += 1;
    for (const member of person.family || []) {
      if (member.active === false) continue;
      if (!String(member.name || '').trim()) continue;
      if (!validIsoDate(member.date_of_birth)) household += 1;
    }
  }
  return { people: peopleN, household };
}

export function withHouseholdBirthdays(
  people: SpecialDatePerson[]
): SpecialDatePerson[] {
  const out: SpecialDatePerson[] = [];
  for (const person of people) {
    out.push(person);
    if (person.active === false) continue;
    for (const member of person.family || []) {
      if (member.active === false) continue;
      const name = String(member.name || '').trim();
      if (!name || !member.id) continue;
      const rel = relationshipLabel(member.relationship || undefined);
      out.push({
        id: member.id,
        record_id: person.record_id || person.id,
        name: `${name} · ${rel} of ${person.name}`,
        date_of_birth: member.date_of_birth,
        active: true,
        coach_id: person.coach_id || null,
      });
    }
  }
  return out;
}

function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function specialDatesCsv(
  rows: MemberSpecialDate[],
  opts?: {
    place?: SpecialDatePlace;
    assigneeHeader?: string;
    assigneeNames?: Record<string, string>;
  }
): string {
  const place = opts?.place || 'gym';
  const assigneeHeader = opts?.assigneeHeader || 'Coach';
  const headers = [
    'Name',
    'Kind',
    'Occasion',
    'When',
    'Date',
    'Years',
    'Since',
    assigneeHeader,
  ];
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((row) =>
      [
        row.name,
        specialDateKindLabel(row.kind, place),
        row.label,
        specialDateWhen(row),
        row.on,
        row.years ?? '',
        row.since,
        row.coach_id ? opts?.assigneeNames?.[row.coach_id] || '' : '',
      ]
        .map(csvCell)
        .join(',')
    ),
  ];
  return '\uFEFF' + lines.join('\n');
}

export function downloadSpecialDatesCsv(filename: string, csv: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
    place?: SpecialDatePlace;
    /** Report passes true. The 14-day hub leaves this off. */
    includeHousehold?: boolean;
    /** Omit to keep birthdays, anniversaries, and recent joiners. */
    kinds?: MemberSpecialDateKind[];
  }
): MemberSpecialDate[] {
  const from = (opts?.from || new Date().toISOString()).slice(0, 10);
  const windowDays = opts?.days ?? 14;
  const until = addDays(from, windowDays);
  const place = opts?.place || 'gym';
  const kindSet = opts?.kinds ? new Set(opts.kinds) : null;
  const coachFilter = opts?.coachClientIds
    ? opts.coachClientIds instanceof Set
      ? opts.coachClientIds
      : new Set(opts.coachClientIds)
    : null;
  const list = opts?.includeHousehold
    ? withHouseholdBirthdays(people)
    : people;
  const out: MemberSpecialDate[] = [];

  for (const c of list) {
    if (c.active === false) continue;
    if (opts?.coachId && c.coach_id !== opts.coachId && !coachFilter) continue;
    const recordId = c.record_id || c.id;
    if (
      coachFilter &&
      !coachFilter.has(c.id) &&
      !coachFilter.has(recordId)
    ) {
      continue;
    }
    const household = Boolean(c.record_id && c.record_id !== c.id);

    const dob = memberBirthday(c as FitClient);
    if (!kindSet || kindSet.has('birthday')) {
      if (dob) {
        const on = nextMonthDayOccurrence(dob.slice(5, 10), from);
        if (on && on <= until) {
          const years = ageFromDob(dob, on);
          const row: MemberSpecialDate = {
            id: `bday-${c.id}-${on}`,
            client_id: recordId,
            name: c.name,
            kind: 'birthday',
            on,
            since: dob,
            days_until: dayDiff(from, on),
            years,
            coach_id: c.coach_id || null,
            household,
            label: '',
          };
          row.label = specialDateLabel(row, place);
          out.push(row);
        }
      }
    }

    if (household) continue;

    const start = membershipStartDate(c);
    if (start && start <= from) {
      const on = nextMonthDayOccurrence(start.slice(5, 10), from);
      const yearsOn = on ? ageFromDob(start, on) : null;
      // Age is taken on the anniversary date, so a first anniversary later this month still shows.
      if (
        on &&
        on <= until &&
        yearsOn != null &&
        yearsOn >= 1 &&
        (!kindSet || kindSet.has('membership_anniversary'))
      ) {
        const row: MemberSpecialDate = {
          id: `ann-${c.id}-${on}`,
          client_id: recordId,
          name: c.name,
          kind: 'membership_anniversary',
          on,
          since: start,
          days_until: dayDiff(from, on),
          years: yearsOn,
          coach_id: c.coach_id || null,
          label: '',
        };
        row.label = specialDateLabel(row, place);
        out.push(row);
      } else if (!kindSet || kindSet.has('joined')) {
        const yearsSoFar = ageFromDob(start, from) || 0;
        const joinedAgo = dayDiff(start, from);
        if (yearsSoFar < 1 && joinedAgo >= 0 && joinedAgo <= 7) {
          const row: MemberSpecialDate = {
            id: `join-${c.id}-${start}`,
            client_id: recordId,
            name: c.name,
            kind: 'joined',
            on: start,
            since: start,
            days_until: -joinedAgo,
            years: 0,
            coach_id: c.coach_id || null,
            label: '',
          };
          row.label = specialDateLabel(row, place);
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
  opts?: {
    from?: string;
    days?: number;
    coachId?: string | null;
    place?: SpecialDatePlace;
    includeHousehold?: boolean;
    kinds?: MemberSpecialDateKind[];
  }
): MemberSpecialDate[] {
  const coachIds =
    opts?.coachId
      ? clientIdsForCoach(store, opts.coachId)
      : undefined;
  return memberSpecialDates(store.clients || [], {
    from: opts?.from,
    days: opts?.days,
    coachClientIds: coachIds,
    place: opts?.place,
    includeHousehold: opts?.includeHousehold,
    kinds: opts?.kinds,
  });
}
