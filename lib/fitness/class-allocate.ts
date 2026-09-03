/**
 * Desk: allocate a member to a class at a charged rate, and put a class
 * on the gym calendar (with repeats) so subscribers appear on those dates.
 */
import {
  addDaysIso,
  createSessionsFromTemplate,
  newId,
  sessionBookingCount,
  weekdayOf,
  type CoachSessionCard,
  type FitClient,
  type FitgraphStore,
  type FitMembershipPlan,
  type FitRecurrence,
  type FitSession,
  type FitSubscription,
  subscriptionChargeZar,
} from '@/lib/fitness/fitgraph';
import {
  endFromStartDuration,
  resolveSessionTimes,
} from '@/lib/fitness/session-times';
import {
  activeClassSubscriptions,
  catalogSlotForSession,
  memberMayBookSession,
  planCoversSession,
  subscribersForSession,
  timetableSlotsForPlan,
} from '@/lib/fitness/vuka-class-catalog';
import {
  findSessionSeat,
  pickPreferredBooking,
} from '@/lib/fitness/gym-bookings';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_RE: Array<{ re: RegExp; d: number }> = [
  { re: /\bmon(?:day)?\b/i, d: 1 },
  { re: /\btue(?:s(?:day)?)?\b/i, d: 2 },
  { re: /\bwed(?:nesday)?\b/i, d: 3 },
  { re: /\bthu(?:rs(?:day)?)?\b/i, d: 4 },
  { re: /\bfri(?:day)?\b/i, d: 5 },
  { re: /\bsat(?:urday)?\b/i, d: 6 },
  { re: /\bsun(?:day)?\b/i, d: 0 },
];

export function parseBilledZar(notes?: string | null): number | null {
  const m = String(notes || '').match(/R\s*([\d]+(?:[.,]\d+)?)\s*\/pm/i);
  if (!m) return null;
  const n = Number(String(m[1]).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function formatZarPm(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return `R${n.toFixed(2)}/pm`;
}

export function applyChargedNote(
  notes: string | undefined | null,
  amount: number
): string {
  const label = formatZarPm(amount);
  const raw = String(notes || '').trim();
  if (!raw) return `Charged ${label}`;
  if (/R\s*[\d]+(?:[.,]\d+)?\s*\/pm/i.test(raw)) {
    return raw.replace(/R\s*[\d]+(?:[.,]\d+)?\s*\/pm/i, label);
  }
  return `${raw} · ${label}`;
}

export function formatClockLabel(hhmm: string): string {
  const [hRaw, mRaw] = String(hhmm || '00:00').slice(0, 5).split(':');
  let h = Number(hRaw) || 0;
  const m = Number(mRaw) || 0;
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return m ? `${h}:${String(m).padStart(2, '0')}${ap}` : `${h}:00${ap}`;
}

export function formatScheduleLabel(
  startTime: string,
  recurrence: FitRecurrence | null | undefined,
  startDate?: string
): string {
  const clock = formatClockLabel(startTime);
  const freq = recurrence?.frequency || 'none';
  if (freq === 'daily') return `Daily · ${clock}`;
  if (freq === 'monthly') return `Monthly · ${clock}`;
  if (freq === 'weekly') {
    const days = (
      recurrence?.weekdays?.length
        ? recurrence.weekdays
        : startDate
          ? [weekdayOf(startDate)]
          : []
    )
      .slice()
      .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
    const names = days.map((d) => DAY_SHORT[d] || '').filter(Boolean);
    return names.length ? `${clock} ${names.join(' / ')}` : clock;
  }
  return startDate ? `${startDate} · ${clock}` : clock;
}

export function parseScheduleHint(label?: string | null): {
  start_time: string | null;
  weekdays: number[];
  daily: boolean;
} {
  const raw = String(label || '');
  const time = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  let start_time: string | null = null;
  if (time) {
    let h = Number(time[1]) || 0;
    const m = Number(time[2] || 0);
    const ap = String(time[3] || '').toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    start_time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const weekdays: number[] = [];
  for (const { re, d } of DAY_RE) {
    if (re.test(raw) && !weekdays.includes(d)) weekdays.push(d);
  }
  return {
    start_time,
    weekdays,
    daily: /\bdaily\b/i.test(raw),
  };
}

export function nextDateForWeekdays(
  weekdays: number[],
  fromIso: string
): string {
  for (let i = 0; i < 14; i += 1) {
    const d = addDaysIso(fromIso, i);
    if (!weekdays.length || weekdays.includes(weekdayOf(d))) return d;
  }
  return fromIso;
}

export function classTypeIdForPlan(
  store: FitgraphStore,
  plan: FitMembershipPlan
): string | null {
  const ids = plan.class_type_ids || [];
  const hit = ids.find((id) => store.class_types.some((c) => c.id === id));
  if (hit) return hit;
  const byCode = store.class_types.find(
    (c) => c.code === plan.code && c.active !== false
  );
  return byCode?.id || null;
}

export type SuggestedClassSchedule = {
  class_type_id: string | null;
  start_time: string;
  end_time: string;
  duration_min: number;
  weekdays: number[];
  frequency: FitRecurrence['frequency'];
  location: string;
  capacity: number | null;
  public: boolean;
};

export function suggestClassSchedule(
  store: FitgraphStore,
  plan: FitMembershipPlan
): SuggestedClassSchedule {
  const slots = timetableSlotsForPlan(plan);
  const slot = slots[0];
  const hint = parseScheduleHint(plan.schedule_label);
  const start =
    slot?.start_time || hint.start_time || '06:00';
  const duration =
    slot?.duration_min ||
    store.class_types.find((c) => c.id === (plan.class_type_ids || [])[0])
      ?.default_duration_min ||
    60;
  const weekdays =
    slots.length === 1
      ? [...slot!.weekdays]
      : hint.weekdays.length
        ? hint.weekdays
        : slots.length
          ? [...new Set(slots.flatMap((s) => s.weekdays))]
          : [];
  const frequency: FitRecurrence['frequency'] = hint.daily
    ? 'daily'
    : weekdays.length
      ? 'weekly'
      : 'none';
  return {
    class_type_id: classTypeIdForPlan(store, plan),
    start_time: start,
    end_time: endFromStartDuration(start, duration),
    duration_min: duration,
    weekdays,
    frequency,
    location: plan.location || slot?.location || '',
    capacity: slot?.capacity ?? null,
    public: slot ? slot.public !== false : true,
  };
}

export type SessionRosterRow = {
  booking_id: string;
  client_id: string;
  name: string;
  status: string;
  rsvp: 'coming' | 'not_coming' | null;
  coach_feedback: string | null;
};

/** Names on a class: booked people plus members saved to that class. */
export function sessionRosterRows(
  store: FitgraphStore,
  sessionId: string
): SessionRosterRow[] {
  const session = store.sessions.find((s) => s.id === sessionId);
  const rows: SessionRosterRow[] = [];
  const seen = new Set<string>();
  const bySeat = new Map<string, (typeof store.bookings)[number]>();
  for (const b of store.bookings || []) {
    if (b.session_id !== sessionId) continue;
    if (b.status === 'cancelled' && b.rsvp !== 'not_coming') continue;
    const prev = bySeat.get(b.client_id);
    bySeat.set(b.client_id, prev ? pickPreferredBooking(prev, b) : b);
  }
  for (const b of bySeat.values()) {
    const cl = store.clients.find((c) => c.id === b.client_id);
    const name = b.family_member_name || cl?.name || b.guest_name || '';
    if (!name) continue;
    seen.add(b.client_id);
    rows.push({
      booking_id: b.id,
      client_id: b.client_id,
      name,
      status: b.status,
      rsvp: b.rsvp || null,
      coach_feedback: b.coach_feedback || null,
    });
  }
  if (session) {
    for (const row of subscribersForSession(store, session)) {
      if (seen.has(row.client.id)) continue;
      const prior = (store.bookings || []).find(
        (b) => b.session_id === sessionId && b.client_id === row.client.id
      );
      seen.add(row.client.id);
      rows.push({
        booking_id:
          prior?.id ||
          row.booking?.id ||
          `alloc_${session.id}_${row.client.id}`,
        client_id: row.client.id,
        name: row.client.name,
        status: prior?.status || row.booking?.status || 'booked',
        rsvp: prior?.rsvp || row.booking?.rsvp || null,
        coach_feedback: prior?.coach_feedback || row.booking?.coach_feedback || null,
      });
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export function sessionRosterNames(
  store: FitgraphStore,
  sessionId: string
): string[] {
  return sessionRosterRows(store, sessionId).map((r) => r.name);
}

export function upcomingSessionsForPlan(
  store: FitgraphStore,
  plan: FitMembershipPlan,
  fromIso: string
): FitSession[] {
  return (store.sessions || [])
    .filter(
      (s) =>
        s.status === 'scheduled' &&
        s.date >= fromIso &&
        (!s.session_kind || s.session_kind === 'class') &&
        planCoversSession(plan, s, store)
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)
    );
}

/** Sessions this member is allocated to, including those without a booking row. */
export function memberAllocatedUpcomingSessions(
  store: FitgraphStore,
  clientId: string,
  fromIso: string,
  toIso: string
): FitSession[] {
  const plans = (store.subscriptions || [])
    .filter(
      (s) =>
        s.client_id === clientId &&
        (s.status === 'active' || s.status === 'trialing')
    )
    .map((s) => store.membership_plans.find((p) => p.id === s.plan_id))
    .filter((p): p is FitMembershipPlan => Boolean(p && p.active !== false));
  if (!plans.length) return [];
  const booked = new Set(
    (store.bookings || [])
      .filter(
        (b) =>
          b.client_id === clientId &&
          b.status !== 'cancelled'
      )
      .map((b) => b.session_id)
  );
  return (store.sessions || [])
    .filter((s) => {
      if (s.status !== 'scheduled') return false;
      if (s.session_kind && s.session_kind !== 'class') return false;
      if (s.date < fromIso || s.date > toIso) return false;
      if (booked.has(s.id)) return false;
      return plans.some((p) => planCoversSession(p, s, store));
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)
    );
}

export function calendarCoverage(
  store: FitgraphStore,
  plan: FitMembershipPlan,
  fromIso: string
): { count: number; next: FitSession | null; coachNames: string[] } {
  if (plan.unlocks_all_classes) {
    return { count: 0, next: null, coachNames: [] };
  }
  const matching = (store.sessions || []).filter(
    (s) => s.status !== 'cancelled' && planCoversSession(plan, s, store)
  );
  const upcoming = matching
    .filter((s) => s.status === 'scheduled' && s.date >= fromIso)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)
    );
  const coachNames: string[] = [];
  const seen = new Set<string>();
  const addCoach = (id: string | null | undefined) => {
    const key = String(id || '');
    if (!key || seen.has(key)) return;
    seen.add(key);
    const name = store.coaches.find((c) => c.id === key)?.name;
    if (name) coachNames.push(name);
  };
  addCoach(plan.default_coach_id);
  for (const s of matching) addCoach(s.coach_id);
  coachNames.sort((a, b) => a.localeCompare(b));
  return {
    count: upcoming.length,
    next: upcoming[0] || null,
    coachNames,
  };
}

export function bookDeskMemberOntoSession(
  store: FitgraphStore,
  session: FitSession,
  client: FitClient,
  now: string,
  opts?: { force?: boolean }
): 'booked' | 'waitlist' | 'skipped' {
  const seat = findSessionSeat(store, session.id, client.id);
  if (seat && seat.status !== 'cancelled') return 'skipped';
  if (!opts?.force) {
    const gate = memberMayBookSession(store, client, session, {
      ignoreDebitBank: true,
    });
    if (!gate.ok) return 'skipped';
  }
  const cap = session.capacity;
  const count = sessionBookingCount(store, session.id);
  const status =
    cap != null && cap > 0 && count >= cap ? 'waitlist' : 'booked';
  if (seat) {
    seat.status = status;
    seat.updated_at = now;
    if (!seat.booked_at) seat.booked_at = now;
    seat.source = seat.source || 'desk';
    return status;
  }
  store.bookings.push({
    id: newId('bkg'),
    session_id: session.id,
    client_id: client.id,
    status,
    booked_at: now,
    updated_at: now,
    source: 'desk',
  });
  return status;
}

/** Book a private-PT member onto sessions and optionally stamp their agreed rate.
 * Desk-only — does not hit CRM / wallet. */
export function applyPrivatePtBooking(
  store: FitgraphStore,
  opts: {
    sessionIds: string[];
    clientId: string;
    now: string;
    rateZar?: number | null;
  }
): { added: number; skipped: number } {
  const client = store.clients.find((c) => c.id === opts.clientId);
  if (!client) {
    return { added: 0, skipped: opts.sessionIds.length };
  }
  let added = 0;
  let skipped = 0;
  for (const id of opts.sessionIds) {
    const session = store.sessions.find((s) => s.id === id);
    if (!session) {
      skipped += 1;
      continue;
    }
    const result = bookDeskMemberOntoSession(store, session, client, opts.now, {
      force: true,
    });
    if (result === 'skipped') skipped += 1;
    else added += 1;
  }
  if (opts.rateZar != null && Number.isFinite(Number(opts.rateZar))) {
    client.private_rate_zar = Number(opts.rateZar);
    client.updated_at = opts.now;
  }
  return { added, skipped };
}

/** Turn a one-off (or singleton) diary row into a repeating series. Keeps the original. */
export function expandSessionToSeries(
  store: FitgraphStore,
  opts: {
    sessionId: string;
    recurrence: FitRecurrence;
    now: string;
  }
): { added: number; seriesId: string | null; created: FitSession[] } {
  const session = store.sessions.find((s) => s.id === opts.sessionId);
  if (!session || !opts.recurrence || opts.recurrence.frequency === 'none') {
    return { added: 0, seriesId: session?.series_id || null, created: [] };
  }
  const seriesId = String(session.series_id || '').trim() || newId('ser');
  const created = createSessionsFromTemplate(
    store,
    {
      class_type_id: session.class_type_id,
      coach_id: session.coach_id || null,
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time ?? null,
      duration_min: session.duration_min ?? null,
      session_kind: session.session_kind,
      personal_reason: session.personal_reason,
      capacity: session.capacity ?? null,
      location: session.location,
      room: session.room ?? null,
      agreed_rate_zar: session.agreed_rate_zar ?? null,
      public: session.public === true,
      notes: session.notes,
      public_notes: session.public_notes,
      class_plan: session.class_plan,
      origin: 'series',
      programme_id: session.programme_id ?? null,
      shared_coach_ids: session.shared_coach_ids ?? null,
      series_id: seriesId,
    },
    opts.recurrence,
    opts.now
  );
  const existing = new Set(
    (store.sessions || [])
      .filter((s) => s.status !== 'cancelled')
      .map(sessionKey)
  );
  const fresh = created.filter(
    (s) => s.date !== session.date && !existing.has(sessionKey(s))
  );
  session.series_id = seriesId;
  if (!session.origin || session.origin === 'one_off') {
    session.origin = 'series';
  }
  if (!fresh.length) {
    return { added: 0, seriesId, created: [] };
  }
  store.sessions.push(...fresh);
  const members = (store.bookings || []).filter(
    (b) => b.session_id === session.id && b.status !== 'cancelled'
  );
  for (const b of members) {
    const client = store.clients.find((c) => c.id === b.client_id);
    if (!client) continue;
    for (const row of fresh) {
      bookDeskMemberOntoSession(store, row, client, opts.now, { force: true });
    }
  }
  stampCatalogSeriesAndBookSubscribers(store, [session, ...fresh], opts.now);
  return {
    added: fresh.length,
    seriesId: session.series_id || seriesId,
    created: fresh,
  };
}

function bookMemberOntoUpcoming(
  store: FitgraphStore,
  client: FitClient,
  plan: FitMembershipPlan,
  fromIso: string,
  now: string
): number {
  let n = 0;
  for (const session of upcomingSessionsForPlan(store, plan, fromIso)) {
    const result = bookDeskMemberOntoSession(store, session, client, now, {
      force: true,
    });
    if (result === 'booked' || result === 'waitlist') n += 1;
  }
  return n;
}

export function liveNonAddonClassSubs(
  store: FitgraphStore,
  clientId: string
): Array<{ sub: FitSubscription; plan: FitMembershipPlan }> {
  return activeClassSubscriptions(store, clientId).filter(
    (x) => x.plan.addon !== true
  );
}

export function recomputeClientClassDenorm(
  store: FitgraphStore,
  clientId: string,
  now?: string
): void {
  const client = store.clients.find((c) => c.id === clientId);
  if (!client) return;
  const live = liveNonAddonClassSubs(store, clientId);
  client.membership_plan_id = live[0]?.plan.id || null;
  const sum = live.reduce(
    (n, x) => n + subscriptionChargeZar(x.sub, x.plan),
    0
  );
  client.agreed_rate_zar = sum;
  if (live.length) {
    client.notes = applyChargedNote(client.notes, sum);
    if (client.active !== false) {
      const st = live[0].sub.status;
      client.membership_status =
        st === 'trialing' ? 'trial' : st === 'active' ? 'active' : 'active';
    }
  }
  client.updated_at = now || new Date().toISOString();
}

export function cancelUncoveredFutureBookings(
  store: FitgraphStore,
  client: FitClient,
  today: string
): number {
  let n = 0;
  for (const b of store.bookings || []) {
    if (b.client_id !== client.id) continue;
    if (
      b.status === 'cancelled' ||
      b.status === 'attended' ||
      b.status === 'no_show'
    ) {
      continue;
    }
    const session = store.sessions.find((s) => s.id === b.session_id);
    if (!session || session.status === 'cancelled') continue;
    if (session.date < today) continue;
    const covering = activeClassSubscriptions(store, client.id).some((x) =>
      planCoversSession(x.plan, session, store)
    );
    if (covering) continue;
    b.status = 'cancelled';
    n += 1;
  }
  return n;
}

function syncMemberClassBookings(
  store: FitgraphStore,
  client: FitClient,
  today: string,
  now: string,
  bookUpcoming: boolean
): number {
  cancelUncoveredFutureBookings(store, client, today);
  if (!bookUpcoming || client.active === false) return 0;
  let n = 0;
  const seen = new Set<string>();
  for (const x of activeClassSubscriptions(store, client.id)) {
    if (seen.has(x.plan.id)) continue;
    seen.add(x.plan.id);
    n += bookMemberOntoUpcoming(store, client, x.plan, today, now);
  }
  return n;
}

/** When a class is put on the diary, stamp the catalog series and book members already saved to it. */
export function stampCatalogSeriesAndBookSubscribers(
  store: FitgraphStore,
  sessions: FitSession[],
  now: string
): number {
  let booked = 0;
  for (const session of sessions) {
    if (session.session_kind && session.session_kind !== 'class') continue;
    const ser = String(session.series_id || '');
    if (!ser.startsWith('vuka_ser_')) {
      const slot = catalogSlotForSession(session);
      if (slot) session.series_id = slot.series_id;
    }
    for (const row of subscribersForSession(store, session)) {
      const result = bookDeskMemberOntoSession(store, session, row.client, now, {
        force: true,
      });
      if (result === 'booked' || result === 'waitlist') booked += 1;
    }
  }
  return booked;
}

export function mergeSubscribersIntoCoachSessions(
  store: FitgraphStore,
  sessions: CoachSessionCard[]
): CoachSessionCard[] {
  return sessions.map((card) => {
    const session =
      store.sessions.find((s) => s.id === card.session.id) || card.session;
    const roster = [...(card.roster || [])];
    const seen = new Set(roster.map((r) => r.client_id));
    const subscribed = subscribersForSession(store, session).map((r) => ({
      client_id: r.client.id,
      name: r.client.name,
      code: r.client.code,
      plan_name: r.plan_name,
      booked: r.booked,
      email: r.client.email,
      phone: r.client.phone,
    }));
    for (const row of subscribed) {
      if (seen.has(row.client_id)) continue;
      seen.add(row.client_id);
      roster.push({
        booking_id: `alloc_${session.id}_${row.client_id}`,
        client_id: row.client_id,
        status: 'booked',
        plan: true,
        actual: 'pending',
        name: row.name,
        email: row.email,
        phone: row.phone,
      });
    }
    const planned = roster.filter(
      (r) =>
        r.status === 'booked' ||
        r.status === 'attended' ||
        r.status === 'no_show'
    ).length;
    return {
      ...card,
      roster,
      planned,
      waitlist: roster.filter((r) => r.status === 'waitlist').length,
      pending: roster.filter(
        (r) => r.actual === 'pending' && r.status === 'booked'
      ).length,
    };
  });
}

/** Actual billed amount for one class: per-class override, else list price. */
export function resolveAllocatedCharge(
  plan: Pick<FitMembershipPlan, 'id' | 'price_zar'>,
  opts: {
    chargedZar?: number | null;
    chargesByPlanId?: Record<string, number | null>;
    planIds: string[];
  }
): number {
  const override = opts.chargesByPlanId?.[plan.id];
  if (override != null && Number.isFinite(Number(override))) {
    return Number(override);
  }
  const isPrimary = opts.planIds.length <= 1 || opts.planIds[0] === plan.id;
  if (
    isPrimary &&
    opts.chargedZar != null &&
    Number.isFinite(Number(opts.chargedZar))
  ) {
    return Number(opts.chargedZar);
  }
  const list = Number(plan.price_zar) || 0;
  if (list > 0) return list;
  if (opts.chargedZar != null && Number.isFinite(Number(opts.chargedZar))) {
    return Number(opts.chargedZar);
  }
  return 0;
}

export function allocateMemberToClass(
  store: FitgraphStore,
  opts: {
    clientId: string;
    planId?: string | null;
    chargedZar?: number | null;
    privateRateZar?: number | null;
    status?: FitSubscription['status'];
    kind?: 'member' | 'private';
    member?: boolean;
    privateClient?: boolean;
    coachId?: string | null;
    now?: string;
    bookUpcoming?: boolean;
    /** When set, the member is on exactly these classes (others are cancelled). */
    planIds?: string[] | null;
    /** Per-class actual charged (ZAR). Missing keys fall back to list price. */
    chargesByPlanId?: Record<string, number | null>;
    /** Keep other class subscriptions (used when adding one class to a roster). */
    replaceOtherPlans?: boolean;
    /** Optional contact fields saved with the allocation. */
    person?: {
      name?: string;
      email?: string;
      phone?: string;
      notes?: string;
    };
    /** Desk: keep the person on file without a class or private coach. */
    inactive?: boolean;
  }
):
  | { error: string }
  | {
      subscription: FitSubscription | null;
      booked: number;
      cancelled: number;
    } {
  const now = opts.now || new Date().toISOString();
  const today = now.slice(0, 10);
  const client = store.clients.find((c) => c.id === opts.clientId);
  if (!client) {
    return { error: 'Member not found' };
  }

  const applyPerson = () => {
    if (!opts.person) return;
    if (opts.person.name != null && String(opts.person.name).trim()) {
      client.name = String(opts.person.name).trim();
    }
    if (opts.person.email !== undefined) {
      const email = String(opts.person.email || '').trim();
      client.email = email || undefined;
    }
    if (opts.person.phone !== undefined) {
      const phone = String(opts.person.phone || '').trim();
      client.phone = phone || undefined;
    }
    if (opts.person.notes !== undefined) {
      client.notes = String(opts.person.notes || '');
    }
  };

  const parkOnDesk = () => {
    applyPerson();
    let cancelled = 0;
    for (const other of store.subscriptions) {
      if (other.client_id !== client.id) continue;
      if (other.status !== 'active' && other.status !== 'trialing') continue;
      other.status = 'cancelled';
      other.cancel_at = today;
      other.updated_at = now;
      cancelled += 1;
    }
    for (const b of store.bookings || []) {
      if (b.client_id !== client.id) continue;
      if (
        b.status === 'cancelled' ||
        b.status === 'attended' ||
        b.status === 'no_show'
      ) {
        continue;
      }
      const session = store.sessions.find((s) => s.id === b.session_id);
      if (!session || session.date < today) continue;
      b.status = 'cancelled';
    }
    client.active = false;
    client.membership_status = 'cancelled';
    client.membership_plan_id = null;
    client.updated_at = now;
    return cancelled;
  };

  if (opts.inactive) {
    const cancelled = parkOnDesk();
    return { subscription: null, booked: 0, cancelled };
  }

  const flagsExplicit =
    opts.member !== undefined || opts.privateClient !== undefined;
  const isPrivate = flagsExplicit
    ? opts.privateClient === true
    : opts.kind === 'private';
  const isMember = flagsExplicit
    ? opts.member === true
    : opts.kind !== 'private' || Boolean(opts.planId);
  const coachId = opts.coachId ? String(opts.coachId) : null;
  if (coachId) {
    const coach = store.coaches.find((c) => c.id === coachId);
    if (!coach || coach.active === false) {
      return { error: 'Coach not found' };
    }
  }
  if (!isMember && !isPrivate) {
    const cancelled = parkOnDesk();
    return { subscription: null, booked: 0, cancelled };
  }
  if (isPrivate && !coachId) {
    return { error: 'Select the coach for this private client' };
  }
  const explicitPlanIds = Array.isArray(opts.planIds);
  const planIds = [
    ...new Set(
      (explicitPlanIds
        ? opts.planIds || []
        : opts.planId
          ? [opts.planId]
          : []
      )
        .map((id) => String(id || ''))
        .filter(Boolean)
    ),
  ];
  const planId = planIds[0] || '';
  if (isMember && !planId) {
    if (!explicitPlanIds) {
      return { error: 'Select a class' };
    }
    applyPerson();
    let cancelled = 0;
    for (const other of store.subscriptions) {
      if (other.client_id !== client.id) continue;
      if (other.status !== 'active' && other.status !== 'trialing') continue;
      const otherPlan = store.membership_plans.find((p) => p.id === other.plan_id);
      if (otherPlan?.addon === true) continue;
      other.status = 'cancelled';
      other.cancel_at = today;
      other.updated_at = now;
      cancelled += 1;
    }
    client.membership_plan_id = null;
    client.updated_at = now;
    cancelUncoveredFutureBookings(store, client, today);
    recomputeClientClassDenorm(store, client.id, now);
    return { subscription: null, booked: 0, cancelled };
  }
  const plan = planId
    ? store.membership_plans.find((p) => p.id === planId)
    : null;
  if (planId && (!plan || plan.active === false)) {
    return { error: 'Class not found' };
  }
  for (const id of planIds) {
    const p = store.membership_plans.find((x) => x.id === id);
    if (!p || p.active === false) {
      return { error: 'Class not found' };
    }
  }

  applyPerson();

  if (
    client.active === false ||
    client.membership_status === 'expired' ||
    client.membership_status === 'cancelled'
  ) {
    client.active = true;
    client.membership_status = 'active';
  }

  client.private_client = isPrivate;
  client.coach_id = isPrivate
    ? coachId
    : coachId || plan?.default_coach_id || client.coach_id || null;
  const privateRate =
    opts.privateRateZar != null && Number.isFinite(Number(opts.privateRateZar))
      ? Number(opts.privateRateZar)
      : isPrivate && !isMember && opts.chargedZar != null
        ? Number(opts.chargedZar)
        : null;
  if (privateRate != null && Number.isFinite(privateRate)) {
    client.private_rate_zar = privateRate;
  }
  if (
    !isMember &&
    privateRate != null &&
    Number.isFinite(privateRate)
  ) {
    client.notes = applyChargedNote(client.notes, privateRate);
  }
  client.updated_at = now;

  if (!isMember) {
    let cancelled = 0;
    for (const other of store.subscriptions) {
      if (other.client_id !== client.id) continue;
      if (other.status !== 'active' && other.status !== 'trialing') continue;
      const otherPlan = store.membership_plans.find((p) => p.id === other.plan_id);
      if (otherPlan?.addon === true) continue;
      other.status = 'cancelled';
      other.cancel_at = today;
      other.updated_at = now;
      cancelled += 1;
    }
    client.membership_plan_id = null;
    cancelUncoveredFutureBookings(store, client, today);
    return { subscription: null, booked: 0, cancelled };
  }
  if (!plan) {
    return { subscription: null, booked: 0, cancelled: 0 };
  }
  const chargeOpts = {
    chargedZar: opts.chargedZar,
    chargesByPlanId: opts.chargesByPlanId,
    planIds,
  };
  const charge = resolveAllocatedCharge(plan, chargeOpts);
  const status = opts.status || 'active';
  let sub =
    store.subscriptions.find(
      (s) => s.client_id === client.id && s.plan_id === plan.id
    ) || null;
  if (sub) {
    sub.status = status;
    sub.charged_zar = charge;
    sub.auto_renew = sub.auto_renew !== false;
    sub.updated_at = now;
    if (!sub.started_at) sub.started_at = today;
    if (status === 'cancelled' || status === 'expired') {
      sub.cancel_at = today;
    }
  } else {
    sub = {
      id: newId('sub'),
      client_id: client.id,
      plan_id: plan.id,
      status,
      started_at: today,
      auto_renew: true,
      charged_zar: charge,
      created_at: now,
      updated_at: now,
    };
    store.subscriptions.push(sub);
  }

  let cancelled = 0;
  const keepIds = new Set(planIds);
  const replaceOthers = opts.replaceOtherPlans !== false;
  if (replaceOthers && plan.addon !== true) {
    for (const other of store.subscriptions) {
      if (other.id === sub.id) continue;
      if (other.client_id !== client.id) continue;
      if (other.status !== 'active' && other.status !== 'trialing') continue;
      if (keepIds.has(other.plan_id)) continue;
      const otherPlan = store.membership_plans.find((p) => p.id === other.plan_id);
      if (otherPlan?.addon === true) continue;
      other.status = 'cancelled';
      other.cancel_at = today;
      other.updated_at = now;
      cancelled += 1;
    }
  }

  if (plan.addon !== true) {
    client.membership_plan_id = plan.id;
    client.membership_status =
      status === 'active' || status === 'trialing'
        ? status === 'trialing'
          ? 'trial'
          : 'active'
        : status === 'paused'
          ? 'paused'
          : status === 'cancelled'
            ? 'cancelled'
            : 'expired';
  }
  client.updated_at = now;

  const live = status === 'active' || status === 'trialing';

  for (const extraId of planIds.slice(1)) {
    const extraPlan = store.membership_plans.find((p) => p.id === extraId);
    if (!extraPlan) continue;
    let extra =
      store.subscriptions.find(
        (s) => s.client_id === client.id && s.plan_id === extraPlan.id
      ) || null;
    const extraCharge = resolveAllocatedCharge(extraPlan, chargeOpts);
    if (extra) {
      extra.status = status;
      extra.charged_zar = extraCharge;
      extra.updated_at = now;
      if (!extra.started_at) extra.started_at = today;
    } else {
      extra = {
        id: newId('sub'),
        client_id: client.id,
        plan_id: extraPlan.id,
        status,
        started_at: today,
        auto_renew: true,
        charged_zar: extraCharge,
        created_at: now,
        updated_at: now,
      };
      store.subscriptions.push(extra);
    }
  }

  const booked = syncMemberClassBookings(
    store,
    client,
    today,
    now,
    opts.bookUpcoming !== false && live
  );

  recomputeClientClassDenorm(store, client.id, now);

  return { subscription: sub, booked, cancelled };
}

/** Active people the class roster can tick — no cap. Search name, code, email, phone. */
export function classRosterPeople(
  store: FitgraphStore,
  query?: string
): FitClient[] {
  const needle = String(query || '').trim().toLowerCase();
  return (store.clients || [])
    .filter((c) => c.active !== false)
    .filter((c) => {
      if (!needle) return true;
      return `${c.name} ${c.code} ${c.email || ''} ${c.phone || ''}`
        .toLowerCase()
        .includes(needle);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function setClassMembers(
  store: FitgraphStore,
  opts: {
    planId: string;
    clientIds: string[];
    now?: string;
  }
): { error: string } | { members: number; booked: number; dropped: number } {
  const now = opts.now || new Date().toISOString();
  const today = now.slice(0, 10);
  const plan = store.membership_plans.find((p) => p.id === opts.planId);
  if (!plan || plan.active === false) {
    return { error: 'Class not found' };
  }
  const want = new Set(
    opts.clientIds
      .map((id) => String(id || ''))
      .filter((id) => store.clients.some((c) => c.id === id && c.active !== false))
  );
  const droppedIds = new Set<string>();
  let dropped = 0;
  for (const sub of store.subscriptions) {
    if (sub.plan_id !== plan.id) continue;
    if (sub.status !== 'active' && sub.status !== 'trialing') continue;
    if (want.has(sub.client_id)) continue;
    sub.status = 'cancelled';
    sub.cancel_at = today;
    sub.updated_at = now;
    droppedIds.add(sub.client_id);
    dropped += 1;
  }
  for (const clientId of droppedIds) {
    const client = store.clients.find((c) => c.id === clientId);
    recomputeClientClassDenorm(store, clientId, now);
    if (client) cancelUncoveredFutureBookings(store, client, today);
  }
  let booked = 0;
  for (const clientId of want) {
    const client = store.clients.find((c) => c.id === clientId);
    const existing = store.subscriptions.find(
      (s) => s.client_id === clientId && s.plan_id === plan.id
    );
    const result = allocateMemberToClass(store, {
      clientId,
      planId: plan.id,
      member: true,
      privateClient: client?.private_client === true,
      coachId: client?.coach_id || plan.default_coach_id || null,
      chargedZar:
        existing != null ? subscriptionChargeZar(existing, plan) : undefined,
      replaceOtherPlans: false,
      bookUpcoming: true,
      now,
    });
    if (!('error' in result)) booked += result.booked;
    recomputeClientClassDenorm(store, clientId, now);
  }
  return { members: want.size, booked, dropped };
}

function resolveSeriesId(
  plan: FitMembershipPlan,
  startTime: string,
  weekdays: number[]
): string {
  const slots = timetableSlotsForPlan(plan);
  if (slots.length === 1) return slots[0].series_id;
  if (weekdays.length === 1) {
    const hit = slots.find(
      (s) =>
        s.start_time.slice(0, 5) === startTime.slice(0, 5) &&
        s.weekdays.length === 1 &&
        s.weekdays[0] === weekdays[0]
    );
    if (hit) return hit.series_id;
  }
  if (plan.series_ids?.length === 1) return plan.series_ids[0];
  return newId('ser');
}

function sessionKey(s: Pick<FitSession, 'class_type_id' | 'date' | 'start_time'>) {
  return `${s.class_type_id}|${s.date}|${String(s.start_time).slice(0, 5)}`;
}

export function scheduleClassOnCalendar(
  store: FitgraphStore,
  opts: {
    planId: string;
    date: string;
    start_time: string;
    end_time?: string | null;
    duration_min?: number | null;
    coach_id?: string | null;
    location?: string;
    room?: string | null;
    capacity?: number | null;
    public?: boolean;
    recurrence?: FitRecurrence | null;
    now?: string;
  }
):
  | { error: string }
  | {
      sessions: FitSession[];
      booked: number;
      series_id: string;
    } {
  const now = opts.now || new Date().toISOString();
  const plan = store.membership_plans.find((p) => p.id === opts.planId);
  if (!plan || plan.active === false) {
    return { error: 'Class not found' };
  }
  if (plan.unlocks_all_classes) {
    return {
      error:
        'Schedule the individual classes — unlimited members are booked onto those',
    };
  }
  const classTypeId = classTypeIdForPlan(store, plan);
  if (!classTypeId) {
    return { error: 'This class has no class type to put on the calendar' };
  }
  if (!opts.date || !opts.start_time) {
    return { error: 'Set a date and start time' };
  }
  const start = String(opts.start_time).slice(0, 5);
  const weekdays = opts.recurrence?.weekdays || [];
  const seriesId = resolveSeriesId(plan, start, weekdays);
  const created = createSessionsFromTemplate(
    store,
    {
      class_type_id: classTypeId,
      coach_id: opts.coach_id || plan.default_coach_id || null,
      date: opts.date,
      start_time: start,
      end_time: opts.end_time ?? null,
      duration_min: opts.duration_min ?? null,
      session_kind: 'class',
      capacity: opts.capacity ?? null,
      location: opts.location || plan.location || undefined,
      room: opts.room ?? null,
      public: opts.public !== false,
      origin: 'owner',
      series_id: seriesId,
    },
    opts.recurrence || { frequency: 'none' },
    now
  );
  const existing = new Set(
    (store.sessions || [])
      .filter((s) => s.status !== 'cancelled')
      .map(sessionKey)
  );
  const fresh = created.filter((s) => !existing.has(sessionKey(s)));
  if (!fresh.length) {
    return { error: 'Those dates are already on the calendar' };
  }
  const ids = new Set(plan.series_ids || []);
  ids.add(seriesId);
  plan.series_ids = [...ids];
  plan.schedule_label = formatScheduleLabel(
    start,
    opts.recurrence || { frequency: 'none' },
    opts.date
  );
  store.sessions.push(...fresh);

  const subscribers = (store.subscriptions || []).filter(
    (s) =>
      s.plan_id === plan.id &&
      (s.status === 'active' || s.status === 'trialing')
  );
  let booked = 0;
  for (const sub of subscribers) {
    const client = store.clients.find((c) => c.id === sub.client_id);
    if (!client || client.active === false) continue;
    for (const session of fresh) {
      const result = bookDeskMemberOntoSession(store, session, client, now, {
        force: true,
      });
      if (result === 'booked' || result === 'waitlist') booked += 1;
    }
  }

  return { sessions: fresh, booked, series_id: seriesId };
}

export function updateClassDesk(
  store: FitgraphStore,
  opts: {
    planId: string;
    patch?: {
      code?: string;
      name?: string;
      price_zar?: number;
      billing?: FitMembershipPlan['billing'];
      schedule_label?: string;
      description?: string;
      image_url?: string | null;
      video_url?: string | null;
      public?: boolean;
      location?: string;
      class_credits?: number | null;
      pt_credits?: number | null;
      access?: FitMembershipPlan['access'];
      programme_id?: string | null;
    };
    coachId?: string | null;
    sessionPatch?: {
      start_time?: string;
      end_time?: string | null;
      location?: string;
      public?: boolean;
    };
    fromDate?: string;
    now?: string;
  }
):
  | { error: string }
  | { plan: FitMembershipPlan; sessionsUpdated: number } {
  const plan = store.membership_plans.find((p) => p.id === opts.planId);
  if (!plan || plan.active === false) {
    return { error: 'Class not found' };
  }
  if (opts.coachId) {
    const coach = store.coaches.find((c) => c.id === opts.coachId);
    if (!coach || coach.active === false) {
      return { error: 'Coach not found' };
    }
  }
  const patch = opts.patch;
  if (patch) {
    if (patch.code != null) plan.code = String(patch.code);
    if (patch.name != null) plan.name = String(patch.name);
    if (patch.price_zar != null) plan.price_zar = Number(patch.price_zar) || 0;
    if (patch.billing) plan.billing = patch.billing;
    if (patch.schedule_label != null) plan.schedule_label = patch.schedule_label;
    if (patch.description != null) plan.description = patch.description;
    if (patch.image_url !== undefined) {
      plan.image_url = patch.image_url ? String(patch.image_url) : null;
    }
    if (patch.video_url !== undefined) {
      plan.video_url = patch.video_url ? String(patch.video_url) : null;
    }
    if (patch.public != null) plan.public = patch.public;
    if (patch.location != null) plan.location = patch.location;
    if (patch.class_credits !== undefined) {
      plan.class_credits = patch.class_credits;
    }
    if (patch.pt_credits !== undefined) plan.pt_credits = patch.pt_credits;
    if (patch.access) plan.access = patch.access;
    if (patch.programme_id !== undefined) {
      plan.programme_id = patch.programme_id;
    }
  }
  if (opts.coachId !== undefined) {
    plan.default_coach_id = opts.coachId || null;
  }
  const from = opts.fromDate || (opts.now || new Date().toISOString()).slice(0, 10);
  const future = (store.sessions || []).filter(
    (s) =>
      s.status === 'scheduled' &&
      s.date >= from &&
      planCoversSession(plan, s, store)
  );
  let sessionsUpdated = 0;
  for (const s of future) {
    let changed = false;
    if (opts.coachId !== undefined && s.coach_id !== (opts.coachId || null)) {
      s.coach_id = opts.coachId || null;
      changed = true;
    }
    if (opts.sessionPatch) {
      if (opts.sessionPatch.start_time) {
        const times = resolveSessionTimes({
          start_time: opts.sessionPatch.start_time,
          end_time: opts.sessionPatch.end_time ?? s.end_time,
          duration_min: s.duration_min,
        });
        s.start_time = times.start_time;
        s.end_time = times.end_time;
        s.duration_min = times.duration_min;
        changed = true;
      } else if (opts.sessionPatch.end_time) {
        const times = resolveSessionTimes({
          start_time: s.start_time,
          end_time: opts.sessionPatch.end_time,
        });
        s.end_time = times.end_time;
        s.duration_min = times.duration_min;
        changed = true;
      }
      if (opts.sessionPatch.location != null) {
        s.location = opts.sessionPatch.location;
        changed = true;
      }
      if (opts.sessionPatch.public != null) {
        s.public = opts.sessionPatch.public;
        changed = true;
      }
    }
    if (changed) sessionsUpdated += 1;
  }
  return { plan, sessionsUpdated };
}
