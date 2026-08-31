/**
 * Union two gym snapshots so a stale writer cannot drop records another
 * request just inserted (RSVP, attendance, goals, check-ins).
 * Newer updated_at wins on the same id. Settings come from incoming.
 */
import type { FitgraphStore, FitPublicSettings } from '@/lib/fitness/fitgraph';
import { bookingStamp, dedupeFitgraphBookings } from '@/lib/fitness/gym-bookings';
import {
  parsePersonalBests,
  parseResultLogs,
} from '@/lib/fitness/person-records';

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
  'class_challenges',
  'class_challenge_scores',
  'leaderboard_activities',
  'leaderboard_assignments',
  'leaderboard_scores',
  'subscriptions',
  'membership_plans',
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

function mergeSettings(
  latest?: FitPublicSettings,
  incoming?: FitPublicSettings
): FitPublicSettings {
  const merged = {
    ...(latest || {}),
    ...(incoming || {}),
  };
  return {
    ...merged,
    enabled: merged.enabled ?? latest?.enabled ?? incoming?.enabled ?? false,
    public_token:
      merged.public_token ||
      latest?.public_token ||
      incoming?.public_token ||
      '',
    allow_public_booking:
      merged.allow_public_booking ??
      latest?.allow_public_booking ??
      incoming?.allow_public_booking ??
      true,
    show_coaches:
      merged.show_coaches ??
      latest?.show_coaches ??
      incoming?.show_coaches ??
      true,
    show_pricing:
      merged.show_pricing ??
      latest?.show_pricing ??
      incoming?.show_pricing ??
      true,
  };
}

export function mergeFitgraphStores(
  latest: FitgraphStore,
  incoming: FitgraphStore
): FitgraphStore {
  const next: FitgraphStore = {
    ...latest,
    ...incoming,
    settings: mergeSettings(latest.settings, incoming.settings),
  };
  for (const key of ID_ARRAYS) {
    const merged =
      key === 'goals'
        ? mergeGoalRows(latest[key], incoming[key])
        : key === 'clients'
          ? mergeClientRows(latest[key], incoming[key])
          : mergeRowsById(latest[key], incoming[key]);
    (next as unknown as Record<string, unknown>)[key] = merged;
  }
  if (!(incoming.movements || []).length && (latest.movements || []).length) {
    next.movements = latest.movements;
  }
  dedupeFitgraphBookings(next);
  next.updated_at = new Date().toISOString();
  return next;
}

function portalTokenList(row: Record<string, unknown>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const aliases = Array.isArray(row.portal_token_aliases)
    ? row.portal_token_aliases
    : [];
  for (const raw of [row.portal_token, ...aliases]) {
    const t = String(raw || '').trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Same-id clients: newer row wins, but every portal token is kept. */
function mergeClientRows(latest: unknown, incoming: unknown) {
  const merged = mergeRowsById(latest, incoming);
  const latestById = new Map<string, Record<string, unknown>>();
  const incomingById = new Map<string, Record<string, unknown>>();
  for (const row of asRows(latest)) {
    const id = String(row?.id || '');
    if (id) latestById.set(id, row);
  }
  for (const row of asRows(incoming)) {
    const id = String(row?.id || '');
    if (id) incomingById.set(id, row);
  }
  return merged.map((row) => {
    const id = String(row?.id || '');
    if (!id) return row;
    const latestRow = latestById.get(id) || {};
    const incomingRow = incomingById.get(id) || {};
    const tokens = [
      ...portalTokenList(row),
      ...portalTokenList(latestRow),
      ...portalTokenList(incomingRow),
    ];
    const unique = [...new Set(tokens)];
    return {
      ...row,
      ...(unique.length
        ? {
            portal_token: unique[0],
            portal_token_aliases: unique.slice(1),
          }
        : {}),
      goals: mergeGoalRows(latestRow.goals, incomingRow.goals),
      personal_bests: (() => {
        try {
          return parsePersonalBests([
            ...asRows(latestRow.personal_bests),
            ...asRows(incomingRow.personal_bests),
          ]);
        } catch {
          return mergeRowsById(
            latestRow.personal_bests,
            incomingRow.personal_bests
          );
        }
      })(),
      result_logs: (() => {
        try {
          return parseResultLogs([
            ...asRows(latestRow.result_logs),
            ...asRows(incomingRow.result_logs),
          ]);
        } catch {
          return mergeRowsById(latestRow.result_logs, incomingRow.result_logs);
        }
      })(),
      injuries: mergeRowsById(latestRow.injuries, incomingRow.injuries),
    };
  });
}

function mergeGoalRows(latest: unknown, incoming: unknown) {
  const latestRows = asRows(latest);
  const incomingRows = asRows(incoming);
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of latestRows) {
    const id = String(row?.id || '');
    if (id) byId.set(id, row);
  }
  for (const row of incomingRows) {
    const id = String(row?.id || '');
    if (!id) continue;
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, row);
      continue;
    }
    const checks = mergeRowsById(prev.check_ins, row.check_ins);
    const newer =
      bookingStamp(row) >= bookingStamp(prev) ? row : prev;
    const older = newer === row ? prev : row;
    const lastCheck = [...checks].sort((a, b) =>
      String(a.at || '').localeCompare(String(b.at || ''))
    ).slice(-1)[0];
    const fromCheck =
      lastCheck?.metric_value != null &&
      Number.isFinite(Number(lastCheck.metric_value))
        ? Number(lastCheck.metric_value)
        : null;
    const current =
      fromCheck ??
      (newer.current_value != null && Number.isFinite(Number(newer.current_value))
        ? newer.current_value
        : older.current_value);
    const start =
      older.start_value != null && Number.isFinite(Number(older.start_value))
        ? older.start_value
        : newer.start_value;
    byId.set(id, {
      ...older,
      ...newer,
      start_value: start,
      current_value: current,
      check_ins: checks,
      updated_at:
        bookingStamp(row) >= bookingStamp(prev)
          ? row.updated_at || prev.updated_at
          : prev.updated_at || row.updated_at,
    });
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
    out.push(byId.get(id) || row);
  }
  for (const row of latestRows) {
    const id = String(row?.id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(byId.get(id) || row);
  }
  return out;
}
