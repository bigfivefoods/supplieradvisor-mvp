/**
 * One roster tick: attended / no-show / back to booked.
 * Issues a class-rating token when the member is marked attended.
 */
import { applyAttendanceToPersonStats } from '@/lib/services/advisor-booking';
import { issueFeedbackPrompt } from '@/lib/services/booking-feedback';
import { newId, type FitBooking, type FitgraphStore } from '@/lib/fitness/fitgraph';
import {
  bookingSeatKey,
  dedupeFitgraphBookings,
  findSessionSeat,
} from '@/lib/fitness/gym-bookings';

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

function resolveAttendanceBooking(
  store: FitgraphStore,
  opts: {
    bookingId: string;
    now: string;
    requireSessionId?: string;
    sessionId?: string;
    clientId?: string;
  }
): FitBooking | null {
  const existing = store.bookings.find((b) => b.id === opts.bookingId);
  if (existing) return existing;
  let sessionId = String(opts.requireSessionId || opts.sessionId || '').trim();
  let clientId = String(opts.clientId || '').trim();
  const raw = String(opts.bookingId || '');
  if (raw.startsWith('alloc_')) {
    const rest = raw.slice('alloc_'.length);
    const hit = (store.sessions || []).find(
      (s) => rest === s.id || rest.startsWith(`${s.id}_`)
    );
    if (hit) {
      sessionId = hit.id;
      if (!clientId && rest.startsWith(`${hit.id}_`)) {
        clientId = rest.slice(hit.id.length + 1);
      }
    }
  }
  if (!sessionId || !clientId) return null;
  const seat = findSessionSeat(store, sessionId, clientId);
  if (seat) return seat;
  const created: FitBooking = {
    id: newId('bkg'),
    session_id: sessionId,
    client_id: clientId,
    status: 'booked',
    booked_at: opts.now,
    updated_at: opts.now,
    source: 'desk',
  };
  store.bookings = [created, ...(store.bookings || [])];
  return created;
}

export function applyGymAttendanceMark(
  store: FitgraphStore,
  opts: {
    bookingId: string;
    status: string;
    now?: string;
    requireSessionId?: string;
    sessionId?: string;
    clientId?: string;
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
  const booking = resolveAttendanceBooking(store, {
    bookingId: opts.bookingId,
    now,
    requireSessionId: opts.requireSessionId,
    sessionId: opts.sessionId,
    clientId: opts.clientId,
  });
  if (!booking) return { ok: false, error: 'Booking not found' };
  if (opts.requireSessionId && booking.session_id !== opts.requireSessionId) {
    return { ok: false, error: 'Booking is not on this class' };
  }
  const prevStatus = booking.status;
  booking.status = status;
  booking.updated_at = now;
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
  const seat = bookingSeatKey(booking);
  store.bookings = (store.bookings || []).filter(
    (b) => b.id === booking.id || bookingSeatKey(b) !== seat
  );
  dedupeFitgraphBookings(store);
  return { ok: true, booking, prevStatus, newlyAttended };
}
