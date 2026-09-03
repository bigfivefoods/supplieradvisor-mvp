import { type FitBooking, type FitgraphStore } from '@/lib/fitness/fitgraph';
import { GYM_DEFAULT_TZ, isoDateInZone } from '@/lib/fitness/gym-local-time';
import { addDaysIso } from '@/lib/schedule/recurrence';

export type FitgraphDeskGetWindowOptions = {
  include?: string | null;
  bookings?: string | null;
  checkIns?: string | null;
  now?: Date;
};

function bookingIsPendingFeedback(row: FitBooking): boolean {
  return Boolean(
    row.status === 'attended' &&
      row.feedback_token &&
      !row.feedback_submitted_at
  );
}

export function fitgraphDeskGetWindow(
  store: FitgraphStore,
  opts?: FitgraphDeskGetWindowOptions
): FitgraphStore {
  const include = String(opts?.include || '').toLowerCase();
  const includeLibrary = include === 'library';
  if (includeLibrary) return store;

  const includeHistory = include === 'history';
  const includeAllHistory =
    String(opts?.bookings || '').toLowerCase() === 'all' &&
    String(opts?.checkIns || '').toLowerCase() === 'all';

  if (includeHistory || includeAllHistory) {
    return {
      ...store,
      movements: [],
      watch_sessions: [],
    };
  }

  const tz = store.settings?.timezone || GYM_DEFAULT_TZ;
  const today = isoDateInZone(tz, opts?.now || new Date());
  const bookingsFrom = addDaysIso(today, -14);
  const bookingsTo = addDaysIso(today, 60);
  const checkInsFrom = addDaysIso(today, -14);

  const sessionDateById = new Map(
    (store.sessions || []).map((s) => [s.id, String(s.date || '').slice(0, 10)])
  );

  const bookings = (store.bookings || []).filter((row) => {
    if (row.status === 'booked' || row.status === 'waitlist') return true;
    if (bookingIsPendingFeedback(row)) return true;
    const sessionDate = sessionDateById.get(row.session_id);
    return Boolean(
      sessionDate && sessionDate >= bookingsFrom && sessionDate <= bookingsTo
    );
  });

  const check_ins = (store.check_ins || []).filter((row) => {
    const date = String(row.date || '').slice(0, 10);
    return date >= checkInsFrom && date <= today;
  });

  return {
    ...store,
    bookings,
    check_ins,
    movements: [],
    watch_sessions: [],
  };
}
