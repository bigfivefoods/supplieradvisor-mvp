/**
 * Member RSVP before a class — will attend / will not attend.
 * Not attending frees the spot and promotes waitlist. Class-subscribe
 * members (alloc_ ids) get a real booking row so the coach sees it.
 */
import { promoteNextWaitlist } from '@/lib/services/advisor-booking';
import { newId, type FitBooking, type FitgraphStore } from '@/lib/fitness/fitgraph';

export function resolveClassRsvpSessionId(
  store: FitgraphStore,
  opts: { bookingId: string; clientId: string; sessionId?: string | null }
): string | null {
  const given = String(opts.sessionId || '').trim();
  if (given && store.sessions.some((s) => s.id === given)) return given;
  const booking = store.bookings.find(
    (b) => b.id === opts.bookingId && b.client_id === opts.clientId
  );
  if (booking) return booking.session_id;
  const raw = String(opts.bookingId || '');
  if (!raw.startsWith('alloc_')) return null;
  const hit = store.sessions.find(
    (s) => raw === `alloc_${s.id}` || raw === `alloc_${s.id}_${opts.clientId}`
  );
  return hit?.id || null;
}

export function applyMemberClassRsvp(
  store: FitgraphStore,
  opts: {
    bookingId: string;
    clientId: string;
    coming: boolean;
    sessionId?: string | null;
    now?: string;
  }
):
  | { ok: true; booking: FitBooking; promoted: FitBooking | null }
  | { ok: false; error: string } {
  const now = opts.now || new Date().toISOString();
  const today = now.slice(0, 10);
  const sessionId = resolveClassRsvpSessionId(store, opts);
  if (!sessionId) return { ok: false, error: 'Booking not found' };
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return { ok: false, error: 'Class not found' };
  if (session.date < today) {
    return { ok: false, error: 'That class is in the past' };
  }

  let booking = store.bookings.find(
    (b) =>
      b.client_id === opts.clientId &&
      b.session_id === sessionId &&
      b.status !== 'attended'
  );
  if (booking?.status === 'attended') {
    return { ok: false, error: 'This class already happened' };
  }
  if (!booking) {
    booking = {
      id: newId('bkg'),
      session_id: sessionId,
      client_id: opts.clientId,
      status: 'booked',
      source: 'member',
      booked_at: now,
    };
    store.bookings = [booking, ...store.bookings];
  }

  booking.rsvp = opts.coming ? 'coming' : 'not_coming';
  booking.rsvp_at = now;

  let promoted: FitBooking | null = null;
  if (!opts.coming && booking.status !== 'cancelled') {
    booking.status = 'cancelled';
    promoted = promoteNextWaitlist(
      store.bookings,
      (b) => b.session_id === booking!.session_id,
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
        b.session_id === booking!.session_id &&
        (b.status === 'booked' || b.status === 'attended')
    ).length;
    booking.status = cap > 0 && taken >= cap ? 'waitlist' : 'booked';
  }

  return { ok: true, booking, promoted };
}
