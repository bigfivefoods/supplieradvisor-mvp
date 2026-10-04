/**
 * Floor tasks for GymAdvisor / MedicalAdvisor desks.
 * Stored on the module book (not a separate product module).
 */
import { addDaysIso } from '@/lib/schedule/recurrence';

export type FloorTaskList = 'floor' | 'follow_up' | 'admin';
export type FloorTaskRepeat = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';
export type FloorTaskPriority = 'normal' | 'soon' | 'now';
export type FloorTaskStatus = 'open' | 'waiting' | 'done' | 'cancelled';

export type FloorTaskCheck = {
  id: string;
  title: string;
  done: boolean;
};

export type FloorTask = {
  id: string;
  title: string;
  notes?: string;
  list: FloorTaskList;
  status: FloorTaskStatus;
  priority: FloorTaskPriority;
  due_date?: string | null;
  due_time?: string | null;
  repeat: FloorTaskRepeat;
  assignee_id?: string | null;
  person_id?: string | null;
  waiting_on?: string | null;
  checks: FloorTaskCheck[];
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
};

export const FLOOR_TASK_LISTS: Array<{ id: FloorTaskList; label: string }> = [
  { id: 'floor', label: 'Floor' },
  { id: 'follow_up', label: 'Follow-up' },
  { id: 'admin', label: 'Admin' },
];

export function newFloorTaskId(): string {
  return `tsk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function asList(v: unknown): FloorTaskList {
  return v === 'follow_up' || v === 'admin' ? v : 'floor';
}

function asRepeat(v: unknown): FloorTaskRepeat {
  return v === 'daily' || v === 'weekdays' || v === 'weekly' || v === 'monthly'
    ? v
    : 'none';
}

function asPriority(v: unknown): FloorTaskPriority {
  return v === 'now' || v === 'soon' ? v : 'normal';
}

function asStatus(v: unknown): FloorTaskStatus {
  return v === 'waiting' || v === 'done' || v === 'cancelled' ? v : 'open';
}

function isoDay(v: unknown): string | null {
  const s = String(v || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function hm(v: unknown): string | null {
  const s = String(v || '').trim().slice(0, 5);
  return /^\d{2}:\d{2}$/.test(s) ? s : null;
}

function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay();
}

export function nextFloorTaskDue(
  due: string,
  repeat: FloorTaskRepeat
): string | null {
  if (repeat === 'none' || !isoDay(due)) return null;
  if (repeat === 'daily') return addDaysIso(due, 1);
  if (repeat === 'weekly') return addDaysIso(due, 7);
  if (repeat === 'monthly') {
    const [y, m, d] = due.split('-').map(Number);
    const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
    dt.setUTCMonth(dt.getUTCMonth() + 1);
    return dt.toISOString().slice(0, 10);
  }
  let next = addDaysIso(due, 1);
  for (let i = 0; i < 8; i++) {
    const wd = weekdayOf(next);
    if (wd !== 0 && wd !== 6) return next;
    next = addDaysIso(next, 1);
  }
  return next;
}

function normalizeChecks(raw: unknown): FloorTaskCheck[] {
  if (!Array.isArray(raw)) return [];
  const out: FloorTaskCheck[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const title = String(r.title || '').trim();
    if (!title) continue;
    out.push({
      id: String(r.id || newFloorTaskId()),
      title,
      done: r.done === true,
    });
  }
  return out;
}

export function normalizeFloorTask(
  raw: Record<string, unknown>,
  now: string
): FloorTask {
  const title = String(raw.title || '').trim();
  const id = String(raw.id || newFloorTaskId());
  return {
    id,
    title,
    notes: String(raw.notes || '').trim() || undefined,
    list: asList(raw.list),
    status: asStatus(raw.status),
    priority: asPriority(raw.priority),
    due_date: isoDay(raw.due_date),
    due_time: hm(raw.due_time),
    repeat: asRepeat(raw.repeat),
    assignee_id: String(raw.assignee_id || '').trim() || null,
    person_id: String(raw.person_id || '').trim() || null,
    waiting_on: String(raw.waiting_on || '').trim() || null,
    checks: normalizeChecks(raw.checks),
    created_at: String(raw.created_at || now),
    updated_at: now,
    completed_at: String(raw.completed_at || '') || null,
  };
}

export type FloorTaskOp =
  | 'upsert'
  | 'complete'
  | 'reopen'
  | 'delete'
  | 'toggle_check'
  | 'wait';

export function applyFloorTaskAction(
  list: FloorTask[] | undefined,
  body: Record<string, unknown>,
  now: string,
  today: string
): { tasks: FloorTask[]; error?: string; task?: FloorTask } {
  const tasks = Array.isArray(list) ? [...list] : [];
  const op = String(body.op || body.task_op || 'upsert') as FloorTaskOp;
  const raw =
    body.task && typeof body.task === 'object' && !Array.isArray(body.task)
      ? (body.task as Record<string, unknown>)
      : body;
  const id = String(raw.id || body.id || '').trim();

  const findIndex = (taskId: string) => tasks.findIndex((t) => t.id === taskId);

  if (op === 'upsert') {
    const title = String(raw.title || '').trim();
    if (!title) return { tasks, error: 'Task title required' };
    const next = normalizeFloorTask(
      {
        ...raw,
        id: id || newFloorTaskId(),
        status: raw.status || 'open',
        due_date: raw.due_date === undefined ? today : raw.due_date,
      },
      now
    );
    if (!id) {
      next.created_at = now;
      tasks.unshift(next);
      return { tasks, task: next };
    }
    const i = findIndex(id);
    if (i < 0) {
      next.created_at = now;
      tasks.unshift(next);
      return { tasks, task: next };
    }
    const prev = tasks[i];
    next.created_at = prev.created_at;
    next.completed_at = prev.completed_at;
    if (next.status !== 'done') next.completed_at = prev.status === 'done' ? null : prev.completed_at;
    tasks[i] = next;
    return { tasks, task: next };
  }

  if (!id) return { tasks, error: 'Task required' };
  const i = findIndex(id);
  if (i < 0) return { tasks, error: 'Task not found' };
  const cur = { ...tasks[i], checks: [...(tasks[i].checks || [])] };

  if (op === 'delete') {
    cur.status = 'cancelled';
    cur.updated_at = now;
    tasks[i] = cur;
    return { tasks, task: cur };
  }

  if (op === 'complete') {
    if (cur.status === 'done') return { tasks, task: cur };
    cur.status = 'done';
    cur.completed_at = now;
    cur.updated_at = now;
    tasks[i] = cur;
    const spawnDue = nextFloorTaskDue(cur.due_date || today, cur.repeat);
    if (spawnDue) {
      const spawned = normalizeFloorTask(
        {
          ...cur,
          id: newFloorTaskId(),
          status: 'open',
          due_date: spawnDue,
          completed_at: null,
          checks: cur.checks.map((c) => ({ ...c, id: newFloorTaskId(), done: false })),
        },
        now
      );
      spawned.created_at = now;
      spawned.completed_at = null;
      tasks.unshift(spawned);
      return { tasks, task: spawned };
    }
    return { tasks, task: cur };
  }

  if (op === 'reopen') {
    cur.status = 'open';
    cur.completed_at = null;
    cur.updated_at = now;
    tasks[i] = cur;
    return { tasks, task: cur };
  }

  if (op === 'wait') {
    cur.status = 'waiting';
    cur.waiting_on = String(body.waiting_on || raw.waiting_on || '').trim() || cur.waiting_on;
    cur.updated_at = now;
    tasks[i] = cur;
    return { tasks, task: cur };
  }

  if (op === 'toggle_check') {
    const checkId = String(body.check_id || raw.check_id || '').trim();
    const check = cur.checks.find((c) => c.id === checkId);
    if (!check) return { tasks, error: 'Checklist item not found' };
    check.done = !check.done;
    cur.updated_at = now;
    tasks[i] = cur;
    return { tasks, task: cur };
  }

  return { tasks, error: 'Unknown task action' };
}

export type FloorTaskSlice = 'overdue' | 'today' | 'upcoming' | 'waiting' | 'done';

export function floorTaskSlice(task: FloorTask, today: string): FloorTaskSlice {
  if (task.status === 'done') return 'done';
  if (task.status === 'waiting') return 'waiting';
  if (task.status === 'cancelled') return 'done';
  const due = isoDay(task.due_date);
  if (due && due < today) return 'overdue';
  if (due && due > today) return 'upcoming';
  return 'today';
}

export function sortFloorTasks(a: FloorTask, b: FloorTask): number {
  const rank = { now: 0, soon: 1, normal: 2 };
  const pd = rank[a.priority] - rank[b.priority];
  if (pd) return pd;
  const da = `${a.due_date || '9999-12-31'} ${a.due_time || '99:99'}`;
  const db = `${b.due_date || '9999-12-31'} ${b.due_time || '99:99'}`;
  const dd = da.localeCompare(db);
  if (dd) return dd;
  return String(b.created_at || '').localeCompare(String(a.created_at || ''));
}

export function liveFloorTasks(tasks: FloorTask[] | undefined): FloorTask[] {
  return (tasks || []).filter((t) => t.status !== 'cancelled');
}

export function countFloorTaskSlices(
  tasks: FloorTask[] | undefined,
  today: string
): Record<FloorTaskSlice, number> {
  const counts: Record<FloorTaskSlice, number> = {
    overdue: 0,
    today: 0,
    upcoming: 0,
    waiting: 0,
    done: 0,
  };
  for (const t of liveFloorTasks(tasks)) {
    counts[floorTaskSlice(t, today)] += 1;
  }
  return counts;
}

export type FloorTaskSeriesPoint = {
  key: string;
  label: string;
  count: number;
};

export function floorTaskAnchorDate(task: FloorTask): string | null {
  return (
    isoDay(task.due_date) ||
    String(task.created_at || '').slice(0, 10) ||
    null
  );
}

export function floorTasksInPeriod(
  tasks: FloorTask[] | undefined,
  from: string,
  to: string
): FloorTask[] {
  return liveFloorTasks(tasks).filter((t) => {
    const d = floorTaskAnchorDate(t);
    if (!d) return false;
    return d >= from && d <= to;
  });
}

export function weekStartIso(day: string): string {
  const d = isoDay(day);
  if (!d) return day;
  const wd = weekdayOf(d);
  const back = wd === 0 ? 6 : wd - 1;
  return addDaysIso(d, -back);
}

export function floorTaskCountByWeek(
  tasks: FloorTask[] | undefined,
  from: string,
  to: string
): FloorTaskSeriesPoint[] {
  const map = new Map<string, number>();
  for (const t of floorTasksInPeriod(tasks, from, to)) {
    const d = floorTaskAnchorDate(t);
    if (!d) continue;
    const key = weekStartIso(d);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => ({
      key,
      label: key.slice(5),
      count,
    }));
}

export function floorTaskCountBySlice(
  tasks: FloorTask[] | undefined,
  today: string
): FloorTaskSeriesPoint[] {
  const counts = countFloorTaskSlices(tasks, today);
  return (['overdue', 'today', 'upcoming', 'waiting', 'done'] as FloorTaskSlice[]).map(
    (key) => ({
      key,
      label: key.replace(/_/g, ' '),
      count: counts[key],
    })
  );
}

export function floorTaskCountByAssignee(
  tasks: FloorTask[] | undefined,
  staff: Array<{ id: string; name: string }>
): FloorTaskSeriesPoint[] {
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const map = new Map<string, number>();
  for (const t of liveFloorTasks(tasks)) {
    const key = t.assignee_id || 'unassigned';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({
      key,
      label: key === 'unassigned' ? 'Unassigned' : names.get(key) || 'Team',
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

export function floorTaskCountByList(
  tasks: FloorTask[] | undefined
): FloorTaskSeriesPoint[] {
  const map = new Map<string, number>();
  for (const t of liveFloorTasks(tasks)) {
    map.set(t.list, (map.get(t.list) || 0) + 1);
  }
  return FLOOR_TASK_LISTS.map((l) => ({
    key: l.id,
    label: l.label,
    count: map.get(l.id) || 0,
  })).filter((r) => r.count > 0);
}
