/**
 * Per-class challenge boards: coach sets a test + target, members who
 * attended that class log a score, pack sees who is on top.
 */
import { upsertPersonalBest } from '@/lib/fitness/person-records';
import type { FitBooking, FitClient, FitSession, FitgraphStore } from '@/lib/fitness/fitgraph';

function recId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const CHALLENGE_UNITS = ['kg', 'reps', 'm', 'km', 'min', 'sec', 'rounds'] as const;
export type ChallengeUnit = (typeof CHALLENGE_UNITS)[number] | string;
export type ChallengeWin = 'higher' | 'faster';
export type ChallengeDivision = 'rx' | 'scaled';

export type FitClassChallenge = {
  id: string;
  class_type_id: string;
  /** When set, this test is only for that session. */
  session_id?: string | null;
  coach_id: string;
  title: string;
  unit: string;
  win: ChallengeWin;
  target?: number | null;
  notes?: string;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
};

export type FitClassChallengeScore = {
  id: string;
  challenge_id: string;
  client_id: string;
  session_id?: string | null;
  booking_id?: string | null;
  value: number;
  display: string;
  division: ChallengeDivision;
  notes?: string;
  injured?: boolean;
  created_at: string;
  updated_at: string;
};

export type ChallengeBoardRow = {
  rank: number;
  client_id?: string;
  name: string;
  display: string;
  value: number;
  division: ChallengeDivision;
  pct: number | null;
  injured: boolean;
  injury_label?: string;
  updated_at: string;
};

export type ChallengeView = {
  id: string;
  class_type_id: string;
  session_id?: string | null;
  class_name: string;
  title: string;
  unit: string;
  win: ChallengeWin;
  target: number | null;
  target_display: string | null;
  notes?: string;
  status: 'open' | 'closed';
  my_score: {
    display: string;
    division: ChallengeDivision;
    updated_at: string;
  } | null;
  my_rank: number | null;
  field: number;
  board: ChallengeBoardRow[];
};

export function rankOrdinal(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

export function standingLine(view: Pick<ChallengeView, 'my_rank' | 'field' | 'my_score'>): string {
  if (!view.field) return 'No scores yet';
  if (!view.my_rank) return `Not on the board · ${view.field} logged`;
  return `You are ${rankOrdinal(view.my_rank)} of ${view.field}`;
}

export function parseChallengeWin(raw: unknown): ChallengeWin {
  return String(raw || '') === 'faster' ? 'faster' : 'higher';
}

/** Turn "140", "22.5", "2:30", or "1:02:30" into a comparable number. */
export function parseChallengeValue(
  raw: unknown,
  win: ChallengeWin
): { value: number; display: string } | { error: string } {
  const s = String(raw ?? '').trim();
  if (!s) return { error: 'Add a score' };
  if (s.includes(':')) {
    const parts = s.split(':').map((p) => Number(p));
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) {
      return { error: 'Use a time like 2:30' };
    }
    let seconds = 0;
    if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    else if (parts.length === 3) {
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else return { error: 'Use a time like 2:30' };
    if (seconds <= 0) return { error: 'Time must be greater than 0' };
    return { value: seconds, display: s };
  }
  const n = Number(s.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return { error: 'Enter a number greater than 0' };
  if (win === 'faster') {
    return { value: n, display: s };
  }
  return { value: n, display: s };
}

export function formatChallengeTarget(
  target: number | null | undefined,
  win: ChallengeWin,
  unit: string
): string | null {
  if (target == null || !Number.isFinite(target)) return null;
  if (win === 'faster' && target >= 60) {
    const m = Math.floor(target / 60);
    const s = Math.round(target % 60);
    return `${m}:${String(s).padStart(2, '0')}${unit ? ` ${unit}` : ''}`;
  }
  const n = Number(target);
  const shown = n % 1 ? n.toFixed(1) : String(n);
  return unit ? `${shown} ${unit}` : shown;
}

export function challengePct(
  value: number,
  target: number | null | undefined,
  win: ChallengeWin
): number | null {
  if (target == null || !Number.isFinite(target) || target <= 0 || value <= 0) {
    return null;
  }
  const pct = win === 'faster' ? (target / value) * 100 : (value / target) * 100;
  return Math.round(pct);
}

export function parseChallenges(raw: unknown): FitClassChallenge[] {
  if (!Array.isArray(raw)) return [];
  const out: FitClassChallenge[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const title = String(r.title || r.name || '').trim();
    const class_type_id = String(r.class_type_id || '').trim();
    if (!title || !class_type_id) continue;
    const targetRaw = r.target;
    const target =
      targetRaw == null || targetRaw === ''
        ? null
        : Number(targetRaw);
    out.push({
      id: String(r.id || '').trim() || recId('ch'),
      class_type_id,
      session_id: String(r.session_id || '').trim() || null,
      coach_id: String(r.coach_id || '').trim(),
      title,
      unit: String(r.unit || 'kg').trim() || 'kg',
      win: parseChallengeWin(r.win),
      target: target != null && Number.isFinite(target) ? target : null,
      notes: String(r.notes || '').trim() || undefined,
      status: String(r.status || '') === 'closed' ? 'closed' : 'open',
      created_at: String(r.created_at || new Date().toISOString()),
      updated_at: String(r.updated_at || new Date().toISOString()),
    });
  }
  return out;
}

export function parseChallengeScores(raw: unknown): FitClassChallengeScore[] {
  if (!Array.isArray(raw)) return [];
  const out: FitClassChallengeScore[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const challenge_id = String(r.challenge_id || '').trim();
    const client_id = String(r.client_id || '').trim();
    const value = Number(r.value);
    if (!challenge_id || !client_id || !Number.isFinite(value)) continue;
    out.push({
      id: String(r.id || '').trim() || recId('chs'),
      challenge_id,
      client_id,
      session_id: String(r.session_id || '').trim() || null,
      booking_id: String(r.booking_id || '').trim() || null,
      value,
      display: String(r.display || value),
      division: String(r.division || '') === 'scaled' ? 'scaled' : 'rx',
      notes: String(r.notes || '').trim() || undefined,
      injured: r.injured === true,
      created_at: String(r.created_at || new Date().toISOString()),
      updated_at: String(r.updated_at || new Date().toISOString()),
    });
  }
  return out;
}

export function upsertClassChallenge(
  list: FitClassChallenge[] | undefined,
  patch: Record<string, unknown>,
  now = new Date().toISOString()
): { list: FitClassChallenge[]; row: FitClassChallenge; error?: string } {
  const title = String(patch.title || '').trim();
  const class_type_id = String(patch.class_type_id || '').trim();
  if (!title) {
    return {
      list: list || [],
      row: (list || [])[0],
      error: 'Name the test (e.g. Back squat 5RM)',
    };
  }
  if (!class_type_id) {
    return { list: list || [], row: (list || [])[0], error: 'Pick a class' };
  }
  const win = parseChallengeWin(patch.win);
  let target: number | null = null;
  if (patch.target != null && String(patch.target).trim() !== '') {
    const parsed = parseChallengeValue(patch.target, win);
    if ('error' in parsed) {
      return { list: list || [], row: (list || [])[0], error: parsed.error };
    }
    target = parsed.value;
  }
  const session_id = String(patch.session_id || '').trim() || null;
  const id = String(patch.id || '').trim();
  const prev = parseChallenges(list);
  const existing =
    (id && prev.find((c) => c.id === id)) ||
    prev.find(
      (c) =>
        c.class_type_id === class_type_id &&
        (c.session_id || null) === session_id &&
        c.status === 'open'
    );
  const row: FitClassChallenge = {
    id: existing?.id || recId('ch'),
    class_type_id,
    session_id,
    coach_id: String(patch.coach_id || existing?.coach_id || '').trim(),
    title,
    unit: String(patch.unit || existing?.unit || 'kg').trim() || 'kg',
    win,
    target,
    notes: String(patch.notes || '').trim() || undefined,
    status: String(patch.status || '') === 'closed' ? 'closed' : 'open',
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  const next = prev.filter((c) => c.id !== row.id);
  next.unshift(row);
  return { list: next, row };
}

export function closeClassChallenge(
  list: FitClassChallenge[] | undefined,
  id: string,
  now = new Date().toISOString()
): FitClassChallenge[] {
  return parseChallenges(list).map((c) =>
    c.id === id ? { ...c, status: 'closed', updated_at: now } : c
  );
}

export function challengeForSession(
  store: Pick<FitgraphStore, 'class_challenges'>,
  session: Pick<FitSession, 'id' | 'class_type_id'>
): FitClassChallenge | null {
  const open = parseChallenges(store.class_challenges).filter(
    (c) => c.status === 'open'
  );
  const pinned = open.find((c) => c.session_id === session.id);
  if (pinned) return pinned;
  const byType = open
    .filter((c) => c.class_type_id === session.class_type_id && !c.session_id)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return byType[0] || null;
}

export function clientEligibleForChallenge(
  store: Pick<FitgraphStore, 'sessions' | 'bookings'>,
  challenge: FitClassChallenge,
  clientId: string,
  sessionId?: string | null
): { ok: true; session: FitSession; booking: FitBooking } | { ok: false; error: string } {
  const bookings = (store.bookings || []).filter(
    (b) =>
      b.client_id === clientId &&
      b.status !== 'cancelled' &&
      b.status !== 'waitlist'
  );
  const sessions = (store.sessions || []).filter((s) => {
    if (s.status === 'cancelled') return false;
    if (challenge.session_id) return s.id === challenge.session_id;
    if (sessionId) return s.id === sessionId;
    return s.class_type_id === challenge.class_type_id;
  });
  for (const s of sessions) {
    const booking = bookings.find((b) => b.session_id === s.id);
    if (booking) return { ok: true, session: s, booking };
  }
  return {
    ok: false,
    error: 'Only people on this class can log a score.',
  };
}

export function upsertChallengeScore(
  list: FitClassChallengeScore[] | undefined,
  patch: {
    challenge_id: string;
    client_id: string;
    session_id?: string | null;
    booking_id?: string | null;
    value: number;
    display: string;
    division?: ChallengeDivision;
    notes?: string;
    injured?: boolean;
  },
  now = new Date().toISOString()
): { list: FitClassChallengeScore[]; row: FitClassChallengeScore } {
  const prev = parseChallengeScores(list);
  const idx = prev.findIndex(
    (s) => s.challenge_id === patch.challenge_id && s.client_id === patch.client_id
  );
  const existing = idx >= 0 ? prev[idx] : null;
  const row: FitClassChallengeScore = {
    id: existing?.id || recId('chs'),
    challenge_id: patch.challenge_id,
    client_id: patch.client_id,
    session_id: patch.session_id || existing?.session_id || null,
    booking_id: patch.booking_id || existing?.booking_id || null,
    value: patch.value,
    display: patch.display,
    division: patch.division === 'scaled' ? 'scaled' : 'rx',
    notes: patch.notes || undefined,
    injured: patch.injured === true,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  const next = [...prev];
  if (idx >= 0) next[idx] = row;
  else next.unshift(row);
  return { list: next, row };
}

function injuryLabel(client?: FitClient | null): { injured: boolean; label: string } {
  const listed = client?.injuries || [];
  const active = listed.filter((e) =>
    ['acute', 'recovering', 'chronic'].includes(String(e.status || ''))
  );
  if (active.length) {
    return {
      injured: true,
      label: active
        .map((e) => e.area)
        .filter(Boolean)
        .slice(0, 2)
        .join(', '),
    };
  }
  const health = client?.health;
  if (!health) return { injured: false, label: '' };
  const areas = health.injury_areas || [];
  const status = String(health.injury_status || '');
  const injured =
    health.injured === true ||
    (areas.length > 0 && status !== 'cleared' && status !== 'none');
  if (!injured) return { injured: false, label: '' };
  return {
    injured: true,
    label: areas.slice(0, 2).join(', ') || 'Injured',
  };
}

export function buildChallengeBoard(
  store: Pick<FitgraphStore, 'class_challenge_scores' | 'clients'>,
  challenge: FitClassChallenge
): ChallengeBoardRow[] {
  const scores = parseChallengeScores(store.class_challenge_scores).filter(
    (s) => s.challenge_id === challenge.id
  );
  const latest = new Map<string, FitClassChallengeScore>();
  for (const s of scores) {
    const prev = latest.get(s.client_id);
    if (!prev || s.updated_at >= prev.updated_at) latest.set(s.client_id, s);
  }
  const rows = [...latest.values()].map((s) => {
    const client = (store.clients || []).find((c) => c.id === s.client_id);
    const inj = injuryLabel(client);
    return {
      rank: 0,
      client_id: s.client_id,
      name: client?.name || 'Member',
      display: s.display + (challenge.unit ? ` ${challenge.unit}` : ''),
      value: s.value,
      division: s.division,
      pct: challengePct(s.value, challenge.target, challenge.win),
      injured: s.injured === true || inj.injured,
      injury_label: inj.label || undefined,
      updated_at: s.updated_at,
    };
  });
  rows.sort((a, b) => {
    if (a.division !== b.division) return a.division === 'rx' ? -1 : 1;
    return challenge.win === 'faster' ? a.value - b.value : b.value - a.value;
  });
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export function challengeOnSessionId(
  store: FitgraphStore,
  sessionId: string,
  opts?: { clientId?: string | null; hideIds?: boolean }
): ChallengeView | null {
  const session = (store.sessions || []).find((s) => s.id === sessionId);
  if (!session) return null;
  return viewForSession(store, session, opts);
}

export function viewForSession(
  store: FitgraphStore,
  session: Pick<FitSession, 'id' | 'class_type_id'>,
  opts?: { clientId?: string | null; hideIds?: boolean }
): ChallengeView | null {
  const ch = challengeForSession(store, session);
  if (!ch) return null;
  return challengeView(store, ch, opts);
}

export function challengeView(
  store: FitgraphStore,
  challenge: FitClassChallenge,
  opts?: { clientId?: string | null; hideIds?: boolean }
): ChallengeView {
  const ct = (store.class_types || []).find((c) => c.id === challenge.class_type_id);
  const board = buildChallengeBoard(store, challenge);
  const mine = opts?.clientId
    ? board.find((r) => r.client_id === opts.clientId)
    : null;
  return {
    id: challenge.id,
    class_type_id: challenge.class_type_id,
    session_id: challenge.session_id || null,
    class_name: ct?.name || 'Class',
    title: challenge.title,
    unit: challenge.unit,
    win: challenge.win,
    target: challenge.target ?? null,
    target_display: formatChallengeTarget(
      challenge.target,
      challenge.win,
      challenge.unit
    ),
    notes: challenge.notes,
    status: challenge.status,
    my_score: mine
      ? {
          display: mine.display,
          division: mine.division,
          updated_at: mine.updated_at,
        }
      : null,
    my_rank: mine?.rank ?? null,
    field: board.length,
    board: opts?.hideIds
      ? board.map(({ client_id: _cid, ...rest }) => rest)
      : board,
  };
}

export function openChallengesForClient(
  store: FitgraphStore,
  clientId: string
): ChallengeView[] {
  const open = parseChallenges(store.class_challenges).filter(
    (c) => c.status === 'open'
  );
  const scoredIds = new Set(
    parseChallengeScores(store.class_challenge_scores)
      .filter((s) => s.client_id === clientId)
      .map((s) => s.challenge_id)
  );
  const out: ChallengeView[] = [];
  for (const ch of open) {
    const eligible = clientEligibleForChallenge(store, ch, clientId);
    if (!eligible.ok && !scoredIds.has(ch.id)) continue;
    out.push(challengeView(store, ch, { clientId, hideIds: true }));
  }
  return out.sort((a, b) => a.class_name.localeCompare(b.class_name));
}

export type CoachClassLeaderboard = {
  class_type_id: string;
  class_name: string;
  challenges: ChallengeView[];
};

export function openChallengesGroupedForCoach(
  store: FitgraphStore,
  coachId: string
): CoachClassLeaderboard[] {
  const teachIds = new Set(
    (store.sessions || [])
      .filter(
        (s) =>
          s.coach_id === coachId &&
          s.status !== 'cancelled' &&
          s.class_type_id
      )
      .map((s) => s.class_type_id)
  );
  const open = parseChallenges(store.class_challenges).filter((c) => {
    if (c.status !== 'open') return false;
    return c.coach_id === coachId || teachIds.has(c.class_type_id);
  });
  const groups = new Map<string, ChallengeView[]>();
  for (const ch of open) {
    const view = challengeView(store, ch);
    const list = groups.get(ch.class_type_id) || [];
    list.push(view);
    groups.set(ch.class_type_id, list);
  }
  return [...groups.entries()]
    .map(([class_type_id, challenges]) => ({
      class_type_id,
      class_name: challenges[0]?.class_name || 'Class',
      challenges,
    }))
    .sort((a, b) => a.class_name.localeCompare(b.class_name));
}

export function stampPbFromChallenge(
  client: FitClient,
  challenge: FitClassChallenge,
  display: string,
  now: string
) {
  const result = upsertPersonalBest(
    client.personal_bests,
    {
      title: challenge.title,
      value: display,
      unit: challenge.unit,
      achieved_on: now.slice(0, 10),
    },
    now
  );
  if (!result.error) client.personal_bests = result.list;
}
