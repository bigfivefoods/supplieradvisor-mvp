/**
 * Member ticks "I completed this class" after the session.
 */
import { applyAttendanceToPersonStats } from '@/lib/services/advisor-booking';
import {
  issueFeedbackPrompt,
  sessionHasEnded,
} from '@/lib/services/booking-feedback';
import {
  recordMemberCheckIn,
  type FitBooking,
  type FitClient,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';

export function completeMemberClass(
  store: FitgraphStore,
  opts: {
    client: FitClient;
    bookingId: string;
    now?: string;
  }
):
  | { ok: true; store: FitgraphStore; booking: FitBooking; already: boolean }
  | { ok: false; error: string } {
  const now = opts.now || new Date().toISOString();
  const booking = store.bookings.find(
    (b) => b.id === opts.bookingId && b.client_id === opts.client.id
  );
  if (!booking) return { ok: false, error: 'Booking not found' };
  if (booking.status === 'cancelled') {
    return { ok: false, error: 'That class was cancelled' };
  }
  const session = store.sessions.find((s) => s.id === booking.session_id);
  if (!session) return { ok: false, error: 'Class not found' };
  if (!sessionHasEnded(session.date, session.start_time, now)) {
    return { ok: false, error: 'You can tick complete after the class has started' };
  }
  if (booking.status === 'attended') {
    return { ok: true, store, booking, already: true };
  }

  booking.status = 'attended';
  const prompted = issueFeedbackPrompt(booking, now);
  booking.feedback_token = prompted.feedback_token;
  booking.feedback_requested_at = prompted.feedback_requested_at;

  const ci = store.clients.findIndex((c) => c.id === opts.client.id);
  if (ci >= 0) {
    Object.assign(
      store.clients[ci],
      applyAttendanceToPersonStats(store.clients[ci], 'attended', now)
    );
  }

  const checked = recordMemberCheckIn(
    store,
    ci >= 0 ? store.clients[ci] : opts.client,
    {
      method: 'class',
      session_id: booking.session_id,
      notes: session ? `Completed ${session.date} ${session.start_time}` : 'Completed class',
      now: new Date(now),
    }
  );

  return {
    ok: true,
    store: checked.store,
    booking,
    already: false,
  };
}
