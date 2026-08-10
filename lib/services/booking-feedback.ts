/**
 * Post-attendance feedback prompts for FitAdvisor members and
 * PhysioAdvisor / DentalAdvisor patients.
 *
 * When a booking is marked attended, a secret feedback_token is issued.
 * Public URL: /f/{module}/{companyId}/{token}
 */

export type FeedbackModule =
  | 'fitgraph'
  | 'physiograph'
  | 'dentalgraph'
  | 'psychiatrygraph'
  | 'medicalgraph';

export type BookingFeedbackPrompt = {
  feedback_token?: string | null;
  feedback_requested_at?: string | null;
  feedback_submitted_at?: string | null;
  feedback_id?: string | null;
};

export type ServiceFeedback = {
  id: string;
  booking_id: string;
  /** session / appointment id */
  event_id: string;
  role: 'member' | 'patient' | 'practitioner' | 'coach' | 'staff';
  person_id?: string | null;
  author_name?: string;
  author_email?: string;
  /** Overall experience 1–5 */
  feeling: number;
  /** Intensity / effort / discomfort 1–10 */
  intensity: number;
  /** Enjoyment / satisfaction 1–5 */
  enjoyment?: number;
  /** Would return / rebook 1–5 */
  would_return?: number;
  comment?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
};

export const FEELING_LABELS = [
  '',
  'Poor',
  'Fair',
  'OK',
  'Good',
  'Excellent',
] as const;

export const SERVICE_FEEDBACK_TAGS = [
  'helpful',
  'professional',
  'on time',
  'ran late',
  'too short',
  'too intense',
  'felt better',
  'need follow-up',
  'great coaching',
  'clear advice',
] as const;

export function newFeedbackToken(): string {
  return `ft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function newFeedbackId(): string {
  return `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clampScore(
  n: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

/** Issue / refresh a feedback request when booking becomes attended */
export function issueFeedbackPrompt<T extends BookingFeedbackPrompt>(
  booking: T,
  now = new Date().toISOString()
): T {
  if (booking.feedback_submitted_at) return booking;
  return {
    ...booking,
    feedback_token: booking.feedback_token || newFeedbackToken(),
    feedback_requested_at: booking.feedback_requested_at || now,
  };
}

export function buildPublicFeedbackPath(
  module: FeedbackModule,
  companyId: number,
  token: string
): string {
  return `/f/${module}/${companyId}/${encodeURIComponent(token)}`;
}

export function buildPublicFeedbackUrl(
  module: FeedbackModule,
  companyId: number,
  token: string,
  origin?: string
): string {
  const path = buildPublicFeedbackPath(module, companyId, token);
  if (origin) return `${origin.replace(/\/$/, '')}${path}`;
  return path;
}

export function upsertServiceFeedback(
  list: ServiceFeedback[] | undefined,
  input: Omit<ServiceFeedback, 'id' | 'created_at' | 'updated_at'> & {
    id?: string;
    created_at?: string;
    updated_at?: string;
  },
  now = new Date().toISOString()
): { list: ServiceFeedback[]; row: ServiceFeedback } {
  const rows = Array.isArray(list) ? [...list] : [];
  const feeling = clampScore(input.feeling, 1, 5, 3);
  const intensity = clampScore(input.intensity, 1, 10, 5);
  const enjoyment =
    input.enjoyment != null
      ? clampScore(input.enjoyment, 1, 5, 3)
      : undefined;
  const would_return =
    input.would_return != null
      ? clampScore(input.would_return, 1, 5, 3)
      : undefined;

  const matchIdx = rows.findIndex((f) => {
    if (f.booking_id === input.booking_id && f.role === input.role) return true;
    if (
      input.person_id &&
      f.person_id === input.person_id &&
      f.event_id === input.event_id &&
      f.role === input.role
    )
      return true;
    return false;
  });

  if (matchIdx >= 0) {
    const prev = rows[matchIdx];
    const row: ServiceFeedback = {
      ...prev,
      feeling,
      intensity,
      enjoyment,
      would_return,
      comment: input.comment != null ? String(input.comment) : prev.comment,
      tags: Array.isArray(input.tags) ? input.tags.map(String) : prev.tags,
      author_name: input.author_name ?? prev.author_name,
      author_email: input.author_email ?? prev.author_email,
      person_id: input.person_id ?? prev.person_id,
      updated_at: now,
    };
    rows[matchIdx] = row;
    return { list: rows, row };
  }

  const row: ServiceFeedback = {
    id: input.id || newFeedbackId(),
    booking_id: input.booking_id,
    event_id: input.event_id,
    role: input.role,
    person_id: input.person_id ?? null,
    author_name: input.author_name,
    author_email: input.author_email,
    feeling,
    intensity,
    enjoyment,
    would_return,
    comment: input.comment != null ? String(input.comment) : undefined,
    tags: Array.isArray(input.tags) ? input.tags.map(String) : undefined,
    created_at: input.created_at || now,
    updated_at: now,
  };
  rows.push(row);
  return { list: rows, row };
}

export function pendingFeedbackCount(
  bookings: Array<
    BookingFeedbackPrompt & { status?: string; id?: string }
  >
): number {
  return bookings.filter(
    (b) =>
      b.status === 'attended' &&
      b.feedback_token &&
      !b.feedback_submitted_at
  ).length;
}
