/**
 * Desk lists must not follow array order. SQL merge puts a patched row first;
 * bookings and sessions are shown by date/time, then created_at.
 */
import type { FitBooking, FitSession, FitgraphStore } from '@/lib/fitness/fitgraph';

export function compareFitgraphSessions(a: FitSession, b: FitSession): number {
  return (
    String(a.date || '').localeCompare(String(b.date || '')) ||
    String(a.start_time || '').localeCompare(String(b.start_time || '')) ||
    String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
    String(a.id || '').localeCompare(String(b.id || ''))
  );
}

export function sortFitgraphSessions<T extends FitSession>(sessions: readonly T[]): T[] {
  return [...sessions].sort(compareFitgraphSessions);
}

function bookingCreatedAt(row: FitBooking): string {
  const created = (row as FitBooking & { created_at?: string | null }).created_at;
  return String(created || row.booked_at || '');
}

export function sortFitgraphBookings<T extends FitBooking>(
  bookings: readonly T[],
  sessions: readonly FitSession[]
): T[] {
  const byId = new Map(sessions.map((session) => [session.id, session]));
  return [...bookings].sort((a, b) => {
    const sa = byId.get(a.session_id);
    const sb = byId.get(b.session_id);
    return (
      String(sa?.date || '').localeCompare(String(sb?.date || '')) ||
      String(sa?.start_time || '').localeCompare(String(sb?.start_time || '')) ||
      bookingCreatedAt(a).localeCompare(bookingCreatedAt(b)) ||
      String(a.id || '').localeCompare(String(b.id || ''))
    );
  });
}

/** Shallow copy with bookings and sessions in desk order. */
export function sortFitgraphDeskLists<T extends FitgraphStore>(store: T): T {
  const sessions = sortFitgraphSessions(store.sessions || []);
  return {
    ...store,
    sessions,
    bookings: sortFitgraphBookings(store.bookings || [], sessions),
  };
}
