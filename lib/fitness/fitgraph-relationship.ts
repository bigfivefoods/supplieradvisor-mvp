/**
 * GymAdvisor® — B2C Relationship Layer
 *
 * Shared progress timeline, relationship health signals, structured goals,
 * member stories, consent shares, and value ledger helpers.
 *
 * All functions are pure (no I/O). Store arrays live on FitgraphStore.
 */

import type {
  FitBooking,
  FitClassFeedback,
  FitClient,
  FitCoach,
  FitgraphStore,
  FitSession,
} from '@/lib/fitness/fitgraph';
import { newId } from '@/lib/fitness/fitgraph';

// ── Goals ───────────────────────────────────────────────────────────────────

export const FIT_GOAL_CATEGORIES = [
  'physical',
  'consistency',
  'lifestyle',
  'performance',
  'other',
] as const;
export type FitGoalCategory = (typeof FIT_GOAL_CATEGORIES)[number];

export const FIT_GOAL_STATUSES = [
  'active',
  'paused',
  'achieved',
  'abandoned',
] as const;
export type FitGoalStatus = (typeof FIT_GOAL_STATUSES)[number];

export type FitGoalCheckIn = {
  id: string;
  at: string;
  by_role: 'member' | 'coach' | 'owner';
  by_id?: string | null;
  note?: string;
  metric_value?: number | null;
};

export type FitGoal = {
  id: string;
  client_id: string;
  /** Primary coach for this goal (optional; falls back to client.coach_id) */
  coach_id?: string | null;
  title: string;
  description?: string;
  category: FitGoalCategory | string;
  status: FitGoalStatus | string;
  /** Optional numeric target */
  target_value?: number | null;
  unit?: string | null;
  start_date?: string | null;
  target_date?: string | null;
  achieved_at?: string | null;
  /** weekly | biweekly | monthly */
  review_cadence?: string | null;
  last_review_at?: string | null;
  check_ins?: FitGoalCheckIn[];
  created_at: string;
  updated_at: string;
  created_by_role?: 'member' | 'coach' | 'owner';
};

// ── Journey / Progress Timeline ─────────────────────────────────────────────

export const FIT_JOURNEY_KINDS = [
  'session_attended',
  'feedback',
  'coach_note',
  'member_log',
  'goal_set',
  'goal_progress',
  'goal_achieved',
  'milestone',
  'photo',
  'message_summary',
  'story',
  'check_in',
  'membership',
] as const;
export type FitJourneyKind = (typeof FIT_JOURNEY_KINDS)[number] | string;

export type FitJourneyEvent = {
  id: string;
  client_id: string;
  coach_id?: string | null;
  kind: FitJourneyKind;
  /** ISO timestamp */
  at: string;
  title: string;
  body?: string;
  /** Linked entities */
  session_id?: string | null;
  booking_id?: string | null;
  goal_id?: string | null;
  feedback_id?: string | null;
  story_id?: string | null;
  /** Media */
  photo_urls?: string[];
  /** Visibility */
  visibility?: 'shared' | 'coach_private' | 'member_private';
  created_by_role?: 'system' | 'member' | 'coach' | 'owner' | 'desk';
  created_by_id?: string | null;
  meta?: Record<string, unknown>;
};

// ── Member Stories (voice) ──────────────────────────────────────────────────

export const FIT_STORY_VISIBILITY = [
  'private',
  'coach_and_owner',
  'gym_public',
  'platform',
] as const;
export type FitStoryVisibility = (typeof FIT_STORY_VISIBILITY)[number];

export type FitMemberStory = {
  id: string;
  client_id: string;
  coach_id?: string | null;
  title: string;
  body: string;
  before_summary?: string;
  after_summary?: string;
  metrics?: Array<{ label: string; value: string }>;
  photo_urls?: string[];
  visibility: FitStoryVisibility | string;
  /** Owner featured on public website */
  featured?: boolean;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
};

// ── Cross-advisor consent ───────────────────────────────────────────────────

export type FitConsentShare = {
  id: string;
  /** Platform user who granted consent (member) */
  granted_by_platform_user_id: string;
  client_id: string;
  from_module: string; // e.g. 'physiograph'
  to_module: string; // e.g. 'fitgraph'
  /** Granular scopes */
  scopes: string[]; // 'injury_notes' | 'clearance' | 'medications_summary' | ...
  status: 'active' | 'revoked' | 'expired';
  granted_at: string;
  expires_at?: string | null;
  revoked_at?: string | null;
  note?: string;
};

// ── Relationship Health ─────────────────────────────────────────────────────

export type RelationshipHealthLevel =
  | 'strong'
  | 'steady'
  | 'cooling'
  | 'at_risk'
  | 'unknown';

export type RelationshipHealth = {
  client_id: string;
  coach_id?: string | null;
  score: number; // 0–100
  level: RelationshipHealthLevel;
  /** Human labels for UI badges */
  label: string;
  flags: string[];
  /** Suggested care actions for coach/owner */
  suggested_actions: Array<{
    code: string;
    title: string;
    detail?: string;
  }>;
  metrics: {
    attended_30d: number;
    attended_60d: number;
    no_shows_30d: number;
    last_attended_at: string | null;
    days_since_attended: number | null;
    last_interaction_at: string | null;
    days_since_interaction: number | null;
    avg_feel_30d: number | null;
    avg_would_return_30d: number | null;
    active_goals: number;
    goals_overdue_review: number;
  };
  computed_at: string;
};

export type ValueLedgerSide = {
  sessions_attended: number;
  sessions_planned: number;
  feedback_submitted: number;
  coach_notes: number;
  goals_active: number;
  goals_achieved: number;
  /** Approximate coach time in minutes (duration of attended sessions) */
  coach_minutes_approx: number;
};

export type ValueLedger = {
  client_id: string;
  coach_id?: string | null;
  period_days: number;
  member_view: ValueLedgerSide & { notes_received: number };
  coach_view: ValueLedgerSide & {
    hours_delivered: number;
    retention_hint: string;
  };
  computed_at: string;
};

// ── Pure helpers ────────────────────────────────────────────────────────────

function daysBetween(isoA: string | null | undefined, isoB: string): number | null {
  if (!isoA) return null;
  const a = new Date(isoA.slice(0, 10) + 'T12:00:00').getTime();
  const b = new Date(isoB.slice(0, 10) + 'T12:00:00').getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
}

/** Clients a coach may run relationship tools against */
export function isClientInCoachScope(
  store: FitgraphStore,
  coachId: string,
  clientId: string
): boolean {
  const client = store.clients.find((c) => c.id === clientId);
  if (!client || client.active === false) return false;
  if (client.coach_id === coachId) return true;
  const sessionIds = new Set(
    store.sessions.filter((s) => s.coach_id === coachId).map((s) => s.id)
  );
  return store.bookings.some(
    (b) =>
      b.client_id === clientId &&
      sessionIds.has(b.session_id) &&
      b.status !== 'cancelled'
  );
}

export function goalsForClient(
  store: FitgraphStore,
  clientId: string
): FitGoal[] {
  return (store.goals || [])
    .filter((g) => g.client_id === clientId)
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
}

export function activeGoalsForClient(
  store: FitgraphStore,
  clientId: string
): FitGoal[] {
  return goalsForClient(store, clientId).filter(
    (g) => g.status === 'active' || g.status === 'paused'
  );
}

/** Build / merge journey from explicit events + derived session/feedback rows */
export function buildClientJourney(
  store: FitgraphStore,
  clientId: string,
  opts?: {
    limit?: number;
    coachId?: string | null;
    /** member portal hides coach-private notes */
    audience?: 'coach' | 'member';
  }
): FitJourneyEvent[] {
  const hide =
    opts?.audience === 'member' ? 'coach_private' : 'member_private';
  const explicit = (store.journey_events || []).filter(
    (e) =>
      e.client_id === clientId &&
      e.visibility !== hide &&
      (!opts?.coachId || !e.coach_id || e.coach_id === opts.coachId)
  );

  const derived: FitJourneyEvent[] = [];

  // Attended bookings → session_attended
  for (const b of store.bookings || []) {
    if (b.client_id !== clientId || b.status !== 'attended') continue;
    const s = store.sessions.find((x) => x.id === b.session_id);
    if (!s) continue;
    if (opts?.coachId && s.coach_id && s.coach_id !== opts.coachId) continue;
    const ct = store.class_types.find((c) => c.id === s.class_type_id);
    derived.push({
      id: `derived_att_${b.id}`,
      client_id: clientId,
      coach_id: s.coach_id || null,
      kind: 'session_attended',
      at: `${s.date}T${s.start_time || '12:00'}:00`,
      title: ct?.name || 'Class attended',
      body: s.class_plan || s.public_notes || undefined,
      session_id: s.id,
      booking_id: b.id,
      visibility: 'shared',
      created_by_role: 'system',
    });
  }

  // Member feedback
  for (const f of store.class_feedback || []) {
    if (f.role !== 'member' || f.client_id !== clientId) continue;
    const s = store.sessions.find((x) => x.id === f.session_id);
    if (opts?.coachId && s?.coach_id && s.coach_id !== opts.coachId) continue;
    derived.push({
      id: `derived_fb_${f.id}`,
      client_id: clientId,
      coach_id: s?.coach_id || null,
      kind: 'feedback',
      at: f.updated_at || f.created_at,
      title: `Class feedback · feel ${f.feeling}/5 · RPE ${f.intensity}/10`,
      body: f.comment || undefined,
      session_id: f.session_id,
      feedback_id: f.id,
      visibility: 'shared',
      created_by_role: 'system',
      meta: {
        feeling: f.feeling,
        intensity: f.intensity,
        enjoyment: f.enjoyment,
        would_return: f.would_return,
      },
    });
  }

  // Goal events from check-ins / status
  for (const g of store.goals || []) {
    if (g.client_id !== clientId) continue;
    if (opts?.coachId && g.coach_id && g.coach_id !== opts.coachId) continue;
    derived.push({
      id: `derived_goal_${g.id}`,
      client_id: clientId,
      coach_id: g.coach_id || null,
      kind: g.status === 'achieved' ? 'goal_achieved' : 'goal_set',
      at: g.achieved_at || g.created_at,
      title:
        g.status === 'achieved'
          ? `Goal achieved: ${g.title}`
          : `Goal set: ${g.title}`,
      body: g.description,
      goal_id: g.id,
      visibility: 'shared',
      created_by_role: (g.created_by_role as FitJourneyEvent['created_by_role']) || 'system',
    });
    for (const ci of g.check_ins || []) {
      derived.push({
        id: `derived_gci_${ci.id}`,
        client_id: clientId,
        coach_id: g.coach_id || null,
        kind: 'goal_progress',
        at: ci.at,
        title: `Goal check-in: ${g.title}`,
        body: ci.note,
        goal_id: g.id,
        visibility: 'shared',
        created_by_role:
          ci.by_role === 'member'
            ? 'member'
            : ci.by_role === 'coach'
              ? 'coach'
              : 'owner',
        created_by_id: ci.by_id,
        meta: { metric_value: ci.metric_value },
      });
    }
  }

  // Stories
  for (const st of store.member_stories || []) {
    if (st.client_id !== clientId) continue;
    if (opts?.coachId && st.coach_id && st.coach_id !== opts.coachId) continue;
    derived.push({
      id: `derived_story_${st.id}`,
      client_id: clientId,
      coach_id: st.coach_id || null,
      kind: 'story',
      at: st.published_at || st.created_at,
      title: st.title,
      body: st.after_summary || st.body?.slice(0, 160),
      story_id: st.id,
      photo_urls: st.photo_urls,
      visibility: 'shared',
      created_by_role: 'member',
    });
  }

  const merged = [...explicit, ...derived];
  // Dedupe by id
  const seen = new Set<string>();
  const unique: FitJourneyEvent[] = [];
  for (const e of merged) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    unique.push(e);
  }
  unique.sort((a, b) => b.at.localeCompare(a.at));
  const limit = opts?.limit ?? 80;
  return unique.slice(0, limit);
}

export function computeRelationshipHealth(
  store: FitgraphStore,
  clientId: string,
  coachId?: string | null
): RelationshipHealth {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const d30 = new Date(now);
  d30.setDate(d30.getDate() - 30);
  const from30 = d30.toISOString().slice(0, 10);
  const d60 = new Date(now);
  d60.setDate(d60.getDate() - 60);
  const from60 = d60.toISOString().slice(0, 10);

  const client = store.clients.find((c) => c.id === clientId);
  const effectiveCoachId = coachId || client?.coach_id || null;

  const bookings = (store.bookings || []).filter((b) => b.client_id === clientId);
  const attended = bookings.filter((b) => b.status === 'attended');
  const noShows = bookings.filter((b) => b.status === 'no_show');

  const sessionDate = (b: FitBooking) => {
    const s = store.sessions.find((x) => x.id === b.session_id);
    return s?.date || b.booked_at?.slice(0, 10) || '';
  };

  const attended30 = attended.filter((b) => sessionDate(b) >= from30);
  const attended60 = attended.filter((b) => sessionDate(b) >= from60);
  const noShows30 = noShows.filter((b) => sessionDate(b) >= from30);

  const lastAttended =
    attended
      .map((b) => sessionDate(b))
      .filter(Boolean)
      .sort()
      .reverse()[0] || null;
  const daysSinceAttended = daysBetween(lastAttended, today);

  // Last interaction: max of attended, message, coach note, feedback, check-in
  let lastInteraction = lastAttended;
  for (const e of store.journey_events || []) {
    if (e.client_id !== clientId) continue;
    if (!lastInteraction || e.at > lastInteraction) lastInteraction = e.at;
  }
  for (const f of store.class_feedback || []) {
    if (f.client_id === clientId || (f.role === 'coach' && f.coach_id === effectiveCoachId)) {
      const t = f.updated_at || f.created_at;
      if (!lastInteraction || t > lastInteraction) lastInteraction = t;
    }
  }
  const daysSinceInteraction = daysBetween(lastInteraction, today);

  const memberFb30 = (store.class_feedback || []).filter(
    (f) =>
      f.role === 'member' &&
      f.client_id === clientId &&
      (f.updated_at || f.created_at).slice(0, 10) >= from30
  );
  const avgFeel = avg(memberFb30.map((f) => f.feeling));
  const avgReturn = avg(
    memberFb30
      .map((f) => f.would_return)
      .filter((n): n is number => n != null && Number.isFinite(n))
  );

  const goals = goalsForClient(store, clientId);
  const activeGoals = goals.filter((g) => g.status === 'active');
  const overdueReview = activeGoals.filter((g) => {
    if (!g.review_cadence || !g.last_review_at) return false;
    const days = daysBetween(g.last_review_at, today);
    if (days == null) return false;
    if (g.review_cadence === 'weekly') return days > 9;
    if (g.review_cadence === 'biweekly') return days > 18;
    if (g.review_cadence === 'monthly') return days > 35;
    return false;
  }).length;

  // Score 0–100
  let score = 55;
  score += Math.min(25, attended30.length * 4);
  score += Math.min(10, attended60.length);
  if (avgFeel != null) score += (avgFeel - 3) * 4;
  if (avgReturn != null) score += (avgReturn - 3) * 3;
  score -= noShows30.length * 6;
  if (daysSinceAttended != null) {
    if (daysSinceAttended > 45) score -= 25;
    else if (daysSinceAttended > 28) score -= 15;
    else if (daysSinceAttended > 14) score -= 6;
  }
  if (daysSinceInteraction != null && daysSinceInteraction > 21) score -= 8;
  if (activeGoals.length) score += 5;
  if (overdueReview) score -= overdueReview * 3;
  if (client?.membership_status === 'frozen') score -= 20;
  if (client?.booking_soft_block) score -= 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let level: RelationshipHealthLevel = 'unknown';
  let label = 'Not enough data';
  if (attended60.length === 0 && !lastAttended) {
    level = 'unknown';
    label = 'New / no attendance yet';
  } else if (score >= 75) {
    level = 'strong';
    label = 'Strong connection';
  } else if (score >= 55) {
    level = 'steady';
    label = 'Steady';
  } else if (score >= 35) {
    level = 'cooling';
    label = 'Cooling off';
  } else {
    level = 'at_risk';
    label = 'At risk';
  }

  const flags: string[] = [];
  if (noShows30.length >= 2) flags.push('repeated_no_shows');
  if (daysSinceAttended != null && daysSinceAttended > 28)
    flags.push('long_absence');
  if (avgFeel != null && avgFeel <= 2.5) flags.push('low_feel');
  if (overdueReview) flags.push('goal_review_overdue');
  if (client?.membership_status === 'frozen') flags.push('membership_frozen');
  if (client?.booking_soft_block) flags.push('no_show_risk');

  const suggested_actions: RelationshipHealth['suggested_actions'] = [];
  if (level === 'at_risk' || level === 'cooling') {
    suggested_actions.push({
      code: 'personal_checkin',
      title: 'Send a personal check-in',
      detail: 'A short, human message often re-activates quieter members.',
    });
  }
  if (daysSinceAttended != null && daysSinceAttended > 21) {
    suggested_actions.push({
      code: 'invite_back',
      title: 'Invite to a familiar class',
      detail: 'Offer a known coach / time slot they previously attended.',
    });
  }
  if (overdueReview) {
    suggested_actions.push({
      code: 'goal_review',
      title: 'Run a goal review',
      detail: `${overdueReview} goal(s) past review cadence.`,
    });
  }
  if (level === 'strong' && activeGoals.length === 0) {
    suggested_actions.push({
      code: 'set_next_goal',
      title: 'Set a next goal together',
      detail: 'Strong relationship is a good moment to lock the next target.',
    });
  }

  return {
    client_id: clientId,
    coach_id: effectiveCoachId,
    score,
    level,
    label,
    flags,
    suggested_actions,
    metrics: {
      attended_30d: attended30.length,
      attended_60d: attended60.length,
      no_shows_30d: noShows30.length,
      last_attended_at: lastAttended,
      days_since_attended: daysSinceAttended,
      last_interaction_at: lastInteraction,
      days_since_interaction: daysSinceInteraction,
      avg_feel_30d: avgFeel,
      avg_would_return_30d: avgReturn,
      active_goals: activeGoals.length,
      goals_overdue_review: overdueReview,
    },
    computed_at: now.toISOString(),
  };
}

export function computeValueLedger(
  store: FitgraphStore,
  clientId: string,
  opts?: { coachId?: string | null; periodDays?: number }
): ValueLedger {
  const periodDays = opts?.periodDays ?? 90;
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - periodDays);
  const fromIso = from.toISOString().slice(0, 10);

  const bookings = (store.bookings || []).filter((b) => b.client_id === clientId);
  const inPeriod = (b: FitBooking) => {
    const s = store.sessions.find((x) => x.id === b.session_id);
    const d = s?.date || b.booked_at?.slice(0, 10) || '';
    return d >= fromIso;
  };
  const periodBookings = bookings.filter(inPeriod);
  const attended = periodBookings.filter((b) => b.status === 'attended');
  const planned = periodBookings.filter(
    (b) =>
      b.status === 'booked' ||
      b.status === 'attended' ||
      b.status === 'no_show'
  );

  let coachMinutes = 0;
  for (const b of attended) {
    const s = store.sessions.find((x) => x.id === b.session_id);
    if (!s) continue;
    if (opts?.coachId && s.coach_id && s.coach_id !== opts.coachId) continue;
    const ct = store.class_types.find((c) => c.id === s.class_type_id);
    coachMinutes += s.duration_min ?? ct?.default_duration_min ?? 45;
  }

  const feedbackCount = (store.class_feedback || []).filter(
    (f) =>
      f.role === 'member' &&
      f.client_id === clientId &&
      (f.updated_at || f.created_at).slice(0, 10) >= fromIso
  ).length;

  const coachNotes = (store.journey_events || []).filter(
    (e) =>
      e.client_id === clientId &&
      e.kind === 'coach_note' &&
      e.at.slice(0, 10) >= fromIso
  ).length;

  const goals = goalsForClient(store, clientId);
  const activeGoals = goals.filter((g) => g.status === 'active').length;
  const achievedGoals = goals.filter(
    (g) =>
      g.status === 'achieved' &&
      (g.achieved_at || g.updated_at).slice(0, 10) >= fromIso
  ).length;

  const hours = Math.round((coachMinutes / 60) * 10) / 10;
  const retention =
    attended.length >= 8
      ? 'High engagement this period'
      : attended.length >= 3
        ? 'Moderate engagement'
        : 'Low engagement — worth a personal touch';

  const side: ValueLedgerSide = {
    sessions_attended: attended.length,
    sessions_planned: planned.length,
    feedback_submitted: feedbackCount,
    coach_notes: coachNotes,
    goals_active: activeGoals,
    goals_achieved: achievedGoals,
    coach_minutes_approx: coachMinutes,
  };

  return {
    client_id: clientId,
    coach_id: opts?.coachId || null,
    period_days: periodDays,
    member_view: { ...side, notes_received: coachNotes },
    coach_view: {
      ...side,
      hours_delivered: hours,
      retention_hint: retention,
    },
    computed_at: now.toISOString(),
  };
}

/** Create a coach note journey event (caller persists to store) */
export function createCoachNoteEvent(input: {
  client_id: string;
  coach_id?: string | null;
  title?: string;
  body: string;
  visibility?: 'shared' | 'coach_private';
  created_by_id?: string | null;
  nowIso?: string;
}): FitJourneyEvent {
  const now = input.nowIso || new Date().toISOString();
  return {
    id: newId('je'),
    client_id: input.client_id,
    coach_id: input.coach_id || null,
    kind: 'coach_note',
    at: now,
    title: input.title || 'Coach note',
    body: input.body,
    visibility: input.visibility || 'shared',
    created_by_role: 'coach',
    created_by_id: input.created_by_id || null,
  };
}

export function createGoal(input: {
  client_id: string;
  coach_id?: string | null;
  title: string;
  description?: string;
  category?: FitGoalCategory | string;
  target_value?: number | null;
  unit?: string | null;
  target_date?: string | null;
  review_cadence?: string | null;
  created_by_role?: 'member' | 'coach' | 'owner';
  nowIso?: string;
}): FitGoal {
  const now = input.nowIso || new Date().toISOString();
  return {
    id: newId('goal'),
    client_id: input.client_id,
    coach_id: input.coach_id || null,
    title: String(input.title).trim(),
    description: input.description,
    category: input.category || 'physical',
    status: 'active',
    target_value: input.target_value ?? null,
    unit: input.unit || null,
    start_date: now.slice(0, 10),
    target_date: input.target_date || null,
    review_cadence: input.review_cadence || 'biweekly',
    last_review_at: now,
    check_ins: [],
    created_at: now,
    updated_at: now,
    created_by_role: input.created_by_role || 'coach',
  };
}

export function upsertGoalOnStore(
  store: FitgraphStore,
  goal: FitGoal
): FitgraphStore {
  const goals = [...(store.goals || [])];
  const idx = goals.findIndex((g) => g.id === goal.id);
  if (idx >= 0) goals[idx] = { ...goal, updated_at: new Date().toISOString() };
  else goals.push(goal);
  return { ...store, goals };
}

export function appendJourneyEvent(
  store: FitgraphStore,
  event: FitJourneyEvent
): FitgraphStore {
  const journey_events = [event, ...(store.journey_events || [])];
  return { ...store, journey_events };
}

/** Compact payload for member portal / coach client card */
export function buildRelationshipSummary(
  store: FitgraphStore,
  clientId: string,
  coachId?: string | null,
  opts?: { audience?: 'coach' | 'member' }
) {
  const health = computeRelationshipHealth(store, clientId, coachId);
  const journey = buildClientJourney(store, clientId, {
    limit: 12,
    coachId,
    audience: opts?.audience,
  });
  const goals = activeGoalsForClient(store, clientId);
  const ledger = computeValueLedger(store, clientId, {
    coachId,
    periodDays: 90,
  });
  const stories = (store.member_stories || []).filter(
    (s) => s.client_id === clientId
  );
  return {
    health,
    journey_preview: journey,
    active_goals: goals,
    ledger,
    stories_count: stories.length,
    featured_stories: stories.filter((s) => s.featured),
  };
}

export function relationshipLevelTone(level: RelationshipHealthLevel): string {
  switch (level) {
    case 'strong':
      return 'emerald';
    case 'steady':
      return 'sky';
    case 'cooling':
      return 'amber';
    case 'at_risk':
      return 'rose';
    default:
      return 'slate';
  }
}
