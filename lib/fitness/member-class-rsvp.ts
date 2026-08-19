/**
 * Member RSVP before a class — coming / not coming.
 * Not coming cancels the booking and promotes waitlist.
 */
import { promoteNextWaitlist } from '@/lib/services/advisor-booking';
import type { FitBooking, FitgraphStore } from '@/lib/fitness/fitgraph';

export function applyMemberClassRsvp(
  store: FitgraphStore,
  opts: {
    bookingId: string;
    clientId: string;
    coming: boolean;
    now?: string;
  }
):
  | { ok: true; booking: FitBooking; promoted: FitBooking | null }
  | { ok: false; error: string } {
  const booking = store.bookings.find(
    (b) => b.id === opts.bookingId && b.client_id === opts.clientId
  );
  if (!booking) return { ok: false, error: 'Booking not found' };
  if (booking.status === 'attended') {
    return { ok: false, error: 'This class already happened' };
  }
  const session = store.sessions.find((s) => s.id === booking.session_id);
  if (!session) return { ok: false, error: 'Class not found' };
  const now = opts.now || new Date().toISOString();
  const today = now.slice(0, 10);
  if (session.date < today) {
    return { ok: false, error: 'That class is in the past' };
  }

  booking.rsvp = opts.coming ? 'coming' : 'not_coming';
  booking.rsvp_at = now;

  let promoted: FitBooking | null = null;
  if (!opts.coming && booking.status !== 'cancelled') {
    booking.status = 'cancelled';
    promoted = promoteNextWaitlist(
      store.bookings,
      (b) => b.session_id === booking.session_id,
      now
    );
  } else if (opts.coming && booking.status === 'cancelled') {
    const cap =
      session.capacity ??
      store.class_types.find((t) => t.id === session.class_type_id)
        ?.capacity ??
      0;
    const taken = store.bookings.filter(
      (b) =>
        b.session_id === booking.session_id &&
        (b.status === 'booked' || b.status === 'attended')
    ).length;
    booking.status = cap > 0 && taken >= cap ? 'waitlist' : 'booked';
  }

  return { ok: true, booking, promoted };
}
