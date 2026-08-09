/**
 * Fitgraph® — tertiary / services gym OS (Fitness & wellness industry).
 * Coaches, clients/members, memberships, class types, calendar sessions,
 * bookings, check-ins, PT packs. Stored on profiles.metadata.fitgraph.
 */

export const FITGRAPH_MODULE_ID = 'fitgraph' as const;
export const FITGRAPH_META_KEY = 'fitgraph';

export const COACH_SPECIALTIES = [
  'Strength',
  'HIIT',
  'Yoga',
  'Pilates',
  'CrossFit',
  'Boxing',
  'Spin / cycle',
  'Functional',
  'Personal training',
  'Nutrition',
  'General',
] as const;

export const MEMBERSHIP_STATUSES = [
  'active',
  'paused',
  'expired',
  'cancelled',
  'trial',
] as const;

export type FitCoach = {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  specialties?: string[];
  bio?: string;
  /** Public bio for website / coach cards */
  public_bio?: string;
  photo_url?: string;
  /** Token for coach self-service portal (share classes with members) */
  portal_token?: string | null;
  /** Can manage own sessions (edit capacity, cancel, share) */
  can_manage_classes?: boolean;
  active?: boolean;
  color?: string;
  created_at: string;
};

export type FitClient = {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  membership_plan_id?: string | null;
  membership_status?: (typeof MEMBERSHIP_STATUSES)[number] | string;
  start_date?: string | null;
  end_date?: string | null;
  coach_id?: string | null;
  emergency_contact?: string;
  notes?: string;
  active?: boolean;
  created_at: string;
  updated_at: string;
};

export type FitMembershipPlan = {
  id: string;
  code: string;
  name: string;
  /** ZAR per billing period */
  price_zar: number;
  billing: 'monthly' | 'weekly' | 'annual' | 'pack' | 'drop_in';
  class_credits?: number | null;
  pt_credits?: number | null;
  description?: string;
  /** Show on public website pricing */
  public?: boolean;
  active?: boolean;
  created_at: string;
};

/** Active member subscription (recurring or pack entitlement) */
export type FitSubscription = {
  id: string;
  client_id: string;
  plan_id: string;
  status: 'active' | 'trialing' | 'past_due' | 'paused' | 'cancelled' | 'expired';
  started_at: string;
  current_period_end?: string | null;
  cancel_at?: string | null;
  /** Credits remaining this period (null = unlimited) */
  class_credits_remaining?: number | null;
  auto_renew?: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type FitClassType = {
  id: string;
  code: string;
  name: string;
  category?: string;
  default_duration_min?: number;
  capacity?: number | null;
  description?: string;
  active?: boolean;
  created_at: string;
};

export type FitSession = {
  id: string;
  class_type_id: string;
  coach_id?: string | null;
  /** Local calendar date YYYY-MM-DD */
  date: string;
  /** HH:mm */
  start_time: string;
  end_time?: string | null;
  duration_min?: number | null;
  capacity?: number | null;
  location?: string;
  status: 'scheduled' | 'cancelled' | 'completed' | 'full';
  /** Visible on public website / embed calendar */
  public?: boolean;
  /** Share link slug for this session (optional) */
  share_code?: string | null;
  /** Notes only for coach / owner */
  notes?: string;
  /** Customer-facing blurb when shared */
  public_notes?: string;
  created_at: string;
};

export type FitBooking = {
  id: string;
  session_id: string;
  client_id: string;
  status: 'booked' | 'waitlist' | 'cancelled' | 'attended' | 'no_show';
  booked_at: string;
  /** Source: owner desk, coach portal, website, member self-serve */
  source?: 'desk' | 'coach' | 'website' | 'member' | string;
  /** Guest name if not yet a client record */
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  notes?: string;
};

/** Gym-level website / portal settings */
export type FitPublicSettings = {
  /** Publish public calendar & class list */
  enabled: boolean;
  /** Secret token for public API (website embed) */
  public_token: string;
  /** Optional short slug for nicer links */
  public_slug?: string;
  brand_name?: string;
  website_url?: string;
  allow_public_booking: boolean;
  show_coaches: boolean;
  show_pricing: boolean;
  timezone?: string;
  contact_email?: string;
  contact_phone?: string;
  embed_primary_color?: string;
};

export type FitCheckIn = {
  id: string;
  client_id: string;
  date: string;
  time?: string | null;
  method?: 'front_desk' | 'app' | 'class' | 'other';
  session_id?: string | null;
  notes?: string;
  created_at: string;
};

export type FitPtPack = {
  id: string;
  client_id: string;
  coach_id?: string | null;
  sessions_total: number;
  sessions_used: number;
  purchased_at: string;
  expires_at?: string | null;
  price_zar?: number | null;
  notes?: string;
  created_at: string;
};

export type FitgraphStore = {
  coaches: FitCoach[];
  clients: FitClient[];
  membership_plans: FitMembershipPlan[];
  /** Recurring subscriptions for members */
  subscriptions: FitSubscription[];
  class_types: FitClassType[];
  sessions: FitSession[];
  bookings: FitBooking[];
  check_ins: FitCheckIn[];
  pt_packs: FitPtPack[];
  settings?: FitPublicSettings;
  updated_at?: string;
};

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultPublicSettings(companyId?: number): FitPublicSettings {
  return {
    enabled: false,
    public_token:
      companyId != null
        ? `fg_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
        : `fg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    allow_public_booking: true,
    show_coaches: true,
    show_pricing: true,
    timezone: 'Africa/Johannesburg',
    embed_primary_color: '#7c3aed',
  };
}

export function emptyFitgraphStore(): FitgraphStore {
  return {
    coaches: [],
    clients: [],
    membership_plans: [],
    subscriptions: [],
    class_types: [],
    sessions: [],
    bookings: [],
    check_ins: [],
    pt_packs: [],
    settings: defaultPublicSettings(),
  };
}

export function readFitgraphFromMetadata(
  meta: Record<string, unknown> | null | undefined
): FitgraphStore {
  if (!meta || typeof meta !== 'object') return emptyFitgraphStore();
  const raw = meta[FITGRAPH_META_KEY];
  if (!raw || typeof raw !== 'object') return emptyFitgraphStore();
  const s = raw as Partial<FitgraphStore>;
  const e = emptyFitgraphStore();
  for (const key of Object.keys(e) as Array<keyof FitgraphStore>) {
    if (key === 'updated_at' || key === 'settings') continue;
    const v = s[key];
    (e as Record<string, unknown>)[key] = Array.isArray(v) ? v : [];
  }
  e.settings = {
    ...defaultPublicSettings(),
    ...(s.settings && typeof s.settings === 'object' ? s.settings : {}),
  };
  if (!e.settings.public_token) {
    e.settings.public_token = defaultPublicSettings().public_token;
  }
  e.updated_at = s.updated_at ? String(s.updated_at) : undefined;
  return e;
}

/** Metadata root indexes for public token lookup (no full table scan). */
export const FITGRAPH_PUBLIC_TOKEN_KEY = 'fitgraph_public_token';
export const FITGRAPH_COACH_TOKENS_KEY = 'fitgraph_coach_tokens';

export function writeFitgraphToMetadata(
  meta: Record<string, unknown>,
  store: FitgraphStore
): Record<string, unknown> {
  const coachTokens: Record<string, string> = {};
  for (const c of store.coaches || []) {
    if (c.portal_token) coachTokens[String(c.portal_token)] = c.id;
  }
  return {
    ...meta,
    [FITGRAPH_META_KEY]: {
      ...store,
      updated_at: new Date().toISOString(),
    },
    [FITGRAPH_PUBLIC_TOKEN_KEY]: store.settings?.public_token || null,
    [FITGRAPH_COACH_TOKENS_KEY]: coachTokens,
  };
}

/** Issue a coach portal token (includes company id for fast public resolve). */
export function issueCoachPortalToken(companyId: number): string {
  return `coach_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Parse companyId from coach_* or fg_{companyId}_* tokens when present. */
export function parseCompanyIdFromToken(token: string): number | null {
  const coach = /^coach_(\d+)_/.exec(token);
  if (coach) return Number(coach[1]);
  const fg = /^fg_(\d+)_/.exec(token);
  if (fg) return Number(fg[1]);
  return null;
}

export function ensurePublicToken(
  settings: FitPublicSettings | undefined,
  companyId?: number
): FitPublicSettings {
  const base: FitPublicSettings = {
    enabled: false,
    allow_public_booking: true,
    show_coaches: true,
    show_pricing: true,
    timezone: 'Africa/Johannesburg',
    embed_primary_color: '#7c3aed',
    public_token: '',
    ...(settings || {}),
  };
  if (!base.public_token) {
    base.public_token =
      companyId != null
        ? `fg_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
        : defaultPublicSettings().public_token;
  }
  return base;
}

export function summariseFitgraph(store: FitgraphStore) {
  const coaches = store.coaches.filter((c) => c.active !== false);
  const clients = store.clients.filter((c) => c.active !== false);
  const activeMembers = clients.filter(
    (c) => c.membership_status === 'active' || c.membership_status === 'trial'
  );
  const today = new Date().toISOString().slice(0, 10);
  const sessionsToday = store.sessions.filter(
    (s) => s.date === today && s.status !== 'cancelled'
  );
  const bookingsOpen = store.bookings.filter(
    (b) => b.status === 'booked' || b.status === 'waitlist'
  );
  const checkInsToday = store.check_ins.filter((c) => c.date === today);
  const ptRemaining = store.pt_packs.reduce(
    (n, p) =>
      n + Math.max(0, (Number(p.sessions_total) || 0) - (Number(p.sessions_used) || 0)),
    0
  );
  const plans = store.membership_plans.filter((p) => p.active !== false);
  const subs = (store.subscriptions || []).filter(
    (s) => s.status === 'active' || s.status === 'trialing'
  );
  const publicSessions = store.sessions.filter(
    (s) => s.public && s.status === 'scheduled' && s.date >= today
  );

  return {
    coachCount: coaches.length,
    clientCount: clients.length,
    activeMembers: activeMembers.length,
    planCount: plans.length,
    activeSubscriptions: subs.length,
    classTypeCount: store.class_types.filter((c) => c.active !== false).length,
    sessionsToday: sessionsToday.length,
    sessionsUpcoming: store.sessions.filter(
      (s) => s.date >= today && s.status === 'scheduled'
    ).length,
    publicSessionsUpcoming: publicSessions.length,
    bookingsOpen: bookingsOpen.length,
    checkInsToday: checkInsToday.length,
    checkInsTotal: store.check_ins.length,
    ptSessionsRemaining: ptRemaining,
    websiteEnabled: store.settings?.enabled === true,
    publicBooking: store.settings?.allow_public_booking === true,
  };
}

/** Public calendar payload for website embed (no private PII) */
export function buildPublicCalendarPayload(
  store: FitgraphStore,
  opts?: { from?: string; to?: string; coachId?: string }
) {
  const today = new Date().toISOString().slice(0, 10);
  const from = opts?.from || today;
  const toDate = new Date(from + 'T12:00:00');
  toDate.setDate(toDate.getDate() + 28);
  const to = opts?.to || toDate.toISOString().slice(0, 10);

  const sessions = store.sessions
    .filter(
      (s) =>
        s.public === true &&
        s.status === 'scheduled' &&
        s.date >= from &&
        s.date <= to &&
        (!opts?.coachId || s.coach_id === opts.coachId)
    )
    .map((s) => {
      const ct = classTypeById(store, s.class_type_id);
      const coach = coachById(store, s.coach_id);
      const booked = sessionBookingCount(store, s.id);
      const cap = s.capacity ?? ct?.capacity ?? 0;
      return {
        id: s.id,
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        duration_min: s.duration_min ?? ct?.default_duration_min ?? 45,
        class_name: ct?.name || 'Class',
        class_code: ct?.code,
        category: ct?.category,
        coach_name: coach?.name,
        coach_code: coach?.code,
        location: s.location,
        capacity: cap,
        spots_left: Math.max(0, cap - booked),
        full: cap > 0 && booked >= cap,
        public_notes: s.public_notes,
        share_code: s.share_code,
      };
    })
    .sort((a, b) =>
      a.date === b.date
        ? a.start_time.localeCompare(b.start_time)
        : a.date.localeCompare(b.date)
    );

  const coaches = store.settings?.show_coaches
    ? store.coaches
        .filter((c) => c.active !== false)
        .map((c) => ({
          code: c.code,
          name: c.name,
          specialties: c.specialties || [],
          bio: c.public_bio || c.bio,
          color: c.color,
        }))
    : [];

  const plans = store.settings?.show_pricing
    ? store.membership_plans
        .filter((p) => p.active !== false && p.public !== false)
        .map((p) => ({
          code: p.code,
          name: p.name,
          price_zar: p.price_zar,
          billing: p.billing,
          description: p.description,
          class_credits: p.class_credits,
        }))
    : [];

  return {
    brand: store.settings?.brand_name || 'Gym',
    timezone: store.settings?.timezone || 'Africa/Johannesburg',
    allow_booking: store.settings?.allow_public_booking !== false,
    contact_email: store.settings?.contact_email,
    contact_phone: store.settings?.contact_phone,
    primary_color: store.settings?.embed_primary_color || '#7c3aed',
    from,
    to,
    sessions,
    coaches,
    plans,
  };
}

/** Coach portal view of their sessions + roster */
export function buildCoachPortalPayload(
  store: FitgraphStore,
  coach: FitCoach,
  from?: string
) {
  const start = from || new Date().toISOString().slice(0, 10);
  const endD = new Date(start + 'T12:00:00');
  endD.setDate(endD.getDate() + 14);
  const end = endD.toISOString().slice(0, 10);

  const mySessions = store.sessions
    .filter(
      (s) =>
        s.coach_id === coach.id &&
        s.date >= start &&
        s.date <= end &&
        s.status !== 'cancelled'
    )
    .map((s) => {
      const ct = classTypeById(store, s.class_type_id);
      const booked = store.bookings.filter(
        (b) =>
          b.session_id === s.id &&
          (b.status === 'booked' ||
            b.status === 'attended' ||
            b.status === 'waitlist')
      );
      return {
        session: s,
        class_name: ct?.name,
        capacity: s.capacity ?? ct?.capacity ?? 0,
        booked: booked.filter((b) => b.status !== 'waitlist').length,
        waitlist: booked.filter((b) => b.status === 'waitlist').length,
        roster: booked.map((b) => {
          const client = clientById(store, b.client_id);
          return {
            booking_id: b.id,
            status: b.status,
            name: client?.name || b.guest_name || 'Guest',
            email: client?.email || b.guest_email,
            phone: client?.phone || b.guest_phone,
          };
        }),
      };
    });

  return {
    coach: {
      id: coach.id,
      code: coach.code,
      name: coach.name,
      can_manage_classes: coach.can_manage_classes !== false,
    },
    from: start,
    to: end,
    sessions: mySessions,
  };
}

export function sessionBookingCount(
  store: FitgraphStore,
  sessionId: string
): number {
  return store.bookings.filter(
    (b) =>
      b.session_id === sessionId &&
      (b.status === 'booked' || b.status === 'attended')
  ).length;
}

export function coachById(store: FitgraphStore, id?: string | null) {
  if (!id) return undefined;
  return store.coaches.find((c) => c.id === id);
}

export function clientById(store: FitgraphStore, id?: string | null) {
  if (!id) return undefined;
  return store.clients.find((c) => c.id === id);
}

export function classTypeById(store: FitgraphStore, id?: string | null) {
  if (!id) return undefined;
  return store.class_types.find((c) => c.id === id);
}

export function planById(store: FitgraphStore, id?: string | null) {
  if (!id) return undefined;
  return store.membership_plans.find((p) => p.id === id);
}

/** Week grid helper: sessions between from–to dates */
export function sessionsInRange(
  store: FitgraphStore,
  from: string,
  to: string
): FitSession[] {
  return store.sessions
    .filter((s) => s.date >= from && s.date <= to && s.status !== 'cancelled')
    .sort((a, b) =>
      a.date === b.date
        ? a.start_time.localeCompare(b.start_time)
        : a.date.localeCompare(b.date)
    );
}

export function attendanceByClass(store: FitgraphStore) {
  const map = new Map<
    string,
    { class_name: string; sessions: number; bookings: number; attended: number }
  >();
  for (const s of store.sessions) {
    const ct = classTypeById(store, s.class_type_id);
    const key = s.class_type_id;
    const row = map.get(key) || {
      class_name: ct?.name || key,
      sessions: 0,
      bookings: 0,
      attended: 0,
    };
    row.sessions += 1;
    const books = store.bookings.filter((b) => b.session_id === s.id);
    row.bookings += books.filter(
      (b) => b.status === 'booked' || b.status === 'attended'
    ).length;
    row.attended += books.filter((b) => b.status === 'attended').length;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.sessions - a.sessions);
}
