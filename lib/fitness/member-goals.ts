/**
 * Member personal goals: target vs actual, due date, and check-ins.
 */
import {
  appendJourneyEvent,
  createGoal,
  type FitGoal,
  type FitGoalCategory,
  type FitGoalCheckIn,
} from '@/lib/fitness/fitgraph-relationship';
import { newId, type FitgraphStore } from '@/lib/fitness/fitgraph';
import { appendResultLog } from '@/lib/fitness/person-records';

export const MEMBER_GOAL_PRESETS = [
  {
    kind: 'weight',
    title: 'Lose weight',
    unit: 'kg',
    direction: 'decrease',
    category: 'physical',
    hint: 'Start weight vs target weight',
  },
  {
    kind: 'bmi',
    title: 'Improve BMI',
    unit: 'BMI',
    direction: 'decrease',
    category: 'physical',
    hint: 'Current BMI vs target BMI',
  },
  {
    kind: 'run_5k',
    title: '5 km run',
    unit: 'min',
    direction: 'decrease',
    category: 'performance',
    hint: 'Target time to run 5 km',
  },
  {
    kind: 'distance',
    title: 'Run / ride distance',
    unit: 'km',
    direction: 'increase',
    category: 'performance',
    hint: 'Distance in one session or week',
  },
  {
    kind: 'workouts_week',
    title: 'Workouts per week',
    unit: 'sessions',
    direction: 'increase',
    category: 'consistency',
    hint: 'How many classes or sessions a week',
  },
  {
    kind: 'custom',
    title: 'Custom goal',
    unit: '',
    direction: 'decrease',
    category: 'other',
    hint: 'Set your own target',
  },
] as const;

export type MemberGoalKind = (typeof MEMBER_GOAL_PRESETS)[number]['kind'];
export type GoalDirection = 'increase' | 'decrease';

export function parseGoalNumber(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.includes(':')) {
    const parts = s.split(':').map((p) => Number(p));
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
    if (parts.length === 2) return parts[0] + parts[1] / 60;
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
    return null;
  }
  const n = Number(s.replace(/[^\d.eE+-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function presetForKind(kind?: string | null) {
  return (
    MEMBER_GOAL_PRESETS.find((p) => p.kind === kind) ||
    MEMBER_GOAL_PRESETS[MEMBER_GOAL_PRESETS.length - 1]
  );
}

export function goalDirection(goal: Pick<FitGoal, 'kind' | 'direction' | 'start_value' | 'target_value'>): GoalDirection {
  if (goal.direction === 'increase' || goal.direction === 'decrease') {
    return goal.direction;
  }
  const preset = presetForKind(goal.kind);
  if (
    goal.start_value != null &&
    goal.target_value != null &&
    Number(goal.target_value) > Number(goal.start_value)
  ) {
    return 'increase';
  }
  return preset.direction;
}

export function latestGoalActual(goal: FitGoal): number | null {
  if (goal.current_value != null && Number.isFinite(Number(goal.current_value))) {
    return Number(goal.current_value);
  }
  const checks = [...(goal.check_ins || [])]
    .filter((c) => c.metric_value != null && Number.isFinite(Number(c.metric_value)))
    .sort((a, b) => b.at.localeCompare(a.at));
  if (checks[0]?.metric_value != null) return Number(checks[0].metric_value);
  if (goal.start_value != null && Number.isFinite(Number(goal.start_value))) {
    return Number(goal.start_value);
  }
  return null;
}

export function goalReached(
  goal: FitGoal,
  actual = latestGoalActual(goal)
): boolean {
  if (actual == null || goal.target_value == null) return false;
  const target = Number(goal.target_value);
  if (!Number.isFinite(target)) return false;
  return goalDirection(goal) === 'decrease' ? actual <= target : actual >= target;
}

export function goalProgressPct(goal: FitGoal): number | null {
  const start =
    goal.start_value != null && Number.isFinite(Number(goal.start_value))
      ? Number(goal.start_value)
      : null;
  const target =
    goal.target_value != null && Number.isFinite(Number(goal.target_value))
      ? Number(goal.target_value)
      : null;
  const actual = latestGoalActual(goal);
  if (start == null || target == null || actual == null) return null;
  const span = target - start;
  if (Math.abs(span) < 1e-9) return actual === target ? 100 : 0;
  const pct = ((actual - start) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export type MemberGoalView = {
  id: string;
  kind?: string | null;
  title: string;
  description?: string;
  category?: string;
  status: string;
  unit?: string | null;
  start_value: number | null;
  actual: number | null;
  target_value: number | null;
  direction: GoalDirection;
  progress_pct: number | null;
  start_date?: string | null;
  target_date?: string | null;
  achieved_at?: string | null;
  check_ins: Array<{
    id: string;
    at: string;
    metric_value?: number | null;
    note?: string;
    source?: string;
  }>;
};

export function toMemberGoalView(goal: FitGoal): MemberGoalView {
  return {
    id: goal.id,
    kind: goal.kind || null,
    title: goal.title,
    description: goal.description,
    category: String(goal.category || ''),
    status: String(goal.status || 'active'),
    unit: goal.unit || null,
    start_value:
      goal.start_value != null && Number.isFinite(Number(goal.start_value))
        ? Number(goal.start_value)
        : null,
    actual: latestGoalActual(goal),
    target_value:
      goal.target_value != null && Number.isFinite(Number(goal.target_value))
        ? Number(goal.target_value)
        : null,
    direction: goalDirection(goal),
    progress_pct: goalProgressPct(goal),
    start_date: goal.start_date || null,
    target_date: goal.target_date || null,
    achieved_at: goal.achieved_at || null,
    check_ins: (goal.check_ins || [])
      .slice()
      .sort((a, b) => a.at.localeCompare(b.at))
      .slice(-500)
      .map((c) => ({
        id: c.id,
        at: c.at,
        metric_value: c.metric_value ?? null,
        note: c.note,
        source: c.source,
      })),
  };
}

function goalsForPerson(store: FitgraphStore, personId: string): FitGoal[] {
  const person =
    (store.clients || []).find((c) => c.id === personId) ||
    (store.coaches || []).find((c) => c.id === personId);
  const onPerson = new Set((person?.goals || []).map((g) => g.id).filter(Boolean));
  const byId = new Map<string, FitGoal>();
  for (const g of store.goals || []) {
    if (!g?.id) continue;
    if (g.client_id === personId || (!g.client_id && onPerson.has(g.id))) {
      byId.set(g.id, { ...g, client_id: g.client_id || personId });
    }
  }
  for (const g of person?.goals || []) {
    if (!g?.id) continue;
    if (g.client_id && g.client_id !== personId) continue;
    const prev = byId.get(g.id);
    byId.set(
      g.id,
      prev ? mergeGoalProgress(prev, g) : { ...g, client_id: personId }
    );
  }
  return [...byId.values()];
}

export function memberFacingGoals(
  store: FitgraphStore,
  clientId: string
): MemberGoalView[] {
  return goalsForPerson(store, clientId)
    .filter((g) => g.status !== 'abandoned')
    .sort((a, b) => {
      const aActive = a.status === 'active' ? 0 : 1;
      const bActive = b.status === 'active' ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return (b.updated_at || '').localeCompare(a.updated_at || '');
    })
    .map(toMemberGoalView);
}

export function createMemberGoal(input: {
  client_id: string;
  coach_id?: string | null;
  kind?: string;
  title?: string;
  description?: string;
  category?: string;
  unit?: string | null;
  start_value?: number | null;
  target_value?: number | null;
  target_date?: string | null;
  direction?: GoalDirection;
  created_by_role?: 'member' | 'coach' | 'owner';
  nowIso?: string;
}): FitGoal {
  const preset = presetForKind(input.kind);
  const title = String(input.title || preset.title).trim() || preset.title;
  const goal = createGoal({
    client_id: input.client_id,
    coach_id: input.coach_id,
    title,
    description: input.description,
    category: (input.category || preset.category) as FitGoalCategory,
    target_value: input.target_value ?? null,
    unit: input.unit != null && String(input.unit).trim() ? String(input.unit) : preset.unit || null,
    target_date: input.target_date || null,
    created_by_role: input.created_by_role || 'member',
    nowIso: input.nowIso,
  });
  goal.kind = input.kind || preset.kind;
  goal.direction = input.direction || preset.direction;
  goal.start_value = input.start_value ?? null;
  goal.current_value = input.start_value ?? null;
  if (goal.start_value != null && Number.isFinite(Number(goal.start_value))) {
    const at = input.nowIso || new Date().toISOString();
    goal.check_ins = [
      {
        id: newId('gci'),
        at,
        by_role: input.created_by_role || 'member',
        by_id: input.client_id,
        metric_value: Number(goal.start_value),
        source: 'start',
      },
    ];
  }
  return goal;
}

export function logGoalActual(
  goal: FitGoal,
  value: number,
  opts?: {
    note?: string;
    by_role?: FitGoalCheckIn['by_role'];
    by_id?: string | null;
    source?: string;
    nowIso?: string;
  }
): FitGoal {
  const now = opts?.nowIso || new Date().toISOString();
  const check: FitGoalCheckIn = {
    id: newId('gci'),
    at: now,
    by_role: opts?.by_role || 'member',
    by_id: opts?.by_id ?? null,
    note: opts?.note,
    metric_value: value,
    source: opts?.source,
  };
  const next: FitGoal = {
    ...goal,
    current_value: value,
    start_value: goal.start_value ?? value,
    check_ins: [...(goal.check_ins || []), check],
    updated_at: now,
    last_review_at: now,
  };
  if (goalReached(next, value) && next.status === 'active') {
    next.status = 'achieved';
    next.achieved_at = now;
  }
  return next;
}

export function upsertMemberGoalOnStore(
  store: FitgraphStore,
  goal: FitGoal
): void {
  const goals = [...(store.goals || [])];
  const idx = goals.findIndex((g) => g.id === goal.id);
  const next = { ...goal, updated_at: new Date().toISOString() };
  if (idx >= 0) goals[idx] = next;
  else goals.unshift(next);
  store.goals = goals;
  stampGoalOnPerson(store, next);
}

function stampGoalOnPerson(
  store: FitgraphStore,
  goal: FitGoal,
  opts?: { touch?: boolean }
) {
  const stamp = (person: { id: string; goals?: FitGoal[]; updated_at?: string }) => {
    const list = [...(person.goals || [])];
    const i = list.findIndex((g) => g.id === goal.id);
    if (i >= 0) list[i] = goal;
    else list.unshift(goal);
    person.goals = list;
    if (opts?.touch !== false) {
      person.updated_at = goal.updated_at || new Date().toISOString();
    }
  };
  const client = (store.clients || []).find((c) => c.id === goal.client_id);
  if (client) stamp(client);
  const coach = (store.coaches || []).find((c) => c.id === goal.client_id);
  if (coach) stamp(coach);
}

/** Pull goal copies off people if the gym blob dropped them. */
export function hydrateGoalsFromPeople(store: FitgraphStore): void {
  recoverGoalsFromSideChannels(store);
  const map = new Map<string, FitGoal>();
  for (const g of store.goals || []) {
    if (g?.id) map.set(g.id, g);
  }
  const people = [
    ...(store.clients || []),
    ...(store.coaches || []),
  ] as Array<{
    id: string;
    goals?: FitGoal[];
    result_logs?: import('@/lib/fitness/person-records').FitResultLog[];
  }>;
  for (const person of people) {
    for (const g of person.goals || []) {
      if (!g?.id) continue;
      const prev = map.get(g.id);
      if (!prev) {
        map.set(g.id, { ...g, client_id: g.client_id || person.id });
        continue;
      }
      map.set(g.id, mergeGoalProgress(prev, g));
    }
  }
  store.goals = [...map.values()];
  for (const g of store.goals) stampGoalOnPerson(store, g, { touch: false });
}

function slugTitle(title: string): string {
  return String(title || 'goal')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'goal';
}

function recoverGoalsFromSideChannels(store: FitgraphStore): void {
  const people = [
    ...(store.clients || []),
    ...(store.coaches || []),
  ] as Array<{
    id: string;
    goals?: FitGoal[];
    result_logs?: Array<{
      id?: string;
      kind?: string;
      title?: string;
      value?: string;
      numeric?: number | null;
      unit?: string | null;
      at?: string;
      source_id?: string | null;
    }>;
  }>;
  const goals = [...(store.goals || [])];
  const byId = new Map(goals.filter((g) => g?.id).map((g) => [g.id, g]));

  const ensure = (partial: FitGoal) => {
    const prev = byId.get(partial.id);
    if (!prev) {
      byId.set(partial.id, partial);
      goals.push(partial);
      return partial;
    }
    const merged = mergeGoalProgress(prev, partial);
    byId.set(partial.id, merged);
    const idx = goals.findIndex((g) => g.id === partial.id);
    if (idx >= 0) goals[idx] = merged;
    return merged;
  };

  for (const person of people) {
    for (const log of person.result_logs || []) {
      if (log.kind !== 'goal') continue;
      const title = String(log.title || '').trim();
      if (!title) continue;
      const gid =
        String(log.source_id || '').trim() ||
        `goal_${person.id}_${slugTitle(title)}`;
      const numeric =
        log.numeric != null && Number.isFinite(Number(log.numeric))
          ? Number(log.numeric)
          : parseGoalNumber(log.value);
      const at = String(log.at || new Date().toISOString());
      const existing =
        byId.get(gid) ||
        goals.find((g) => g.client_id === person.id && g.title === title);
      const goal = ensure(
        existing || {
          id: gid,
          client_id: person.id,
          title,
          category: 'physical',
          status: 'active',
          unit: log.unit || null,
          start_value: numeric,
          current_value: numeric,
          check_ins: [],
          created_at: at,
          updated_at: at,
          created_by_role: 'member',
        }
      );
      if (numeric == null) continue;
      const has = (goal.check_ins || []).some(
        (c) =>
          c.id === log.id ||
          (c.at === at && Number(c.metric_value) === numeric)
      );
      if (has) continue;
      goal.check_ins = [
        ...(goal.check_ins || []),
        {
          id: String(log.id || '') || newId('gci'),
          at,
          by_role: 'member',
          metric_value: numeric,
          source: 'recovered',
        },
      ];
      goal.current_value = numeric;
      if (at > (goal.updated_at || '')) goal.updated_at = at;
    }
  }

  for (const ev of store.journey_events || []) {
    const kind = String(ev.kind || '');
    if (!kind.startsWith('goal')) continue;
    const clientId = String(ev.client_id || '');
    if (!clientId) continue;
    const rawTitle = String(ev.title || '').trim();
    const title = rawTitle.replace(
      /^Goal (set|achieved|check-in|progress):\s*/i,
      ''
    );
    if (!title) continue;
    const gid = String(ev.goal_id || '').trim() || `goal_ev_${ev.id}`;
    if (byId.has(gid)) continue;
    if (goals.some((g) => g.client_id === clientId && g.title === title)) continue;
    ensure({
      id: gid,
      client_id: clientId,
      title,
      description: ev.body,
      category: 'other',
      status: kind === 'goal_achieved' ? 'achieved' : 'active',
      check_ins: [],
      created_at: ev.at,
      updated_at: ev.at,
      created_by_role:
        ev.created_by_role === 'member' || ev.created_by_role === 'coach'
          ? ev.created_by_role
          : 'member',
    });
  }

  store.goals = goals;
}

export function mergeGoalProgress(a: FitGoal, b: FitGoal): FitGoal {
  const checks = new Map<string, FitGoalCheckIn>();
  for (const c of [...(a.check_ins || []), ...(b.check_ins || [])]) {
    if (!c) continue;
    const id =
      c.id ||
      `gci_${String(c.at || '')}_${String(c.metric_value ?? '')}_${String(c.note || '')}`;
    const row = { ...c, id };
    const prev = checks.get(id);
    if (!prev || String(row.at || '') >= String(prev.at || '')) checks.set(id, row);
  }
  const newer = String(b.updated_at || '') >= String(a.updated_at || '') ? b : a;
  const older = newer === b ? a : b;
  const current =
    newer.current_value != null && Number.isFinite(Number(newer.current_value))
      ? Number(newer.current_value)
      : older.current_value ?? null;
  const start =
    older.start_value != null && Number.isFinite(Number(older.start_value))
      ? Number(older.start_value)
      : newer.start_value ?? null;
  return {
    ...older,
    ...newer,
    start_value: start,
    current_value: current,
    check_ins: [...checks.values()].sort((x, y) =>
      String(x.at).localeCompare(String(y.at))
    ),
  };
}

/** If a merge/write dropped goals, keep the latest copies from the DB snapshot. */
export function retainMemberProgress(
  latest: FitgraphStore,
  next: FitgraphStore
): FitgraphStore {
  const out: FitgraphStore = { ...next };

  // Union goals — merge check_ins for shared ids, add any goals only in latest
  const nextGoalMap = new Map<string, FitGoal>(
    (out.goals || []).filter((g) => g?.id).map((g) => [g.id, g])
  );
  for (const g of latest.goals || []) {
    if (!g?.id) continue;
    const existing = nextGoalMap.get(g.id);
    if (!existing) {
      nextGoalMap.set(g.id, g);
    } else {
      nextGoalMap.set(g.id, mergeGoalProgress(existing, g));
    }
  }
  out.goals = [...nextGoalMap.values()];

  // Helper to union arrays of objects with an `id` field
  function unionById<T extends { id?: string }>(a: T[], b: T[]): T[] {
    const aNoId = a.filter((x) => !x?.id);
    const bNoId = b.filter((x) => !x?.id);
    const m = new Map<string, T>();
    for (const x of [...a, ...b]) {
      if (x?.id) m.set(x.id, m.has(x.id) ? { ...m.get(x.id)!, ...x } : x);
    }
    return [...m.values(), ...aNoId, ...bNoId];
  }

  const latestClientById = new Map((latest.clients || []).map((c) => [c.id, c]));
  out.clients = (out.clients || []).map((c) => {
    const prev = latestClientById.get(c.id);
    if (!prev) return c;
    const mergedGoals = (c.goals || []).map((g) => {
      if (!g?.id) return g;
      const pg = (prev.goals || []).find((x) => x.id === g.id);
      return pg ? mergeGoalProgress(g, pg) : g;
    });
    const prevOnlyGoals = (prev.goals || []).filter(
      (g) => g?.id && !mergedGoals.some((x) => x?.id === g.id)
    );
    return {
      ...c,
      goals: [...mergedGoals, ...prevOnlyGoals],
      personal_bests: unionById(c.personal_bests || [], prev.personal_bests || []),
      result_logs: unionById(c.result_logs || [], prev.result_logs || []),
      injuries: unionById(
        (c as { injuries?: Array<{ id?: string }> }).injuries || [],
        (prev as { injuries?: Array<{ id?: string }> }).injuries || []
      ) as typeof c.injuries,
    };
  });

  const latestCoachById = new Map((latest.coaches || []).map((c) => [c.id, c]));
  out.coaches = (out.coaches || []).map((c) => {
    const prev = latestCoachById.get(c.id);
    if (!prev) return c;
    const mergedGoals = (c.goals || []).map((g) => {
      if (!g?.id) return g;
      const pg = (prev.goals || []).find((x) => x.id === g.id);
      return pg ? mergeGoalProgress(g, pg) : g;
    });
    const prevOnlyGoals = (prev.goals || []).filter(
      (g) => g?.id && !mergedGoals.some((x) => x?.id === g.id)
    );
    return {
      ...c,
      goals: [...mergedGoals, ...prevOnlyGoals],
      personal_bests: unionById(c.personal_bests || [], prev.personal_bests || []),
      injuries: unionById(
        (c as { injuries?: Array<{ id?: string }> }).injuries || [],
        (prev as { injuries?: Array<{ id?: string }> }).injuries || []
      ) as typeof c.injuries,
    };
  });

  return out;
}

export function applyGoalToStore(
  store: FitgraphStore,
  goal: FitGoal,
  journeyTitle?: string
): void {
  upsertMemberGoalOnStore(store, goal);
  const person =
    (store.clients || []).find((c) => c.id === goal.client_id) ||
    (store.coaches || []).find((c) => c.id === goal.client_id);
  if (person && goal.current_value != null) {
    appendResultLog(person, {
      kind: 'goal',
      title: goal.title,
      value: String(goal.current_value),
      numeric: Number(goal.current_value),
      unit: goal.unit || null,
      at: goal.updated_at || new Date().toISOString(),
      source_id: goal.id,
    });
  }
  const event = {
    id: newId('je'),
    client_id: goal.client_id,
    coach_id: goal.coach_id || null,
    kind: goal.status === 'achieved' ? 'goal_achieved' : 'goal_progress',
    at: new Date().toISOString(),
    title: journeyTitle || goal.title,
    body:
      goal.current_value != null
        ? `Actual ${goal.current_value}${goal.unit ? ` ${goal.unit}` : ''}${
            goal.target_value != null
              ? ` · target ${goal.target_value}${goal.unit ? ` ${goal.unit}` : ''}`
              : ''
          }`
        : undefined,
    goal_id: goal.id,
    visibility: 'shared' as const,
    created_by_role: (goal.created_by_role || 'member') as 'member',
  };
  Object.assign(store, appendJourneyEvent(store, event));
}
