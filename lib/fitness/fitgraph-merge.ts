/**
 * Union two gym snapshots so a stale writer cannot drop records another
 * request just inserted (RSVP, attendance, goals, check-ins).
 * Newer updated_at wins on the same id. Settings come from incoming.
 */
import type { FitgraphStore } from '@/lib/fitness/fitgraph';
import { bookingStamp, dedupeFitgraphBookings } from '@/lib/fitness/gym-bookings';

/** Live operational rows that concurrent writers must not drop. */
const ID_ARRAYS: Array<keyof FitgraphStore> = [
  'clients',
  'sessions',
  'bookings',
  'check_ins',
  'class_feedback',
  'programme_enrollments',
  'programme_logs',
  'watch_sessions',
  'goals',
  'journey_events',
];

function asRows(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];
}

export function mergeRowsById(
  latest: unknown,
  incoming: unknown
): Array<Record<string, unknown>> {
  const latestRows = asRows(latest);
  const incomingRows = asRows(incoming);
  const map = new Map<string, Record<string, unknown>>();
  for (const row of latestRows) {
    const id = String(row?.id || '');
    if (id) map.set(id, row);
  }
  for (const row of incomingRows) {
    const id = String(row?.id || '');
    if (!id) continue;
    const prev = map.get(id);
    if (!prev || bookingStamp(row) >= bookingStamp(prev)) map.set(id, row);
  }
  const out: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const row of incomingRows) {
    const id = String(row?.id || '');
    if (!id) {
      out.push(row);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(map.get(id) || row);
  }
  for (const row of latestRows) {
    const id = String(row?.id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

export function mergeFitgraphStores(
  latest: FitgraphStore,
  incoming: FitgraphStore
): FitgraphStore {
  const next: FitgraphStore = {
    ...latest,
    ...incoming,
    settings: {
      ...(latest.settings || {}),
      ...(incoming.settings || {}),
    },
  };
  for (const key of ID_ARRAYS) {
    const merged = mergeRowsById(latest[key], incoming[key]);
    (next as unknown as Record<string, unknown>)[key] = merged;
  }
  if (!(incoming.movements || []).length && (latest.movements || []).length) {
    next.movements = latest.movements;
  }
  dedupeFitgraphBookings(next);
  next.updated_at = new Date().toISOString();
  return next;
}
