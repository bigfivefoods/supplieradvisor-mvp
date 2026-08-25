/**
 * One member, one seat on a class. Dedupe leftover duplicate booking rows.
 */
import type { FitBooking, FitgraphStore } from '@/lib/fitness/fitgraph';

export function bookingSeatKey(b: {
  session_id?: string | null;
  client_id?: string | null;
  family_member_id?: string | null;
}): string {
  return `${b.session_id || ''}::${b.client_id || ''}::${b.family_member_id || ''}`;
}

export function bookingStamp(row: {
  updated_at?: string | null;
  rsvp_at?: string | null;
  feedback_requested_at?: string | null;
  booked_at?: string | null;
}): string {
  return String(
    row.updated_at ||
      row.rsvp_at ||
      row.feedback_requested_at ||
      row.booked_at ||
      ''
  );
}

function statusRank(status: string): number {
  if (status === 'attended') return 5;
  if (status === 'no_show') return 4;
  if (status === 'booked') return 3;
  if (status === 'waitlist') return 2;
  return 1;
}

export function pickPreferredBooking(a: FitBooking, b: FitBooking): FitBooking {
  const rank = statusRank(a.status) - statusRank(b.status);
  if (rank !== 0) return rank > 0 ? a : b;
  return bookingStamp(a) >= bookingStamp(b) ? a : b;
}

export function findSessionSeat(
  store: FitgraphStore,
  sessionId: string,
  clientId: string,
  familyMemberId?: string | null
): FitBooking | undefined {
  const fam = familyMemberId || '';
  const live = (store.bookings || []).filter(
    (b) =>
      b.session_id === sessionId &&
      b.client_id === clientId &&
      String(b.family_member_id || '') === fam
  );
  if (!live.length) return undefined;
  return live.reduce((a, b) => pickPreferredBooking(a, b));
}

/** Drop extra booking rows for the same person on the same class. */
export function dedupeFitgraphBookings(store: FitgraphStore): number {
  const groups = new Map<string, FitBooking[]>();
  for (const b of store.bookings || []) {
    const k = bookingSeatKey(b);
    const list = groups.get(k) || [];
    list.push(b);
    groups.set(k, list);
  }
  const keep = new Set<string>();
  for (const list of groups.values()) {
    let winner = list[0];
    for (const b of list.slice(1)) winner = pickPreferredBooking(winner, b);
    keep.add(winner.id);
  }
  const before = (store.bookings || []).length;
  store.bookings = (store.bookings || []).filter((b) => keep.has(b.id));
  return before - store.bookings.length;
}
