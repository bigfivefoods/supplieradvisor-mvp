/**
 * Optional per-member note from a coach after a class.
 */
import { createCoachNoteEvent } from '@/lib/fitness/fitgraph-relationship';
import type { FitBooking, FitgraphStore } from '@/lib/fitness/fitgraph';

export function applyCoachMemberClassFeedback(
  store: FitgraphStore,
  opts: {
    bookingId: string;
    coachId: string;
    coachName?: string;
    comment: string;
    now?: string;
  }
): { ok: true; booking: FitBooking } | { ok: false; error: string } {
  const comment = String(opts.comment || '').trim();
  if (!comment) return { ok: false, error: 'Write a short note for the member' };
  const booking = store.bookings.find((b) => b.id === opts.bookingId);
  if (!booking) return { ok: false, error: 'Booking not found' };
  if (booking.status === 'cancelled') {
    return { ok: false, error: 'Cannot leave feedback on a cancelled booking' };
  }
  const now = opts.now || new Date().toISOString();
  booking.coach_feedback = comment;
  booking.coach_feedback_at = now;
  const session = store.sessions.find((s) => s.id === booking.session_id);
  const ct = session
    ? store.class_types.find((t) => t.id === session.class_type_id)
    : null;
  const title = ct?.name
    ? `Class feedback · ${ct.name}`
    : 'Class feedback';
  store.journey_events = [
    createCoachNoteEvent({
      client_id: booking.client_id,
      coach_id: opts.coachId,
      title,
      body: comment,
      visibility: 'shared',
      created_by_id: opts.coachId,
      nowIso: now,
    }),
    ...(store.journey_events || []),
  ];
  return { ok: true, booking };
}
