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
  const byId = new Map<string, FitGoal>();
  for (const g of store.goals || []) {
    if (!g?.id || g.client_id !== personId) continue;
    byId.set(g.id, g);
  }
  const person =
    (store.clients || []).find((c) => c.id === personId) ||
    (store.coaches || []).find((c) => c.id === personId);
  for (const g of person?.goals || []) {
    if (!g?.id) continue;
    if (g.client_id && g.client_id !== personId) continue;
    const prev = byId.get(g.id);
    byId.set(g.id, prev ? mergeGoalProgress(prev, g) : { ...g, client_id: personId });
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

function stampGoalOnPerson(store: FitgraphStore, goal: FitGoal) {
  const stamp = (person: { id: string; goals?: FitGoal[]; updated_at?: string }) => {
    const list = [...(person.goals || [])];
    const i = list.findIndex((g) => g.id === goal.id);
    if (i >= 0) list[i] = goal;
    else list.unshift(goal);
    person.goals = list;
    person.updated_at = goal.updated_at || new Date().toISOString();
  };
  const client = (store.clients || []).find((c) => c.id === goal.client_id);
  if (client) stamp(client);
  const coach = (store.coaches || []).find((c) => c.id === goal.client_id);
  if (coach) stamp(coach);
}

/** Pull goal copies off people if the gym blob dropped them. */
export function hydrateGoalsFromPeople(store: FitgraphStore): void {
  const map = new Map<string, FitGoal>();
  for (const g of store.goals || []) {
    if (g?.id) map.set(g.id, g);
  }
  const people = [
    ...(store.clients || []),
    ...(store.coaches || []),
  ] as Array<{ id: string; goals?: FitGoal[] }>;
  for (const person of people) {
    for (const g of person.goals || []) {
      if (!g?.id) continue;
      const prev = map.get(g.id);
      if (!prev) {
        map.set(g.id, g);
        continue;
      }
      map.set(g.id, mergeGoalProgress(prev, g));
    }
  }
  store.goals = [...map.values()];
  for (const g of store.goals) stampGoalOnPerson(store, g);
}

export function mergeGoalProgress(a: FitGoal, b: FitGoal): FitGoal {
  const checks = new Map<string, FitGoalCheckIn>();
  for (const c of [...(a.check_ins || []), ...(b.check_ins || [])]) {
    if (!c?.id) continue;
    const prev = checks.get(c.id);
    if (!prev || String(c.at || '') >= String(prev.at || '')) checks.set(c.id, c);
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
