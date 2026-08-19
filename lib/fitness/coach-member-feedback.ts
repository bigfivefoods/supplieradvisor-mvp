/**
 * Optional per-member note from a coach after a class.
 * Saved on the booking and on the member’s shared journey (profile).
 */
import { createCoachNoteEvent } from '@/lib/fitness/fitgraph-relationship';
import type { FitBooking, FitgraphStore } from '@/lib/fitness/fitgraph';

function clampScore(n: unknown, min: number, max: number): number | null {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.min(max, Math.max(min, Math.round(v)));
}

export function applyCoachMemberClassFeedback(
  store: FitgraphStore,
  opts: {
    bookingId: string;
    coachId: string;
    coachName?: string;
    comment?: string;
    feeling?: unknown;
    rating?: unknown;
    now?: string;
  }
): { ok: true; booking: FitBooking } | { ok: false; error: string } {
  const comment = String(opts.comment || '').trim();
  const feeling = clampScore(opts.feeling, 1, 5);
  const rating = clampScore(opts.rating, 1, 5);
  if (!comment && feeling == null && rating == null) {
    return { ok: false, error: 'Add how they felt, a rating, or a short note' };
  }
  const booking = store.bookings.find((b) => b.id === opts.bookingId);
  if (!booking) return { ok: false, error: 'Booking not found' };
  if (booking.status === 'cancelled') {
    return { ok: false, error: 'Cannot leave feedback on a cancelled booking' };
  }
  const now = opts.now || new Date().toISOString();
  if (comment) {
    booking.coach_feedback = comment;
    booking.coach_feedback_at = now;
  }
  if (feeling != null) booking.coach_member_feeling = feeling;
  if (rating != null) booking.coach_member_rating = rating;
  const session = store.sessions.find((s) => s.id === booking.session_id);
  const ct = session
    ? store.class_types.find((t) => t.id === session.class_type_id)
    : null;
  const title = ct?.name
    ? `Class feedback · ${ct.name}`
    : 'Class feedback';
  const parts = [
    comment,
    feeling != null ? `Feeling ${feeling}/5` : '',
    rating != null ? `Coach rating ${rating}/5` : '',
  ].filter(Boolean);
  store.journey_events = [
    createCoachNoteEvent({
      client_id: booking.client_id,
      coach_id: opts.coachId,
      title,
      body: parts.join('\n'),
      visibility: 'shared',
      created_by_id: opts.coachId,
      nowIso: now,
    }),
    ...(store.journey_events || []),
  ];
  return { ok: true, booking };
}
