/**
 * One roster tick: attended / no-show / back to booked.
 * Issues a class-rating token when the member is marked attended.
 */
import { applyAttendanceToPersonStats } from '@/lib/services/advisor-booking';
import { issueFeedbackPrompt } from '@/lib/services/booking-feedback';
import type { FitBooking, FitgraphStore } from '@/lib/fitness/fitgraph';

export const GYM_ATTEND_STATUSES = [
  'attended',
  'no_show',
  'booked',
  'cancelled',
] as const;

export type GymAttendStatus = (typeof GYM_ATTEND_STATUSES)[number];

export function isGymAttendStatus(v: string): v is GymAttendStatus {
  return (GYM_ATTEND_STATUSES as readonly string[]).includes(v);
}

export function applyGymAttendanceMark(
  store: FitgraphStore,
  opts: {
    bookingId: string;
    status: string;
    now?: string;
    requireSessionId?: string;
  }
):
  | {
      ok: true;
      booking: FitBooking;
      prevStatus: string;
      newlyAttended: boolean;
    }
  | { ok: false; error: string } {
  const now = opts.now || new Date().toISOString();
  const status = String(opts.status || '');
  if (!isGymAttendStatus(status)) {
    return { ok: false, error: 'Invalid status' };
  }
  const booking = store.bookings.find((b) => b.id === opts.bookingId);
  if (!booking) return { ok: false, error: 'Booking not found' };
  if (opts.requireSessionId && booking.session_id !== opts.requireSessionId) {
    return { ok: false, error: 'Booking is not on this class' };
  }
  const prevStatus = booking.status;
  booking.status = status;
  const session = store.sessions.find((s) => s.id === booking.session_id);
  if (
    session &&
    (status === 'attended' || status === 'no_show') &&
    session.status !== 'cancelled'
  ) {
    session.status = 'completed';
  }
  if (
    (status === 'attended' || status === 'no_show') &&
    prevStatus !== status
  ) {
    const ci = store.clients.findIndex((c) => c.id === booking.client_id);
    if (ci >= 0) {
      Object.assign(
        store.clients[ci],
        applyAttendanceToPersonStats(store.clients[ci], status, now)
      );
    }
  }
  let newlyAttended = false;
  if (status === 'attended') {
    const hadToken = Boolean(booking.feedback_token);
    const prompted = issueFeedbackPrompt(booking, now);
    booking.feedback_token = prompted.feedback_token;
    booking.feedback_requested_at = prompted.feedback_requested_at;
    newlyAttended = prevStatus !== 'attended' || !hadToken;
  }
  return { ok: true, booking, prevStatus, newlyAttended };
}
