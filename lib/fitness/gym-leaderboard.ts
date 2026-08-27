/**
 * GymAdvisor leadership board.
 * Owner sets activities + men/women age-band benchmarks.
 * Coaches pin those (or extra) activities on a class.
 * Members log scores in the PWA; rank is auto-split by age + sex.
 */
import {
  challengePct,
  formatChallengeTarget,
  parseChallengeValue,
  parseChallengeWin,
  rankOrdinal,
  type ChallengeWin,
} from '@/lib/fitness/class-challenges';
import { ageFromDob, memberBirthday } from '@/lib/fitness/member-profile';
import type { FitBooking, FitClient, FitgraphStore } from '@/lib/fitness/fitgraph';

function recId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const GYM_BOARD_UNITS = [
  'kg',
  'reps',
  'm',
  'km',
  'min',
  'sec',
  'rounds',
  'cal',
] as const;

export const GYM_BOARD_AGE_BANDS = [
  { id: 'u18', label: 'Under 18', min: 0, max: 17 },
  { id: '18_24', label: '18–24', min: 18, max: 24 },
  { id: '25_34', label: '25–34', min: 25, max: 34 },
  { id: '35_44', label: '35–44', min: 35, max: 44 },
  { id: '45_54', label: '45–54', min: 45, max: 54 },
  { id: '55_64', label: '55–64', min: 55, max: 64 },
  { id: '65p', label: '65+', min: 65, max: 120 },
] as const;

export type GymBoardAgeBandId = (typeof GYM_BOARD_AGE_BANDS)[number]['id'];
export type GymBoardSex = 'male' | 'female';
export type GymBoardWin = ChallengeWin;

export type GymBoardBenchmark = {
  sex: GymBoardSex;
  band_id: GymBoardAgeBandId;
  value: number;
};

export type GymBoardActivity = {
  id: string;
  name: string;
  unit: string;
  win: GymBoardWin;
  notes?: string;
  active: boolean;
  source: 'owner' | 'coach';
  coach_id?: string | null;
  benchmarks: GymBoardBenchmark[];
  created_at: string;
  updated_at: string;
};

export type GymBoardAssignment = {
  id: string;
  activity_id: string;
  class_type_id: string;
  session_id?: string | null;
  coach_id?: string | null;
  created_at: string;
};

export type GymBoardScore = {
  id: string;
  activity_id: string;
  client_id: string;
  session_id?: string | null;
  class_type_id?: string | null;
  value: number;
  display: string;
  created_at: string;
  updated_at: string;
};

export type GymBoardDivision = {
  sex: GymBoardSex | null;
  age: number | null;
  band_id: GymBoardAgeBandId | null;
  band_label: string | null;
  need_profile: boolean;
};

export type GymBoardRow = {
  rank: number;
  client_id: string;
  name: string;
  display: string;
  value: number;
  pct: number | null;
  is_me?: boolean;
  updated_at: string;
};

export type GymBoardActivityView = {
  id: string;
  name: string;
  unit: string;
  win: GymBoardWin;
  source: 'owner' | 'coach';
  class_name?: string | null;
  benchmark: { value: number; display: string } | null;
  my_score: { display: string; value: number; updated_at: string } | null;
  my_rank: number | null;
  field: number;
  standing: string;
  board: GymBoardRow[];
};

function asObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function gymBoardAgeBandForAge(age: number | null): (typeof GYM_BOARD_AGE_BANDS)[number] | null {
  if (age == null || !Number.isFinite(age)) return null;
  return GYM_BOARD_AGE_BANDS.find((b) => age >= b.min && age <= b.max) || null;
}

export function parseGymBoardSex(raw: unknown): GymBoardSex | null {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (s === 'male' || s === 'm' || s === 'man' || s === 'men') return 'male';
  if (s === 'female' || s === 'f' || s === 'woman' || s === 'women') {
    return 'female';
  }
  return null;
}

export function memberGymBoardSex(client: FitClient): GymBoardSex | null {
  return parseGymBoardSex(
    client.passport?.sex ||
      (client.medical as { sex?: string } | undefined)?.sex
  );
}

export function memberGymBoardDivision(client: FitClient): GymBoardDivision {
  const age = ageFromDob(memberBirthday(client));
  const sex = memberGymBoardSex(client);
  const band = gymBoardAgeBandForAge(age);
  return {
    sex,
    age,
    band_id: band?.id || null,
    band_label: band?.label || null,
    need_profile: !sex || !band,
  };
}

export function parseGymBoardActivities(raw: unknown): GymBoardActivity[] {
  if (!Array.isArray(raw)) return [];
  const out: GymBoardActivity[] = [];
  for (const row of raw) {
    const r = asObject(row);
    const name = String(r.name || r.title || '').trim();
    if (!name) continue;
    const benchmarks: GymBoardBenchmark[] = [];
    const rawMarks = Array.isArray(r.benchmarks) ? r.benchmarks : [];
    for (const mark of rawMarks) {
      const m = asObject(mark);
      const sex = parseGymBoardSex(m.sex);
      const band = GYM_BOARD_AGE_BANDS.find(
        (b) => b.id === String(m.band_id || m.band || '')
      );
      const value = Number(m.value);
      if (!sex || !band || !Number.isFinite(value) || value <= 0) continue;
      benchmarks.push({ sex, band_id: band.id, value });
    }
    out.push({
      id: String(r.id || '').trim() || recId('gla'),
      name,
      unit: String(r.unit || 'kg').trim() || 'kg',
      win: parseChallengeWin(r.win),
      notes: String(r.notes || '').trim() || undefined,
      active: r.active !== false,
      source: String(r.source || '') === 'coach' ? 'coach' : 'owner',
      coach_id: r.coach_id != null ? String(r.coach_id) : null,
      benchmarks,
      created_at: String(r.created_at || new Date().toISOString()),
      updated_at: String(r.updated_at || new Date().toISOString()),
    });
  }
  return out;
}

export function parseGymBoardAssignments(raw: unknown): GymBoardAssignment[] {
  if (!Array.isArray(raw)) return [];
  const out: GymBoardAssignment[] = [];
  for (const row of raw) {
    const r = asObject(row);
    const activity_id = String(r.activity_id || '').trim();
    const class_type_id = String(r.class_type_id || '').trim();
    if (!activity_id || !class_type_id) continue;
    out.push({
      id: String(r.id || '').trim() || recId('gln'),
      activity_id,
      class_type_id,
      session_id: String(r.session_id || '').trim() || null,
      coach_id: r.coach_id != null ? String(r.coach_id) : null,
      created_at: String(r.created_at || new Date().toISOString()),
    });
  }
  return out;
}

export function parseGymBoardScores(raw: unknown): GymBoardScore[] {
  if (!Array.isArray(raw)) return [];
  const out: GymBoardScore[] = [];
  for (const row of raw) {
    const r = asObject(row);
    const activity_id = String(r.activity_id || '').trim();
    const client_id = String(r.client_id || '').trim();
    const value = Number(r.value);
    if (!activity_id || !client_id || !Number.isFinite(value)) continue;
    out.push({
      id: String(r.id || '').trim() || recId('gls'),
      activity_id,
      client_id,
      session_id: String(r.session_id || '').trim() || null,
      class_type_id: String(r.class_type_id || '').trim() || null,
      value,
      display: String(r.display || value),
      created_at: String(r.created_at || new Date().toISOString()),
      updated_at: String(r.updated_at || new Date().toISOString()),
    });
  }
  return out;
}

export function upsertGymBoardActivity(
  list: GymBoardActivity[] | undefined,
  patch: Record<string, unknown>,
  now = new Date().toISOString()
): { list: GymBoardActivity[]; row: GymBoardActivity; error?: string } {
  const name = String(patch.name || patch.title || '').trim();
  if (!name) {
    return {
      list: list || [],
      row: (list || [])[0],
      error: 'Name the activity (e.g. Back squat 5RM)',
    };
  }
  const win = parseChallengeWin(patch.win);
  const prev = parseGymBoardActivities(list);
  const id = String(patch.id || '').trim();
  const existing = id ? prev.find((a) => a.id === id) : undefined;
  const benchmarks: GymBoardBenchmark[] = [];
  const rawMarks = Array.isArray(patch.benchmarks)
    ? patch.benchmarks
    : existing?.benchmarks || [];
  for (const mark of rawMarks) {
    const m = asObject(mark as unknown);
    const sex = parseGymBoardSex(m.sex);
    const band = GYM_BOARD_AGE_BANDS.find(
      (b) => b.id === String(m.band_id || m.band || '')
    );
    let value = Number(m.value);
    if (!Number.isFinite(value) || value <= 0) {
      const parsed = parseChallengeValue(m.value ?? m.display, win);
      if ('error' in parsed) continue;
      value = parsed.value;
    }
    if (!sex || !band || !(value > 0)) continue;
    benchmarks.push({ sex, band_id: band.id, value });
  }
  const row: GymBoardActivity = {
    id: existing?.id || recId('gla'),
    name,
    unit: String(patch.unit || existing?.unit || 'kg').trim() || 'kg',
    win,
    notes: String(patch.notes || '').trim() || undefined,
    active: patch.active === false ? false : true,
    source:
      String(patch.source || existing?.source || '') === 'coach'
        ? 'coach'
        : 'owner',
    coach_id:
      patch.coach_id != null
        ? String(patch.coach_id)
        : existing?.coach_id || null,
    benchmarks,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  return { list: [row, ...prev.filter((a) => a.id !== row.id)], row };
}

export function assignGymBoardActivity(
  list: GymBoardAssignment[] | undefined,
  patch: {
    activity_id: string;
    class_type_id: string;
    session_id?: string | null;
    coach_id?: string | null;
  },
  now = new Date().toISOString()
): { list: GymBoardAssignment[]; row: GymBoardAssignment; error?: string } {
  const activity_id = String(patch.activity_id || '').trim();
  const class_type_id = String(patch.class_type_id || '').trim();
  if (!activity_id) {
    return { list: list || [], row: (list || [])[0], error: 'Pick an activity' };
  }
  if (!class_type_id) {
    return { list: list || [], row: (list || [])[0], error: 'Pick a class' };
  }
  const session_id = String(patch.session_id || '').trim() || null;
  const prev = parseGymBoardAssignments(list);
  const existing = prev.find(
    (a) =>
      a.activity_id === activity_id &&
      a.class_type_id === class_type_id &&
      (a.session_id || null) === session_id
  );
  const row: GymBoardAssignment = {
    id: existing?.id || recId('gln'),
    activity_id,
    class_type_id,
    session_id,
    coach_id: patch.coach_id ? String(patch.coach_id) : existing?.coach_id || null,
    created_at: existing?.created_at || now,
  };
  return { list: [row, ...prev.filter((a) => a.id !== row.id)], row };
}

export function unassignGymBoardActivity(
  list: GymBoardAssignment[] | undefined,
  id: string
): GymBoardAssignment[] {
  return parseGymBoardAssignments(list).filter((a) => a.id !== id);
}

export function upsertGymBoardScore(
  list: GymBoardScore[] | undefined,
  patch: {
    activity_id: string;
    client_id: string;
    session_id?: string | null;
    class_type_id?: string | null;
    value: number;
    display: string;
  },
  now = new Date().toISOString()
): { list: GymBoardScore[]; row: GymBoardScore } {
  const prev = parseGymBoardScores(list);
  const existing = prev.find(
    (s) =>
      s.activity_id === patch.activity_id && s.client_id === patch.client_id
  );
  const row: GymBoardScore = {
    id: existing?.id || recId('gls'),
    activity_id: patch.activity_id,
    client_id: patch.client_id,
    session_id: patch.session_id || existing?.session_id || null,
    class_type_id: patch.class_type_id || existing?.class_type_id || null,
    value: patch.value,
    display: patch.display,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  return { list: [row, ...prev.filter((s) => s.id !== row.id)], row };
}

export function benchmarkForDivision(
  activity: GymBoardActivity,
  division: GymBoardDivision
): number | null {
  if (!division.sex || !division.band_id) return null;
  const hit = activity.benchmarks.find(
    (b) => b.sex === division.sex && b.band_id === division.band_id
  );
  return hit?.value ?? null;
}

export function latestScoresForActivity(
  store: Pick<FitgraphStore, 'leaderboard_scores'>,
  activityId: string
): GymBoardScore[] {
  const latest = new Map<string, GymBoardScore>();
  for (const s of parseGymBoardScores(store.leaderboard_scores)) {
    if (s.activity_id !== activityId) continue;
    const prev = latest.get(s.client_id);
    if (!prev || s.updated_at >= prev.updated_at) latest.set(s.client_id, s);
  }
  return [...latest.values()];
}

export function buildGymBoardRows(
  store: Pick<FitgraphStore, 'leaderboard_scores' | 'clients'>,
  activity: GymBoardActivity,
  division: GymBoardDivision
): GymBoardRow[] {
  const scores = latestScoresForActivity(store, activity.id);
  const rows: GymBoardRow[] = [];
  for (const s of scores) {
    const client = (store.clients || []).find((c) => c.id === s.client_id);
    if (!client) continue;
    const theirs = memberGymBoardDivision(client);
    if (division.sex && theirs.sex !== division.sex) continue;
    if (division.band_id && theirs.band_id !== division.band_id) continue;
    const bench = benchmarkForDivision(activity, theirs);
    rows.push({
      rank: 0,
      client_id: s.client_id,
      name: client.name || 'Member',
      display: s.display + (activity.unit ? ` ${activity.unit}` : ''),
      value: s.value,
      pct: challengePct(s.value, bench, activity.win),
      updated_at: s.updated_at,
    });
  }
  rows.sort((a, b) =>
    activity.win === 'faster' ? a.value - b.value : b.value - a.value
  );
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export function gymBoardStanding(rank: number | null, field: number): string {
  if (!field) return 'No scores in your category yet';
  if (!rank) return `Not on the board · ${field} logged`;
  return `You are ${rankOrdinal(rank)} of ${field} in your category`;
}

export function assignmentsForSession(
  store: Pick<FitgraphStore, 'leaderboard_assignments'>,
  session: { id: string; class_type_id: string }
): GymBoardAssignment[] {
  return parseGymBoardAssignments(store.leaderboard_assignments).filter((a) => {
    if (a.session_id) return a.session_id === session.id;
    return a.class_type_id === session.class_type_id;
  });
}

export function clientEligibleForGymBoard(
  store: Pick<FitgraphStore, 'sessions' | 'bookings' | 'leaderboard_assignments'>,
  activityId: string,
  clientId: string,
  sessionId?: string | null
): { ok: true; session_id: string | null; class_type_id: string | null } | { ok: false; error: string } {
  const assignments = parseGymBoardAssignments(store.leaderboard_assignments).filter(
    (a) => a.activity_id === activityId
  );
  if (!assignments.length) {
    return { ok: false, error: 'This activity is not on a class yet.' };
  }
  const bookings = (store.bookings || []).filter(
    (b) =>
      b.client_id === clientId &&
      b.status !== 'cancelled' &&
      b.status !== 'waitlist'
  );
  const bookingBySession = new Map<string, FitBooking>();
  for (const b of bookings) bookingBySession.set(b.session_id, b);

  for (const a of assignments) {
    if (a.session_id) {
      if (sessionId && a.session_id !== sessionId) continue;
      if (bookingBySession.has(a.session_id)) {
        return {
          ok: true,
          session_id: a.session_id,
          class_type_id: a.class_type_id,
        };
      }
      continue;
    }
    const sessions = (store.sessions || []).filter(
      (s) =>
        s.class_type_id === a.class_type_id &&
        s.status !== 'cancelled' &&
        (!sessionId || s.id === sessionId)
    );
    for (const s of sessions) {
      if (bookingBySession.has(s.id)) {
        return { ok: true, session_id: s.id, class_type_id: a.class_type_id };
      }
    }
  }
  return {
    ok: false,
    error: 'Log a score after you are on the class roster for this activity.',
  };
}

function activityView(
  store: FitgraphStore,
  activity: GymBoardActivity,
  client: FitClient,
  className?: string | null
): GymBoardActivityView {
  const division = memberGymBoardDivision(client);
  const benchVal = benchmarkForDivision(activity, division);
  const board = buildGymBoardRows(store, activity, division).map((r) => ({
    ...r,
    is_me: r.client_id === client.id,
  }));
  const mine = board.find((r) => r.client_id === client.id) || null;
  const score = latestScoresForActivity(store, activity.id).find(
    (s) => s.client_id === client.id
  );
  return {
    id: activity.id,
    name: activity.name,
    unit: activity.unit,
    win: activity.win,
    source: activity.source,
    class_name: className || null,
    benchmark:
      benchVal != null
        ? {
            value: benchVal,
            display:
              formatChallengeTarget(benchVal, activity.win, activity.unit) ||
              String(benchVal),
          }
        : null,
    my_score: score
      ? {
          display: score.display + (activity.unit ? ` ${activity.unit}` : ''),
          value: score.value,
          updated_at: score.updated_at,
        }
      : null,
    my_rank: mine?.rank || null,
    field: board.length,
    standing: gymBoardStanding(mine?.rank || null, board.length),
    board,
  };
}

export function gymBoardForClient(
  store: FitgraphStore,
  client: FitClient
): {
  division: GymBoardDivision;
  activities: GymBoardActivityView[];
} {
  const division = memberGymBoardDivision(client);
  const activities = parseGymBoardActivities(store.leaderboard_activities).filter(
    (a) => a.active
  );
  const assignments = parseGymBoardAssignments(store.leaderboard_assignments);
  const views: GymBoardActivityView[] = [];
  for (const a of activities) {
    const pins = assignments.filter((x) => x.activity_id === a.id);
    if (!pins.length) continue;
    const eligible = clientEligibleForGymBoard(store, a.id, client.id);
    if (!eligible.ok) continue;
    const className =
      (store.class_types || []).find((c) =>
        pins.some((p) => p.class_type_id === c.id)
      )?.name || null;
    views.push(activityView(store, a, client, className));
  }
  return { division, activities: views };
}

export function gymBoardCatalogueForCoach(store: FitgraphStore) {
  return parseGymBoardActivities(store.leaderboard_activities)
    .filter((a) => a.active)
    .map((a) => ({
      id: a.id,
      name: a.name,
      unit: a.unit,
      win: a.win,
      source: a.source,
      coach_id: a.coach_id || null,
      benchmark_count: a.benchmarks.length,
    }));
}

export function gymBoardForSession(
  store: FitgraphStore,
  session: { id: string; class_type_id: string },
  viewer?: FitClient | null
) {
  const pins = assignmentsForSession(store, session);
  const activities = parseGymBoardActivities(store.leaderboard_activities);
  const className =
    (store.class_types || []).find((c) => c.id === session.class_type_id)
      ?.name || 'Class';
  return pins
    .map((p) => activities.find((a) => a.id === p.activity_id && a.active))
    .filter((a): a is GymBoardActivity => Boolean(a))
    .map((a) =>
      viewer
        ? activityView(store, a, viewer, className)
        : {
            id: a.id,
            name: a.name,
            unit: a.unit,
            win: a.win,
            source: a.source,
            class_name: className,
            assignment_id:
              pins.find((p) => p.activity_id === a.id)?.id || null,
            session_pinned: Boolean(
              pins.find((p) => p.activity_id === a.id && p.session_id)
            ),
            field: latestScoresForActivity(store, a.id).length,
          }
    );
}

export function ownerGymBoardPreview(
  store: FitgraphStore,
  activity: GymBoardActivity,
  sex: GymBoardSex,
  bandId: GymBoardAgeBandId
): GymBoardActivityView {
  const dummy: FitClient = {
    id: '_preview',
    name: 'Preview',
    code: '',
    created_at: '',
    passport: {
      sex,
      date_of_birth: dobForBand(bandId),
    },
  } as FitClient;
  return activityView(store, activity, dummy);
}

function dobForBand(bandId: GymBoardAgeBandId): string {
  const band = GYM_BOARD_AGE_BANDS.find((b) => b.id === bandId);
  const age = band ? Math.min(band.max, Math.max(band.min, band.min + 2)) : 30;
  const y = new Date().getFullYear() - age;
  return `${y}-01-15`;
}

export { parseChallengeValue, formatChallengeTarget };
