/**
 * GymAdvisor® — tertiary / services gym OS (Fitness & wellness industry).
 * Coaches, clients/members, memberships, class types, calendar sessions,
 * bookings, check-ins, PT packs. Stored on profiles.metadata.fitgraph.
 *
 * NOTE: This is a temporary stub while the full file is restored.
 * Import of core types is re-exported from relationship + minimal surface.
 */

export const FITGRAPH_MODULE_ID = 'fitgraph' as const;
export const FITGRAPH_META_KEY = 'fitgraph';
export const GYM_BRAND_YELLOW = '#E8E830';
export const GYM_BRAND_YELLOW_DEEP = '#6B6B00';

export function gymBrandColor(raw?: string | null): string {
  return String(raw || '').trim() || GYM_BRAND_YELLOW;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Minimal types so the rest of the app typechecks while full store is restored
export type FitCoach = { id: string; code: string; name: string; [key: string]: unknown };
export type FitClient = { id: string; code: string; name: string; coach_id?: string | null; [key: string]: unknown };
export type FitMembershipPlan = { id: string; code: string; name: string; price_zar: number; [key: string]: unknown };
export type FitSubscription = { id: string; client_id: string; plan_id: string; status: string; [key: string]: unknown };
export type FitClassType = { id: string; code: string; name: string; [key: string]: unknown };
export type FitSession = { id: string; class_type_id: string; date: string; start_time: string; [key: string]: unknown };
export type FitBooking = { id: string; session_id: string; client_id: string; status: string; [key: string]: unknown };
export type FitCheckIn = { id: string; client_id: string; date: string; [key: string]: unknown };
export type FitPtPack = { id: string; client_id: string; sessions_total: number; sessions_used: number; [key: string]: unknown };
export type FitClassFeedback = { id: string; session_id: string; role: string; [key: string]: unknown };
export type FitPublicSettings = { enabled: boolean; public_token: string; allow_public_booking: boolean; show_coaches: boolean; show_pricing: boolean; [key: string]: unknown };

export interface FitgraphStore {
  coaches: FitCoach[];
  clients: FitClient[];
  membership_plans: FitMembershipPlan[];
  subscriptions: FitSubscription[];
  class_types: FitClassType[];
  sessions: FitSession[];
  bookings: FitBooking[];
  check_ins: FitCheckIn[];
  pt_packs: FitPtPack[];
  class_feedback?: FitClassFeedback[];
  visit_notes?: unknown[];
  outcome_scores?: unknown[];
  treatment_plans?: unknown[];
  threads?: unknown[];
  goals?: import('@/lib/fitness/fitgraph-relationship').FitGoal[];
  journey_events?: import('@/lib/fitness/fitgraph-relationship').FitJourneyEvent[];
  member_stories?: import('@/lib/fitness/fitgraph-relationship').FitMemberStory[];
  consent_shares?: import('@/lib/fitness/fitgraph-relationship').FitConsentShare[];
  settings?: FitPublicSettings;
  updated_at?: string;
}

export function defaultPublicSettings(companyId?: number): FitPublicSettings {
  return {
    enabled: false,
    public_token: companyId != null ? `fg_${companyId}_${Date.now().toString(36)}` : `fg_${Date.now().toString(36)}`,
    allow_public_booking: true,
    show_coaches: true,
    show_pricing: true,
    timezone: 'Africa/Johannesburg',
  } as FitPublicSettings;
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
    class_feedback: [],
    threads: [],
    settings: defaultPublicSettings(),
  };
}

export function readFitgraphFromMetadata(meta: Record<string, unknown> | null | undefined): FitgraphStore {
  if (!meta || typeof meta !== 'object') return emptyFitgraphStore();
  const raw = meta[FITGRAPH_META_KEY];
  if (!raw || typeof raw !== 'object') return emptyFitgraphStore();
  return { ...emptyFitgraphStore(), ...(raw as object) } as FitgraphStore;
}

export function writeFitgraphToMetadata(meta: Record<string, unknown>, store: FitgraphStore): Record<string, unknown> {
  return { ...meta, [FITGRAPH_META_KEY]: { ...store, updated_at: new Date().toISOString() } };
}

export function summariseFitgraph(store: FitgraphStore) {
  return {
    coachCount: (store.coaches || []).length,
    clientCount: (store.clients || []).length,
    activeMembers: 0,
    sessionsToday: 0,
    bookingsOpen: 0,
    checkInsToday: 0,
  };
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
export function sessionBookingCount(store: FitgraphStore, sessionId: string): number {
  return store.bookings.filter((b) => b.session_id === sessionId && (b.status === 'booked' || b.status === 'attended')).length;
}

// Stubs for symbols imported across the app — full implementations will be restored
export const COACH_SPECIALTIES = ['General'] as const;
export const DEFAULT_COACH_SPECIALTIES = ['General'];
export function getCoachSpecialtyOptions(): string[] { return [...DEFAULT_COACH_SPECIALTIES]; }
export function fitgraphHasFrontDesk(): boolean { return true; }
export function evaluateMemberAccess() { return { level: 'allowed' as const, payment_ok: true, membership_status: 'active', subscription_status: null, plan_name: null, alert: null, member_message: '', frozen: false, period_end: null }; }
export function buildMemberPortalPayload() { return {}; }
export function buildPublicCalendarPayload() { return {}; }
export function buildCoachPortalPayload() { return {}; }
export function createSessionsFromTemplate() { return []; }
export function issueCoachPortalToken(companyId: number) { return `coach_${companyId}_${Date.now().toString(36)}`; }
export function issueClientPortalToken(companyId: number) { return `member_${companyId}_${Date.now().toString(36)}`; }
export function parseCompanyIdFromToken(token: string): number | null { return null; }
export function ensurePublicToken(settings: FitPublicSettings | undefined, companyId?: number) { return settings || defaultPublicSettings(companyId); }
export function sessionsInRange(store: FitgraphStore, from: string, to: string) { return store.sessions.filter((s) => s.date >= from && s.date <= to); }
export function attendanceByClass() { return []; }
export function formatCoachRate() { return '—'; }
export function closeCoachEngagement(coach: FitCoach) { return coach; }
export function reopenCoachEngagement(coach: FitCoach) { return coach; }
export function recordMemberCheckIn(store: FitgraphStore) { return { store, check_in: {} as FitCheckIn, access: evaluateMemberAccess(), duplicate: false, denied: false }; }
export function findClientForCheckIn() { return null; }
export function gymCheckinPath(t: string) { return `/checkin/fitgraph/${t}`; }
export function gymCheckinUrl(o: string, t: string) { return `${o}${gymCheckinPath(t)}`; }
export function upsertClassFeedback() { return {} as FitClassFeedback; }
export function feedbackForSession() { return []; }
export function summariseSessionFeedback() { return { member_count: 0, coach_count: 0, avg_feeling: null, avg_intensity: null, avg_enjoyment: null }; }
export function ensureSessionShareCode(s: FitSession) { return (s as {share_code?: string}).share_code || 's_x'; }
export function buildClassJoinPath(a: string, b: string) { return `/join/fitgraph/${a}/${b}`; }
export function sessionByShareCode() { return undefined; }
export function buildClassJoinPayload() { return null; }
export function buildSessionIcs() { return ''; }
export function buildGoogleCalendarUrl() { return ''; }
export function clampScore(n: unknown, min: number, max: number, fallback: number) { const v = Number(n); return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback; }
export const FEEDBACK_FEELING_LABELS = ['', 'Drained', 'Tired', 'OK', 'Good', 'Energised'] as const;
export const FEEDBACK_TAG_OPTIONS = ['tough', 'fun'] as const;
export const MEMBERSHIP_STATUSES = ['active', 'paused', 'expired', 'cancelled', 'trial'] as const;
export const COACH_RATE_BASES = ['hourly', 'per_class', 'per_session', 'monthly', 'fixed'] as const;
export const FIT_CONTRACT_KINDS = ['membership', 'waiver', 'terms', 'other'] as const;
export const FITGRAPH_PUBLIC_TOKEN_KEY = 'fitgraph_public_token';
export const FITGRAPH_COACH_TOKENS_KEY = 'fitgraph_coach_tokens';
export const FITGRAPH_CLIENT_TOKENS_KEY = 'fitgraph_client_tokens';
export type FitCoachRateBasis = string;
export type FitCoachEngagement = { id: string; start_date: string; end_date: string };
export type FitContractDoc = { id: string; title: string; file_name: string; url: string; uploaded_at: string };
export type FitClientHealth = unknown;
export type FitRecurrence = unknown;
export type FitMemberAccessLevel = 'allowed' | 'allowed_with_warning' | 'blocked';
export type FitMemberAccess = ReturnType<typeof evaluateMemberAccess>;
export type CoachRosterRow = { booking_id: string; client_id: string; status: string; name: string };
export type CoachSessionCard = { session: FitSession; capacity: number; planned: number; roster: CoachRosterRow[] };
