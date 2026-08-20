/**
 * Growth shares — complimentary intro class + membership application links.
 */
import {
  buildClassJoinPath,
  classTypeById,
  coachById,
  ensureSessionShareCode,
  sessionKindOf,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';

export type GrowShareClass = {
  id: string;
  share_code: string;
  class_name: string;
  date: string;
  start_time: string;
  coach_name?: string;
  location?: string;
};

export function gymJoinMemberPath(publicToken: string, kind?: 'group' | 'private' | 'both') {
  const base = `/join/fitgraph/${encodeURIComponent(publicToken)}`;
  if (kind === 'private') return `${base}?kind=private`;
  if (kind === 'both') return `${base}?kind=both`;
  return `${base}?kind=group`;
}

export function gymTrialClassPath(publicToken: string, shareCode: string) {
  return `${buildClassJoinPath(publicToken, shareCode)}?trial=1`;
}

export function isComplimentaryClassInvite(input: {
  complimentary?: unknown;
  trial?: unknown;
  share_code?: unknown;
}): boolean {
  const trial =
    input.complimentary === true ||
    input.trial === true ||
    String(input.trial || '').toLowerCase() === '1';
  return trial && Boolean(String(input.share_code || '').trim());
}

/** Stamp share codes on upcoming class sessions so members can gift a free class. */
export function stampShareCodesForGrow(
  store: FitgraphStore,
  opts?: { from?: string; days?: number }
): boolean {
  const from = opts?.from || new Date().toISOString().slice(0, 10);
  const days = opts?.days ?? 28;
  const end = addDays(from, days);
  let changed = false;
  for (const s of store.sessions || []) {
    if (s.status !== 'scheduled') continue;
    if (s.date < from || s.date > end) continue;
    if (sessionKindOf(store, s) === 'coach_personal') continue;
    const before = s.share_code;
    ensureSessionShareCode(s);
    if (s.share_code !== before) changed = true;
  }
  return changed;
}

export function listGrowShareClasses(
  store: FitgraphStore,
  opts?: { from?: string; days?: number; limit?: number }
): GrowShareClass[] {
  stampShareCodesForGrow(store, opts);
  const from = opts?.from || new Date().toISOString().slice(0, 10);
  const days = opts?.days ?? 28;
  const end = addDays(from, days);
  const limit = opts?.limit ?? 24;
  return (store.sessions || [])
    .filter(
      (s) =>
        s.status === 'scheduled' &&
        s.date >= from &&
        s.date <= end &&
        sessionKindOf(store, s) !== 'coach_personal' &&
        s.share_code
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)
    )
    .slice(0, limit)
    .map((s) => {
      const ct = classTypeById(store, s.class_type_id);
      const coach = coachById(store, s.coach_id);
      return {
        id: s.id,
        share_code: String(s.share_code),
        class_name: ct?.name || 'Class',
        date: s.date,
        start_time: s.start_time,
        coach_name: coach?.name,
        location: s.location,
      };
    });
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
