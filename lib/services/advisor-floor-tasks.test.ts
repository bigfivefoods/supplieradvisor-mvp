/**
 * Run: npx --yes tsx lib/services/advisor-floor-tasks.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyFloorTaskAction,
  countFloorTaskSlices,
  floorTaskSlice,
  nextFloorTaskDue,
  sortFloorTasks,
  type FloorTask,
} from './advisor-floor-tasks';

assert.equal(nextFloorTaskDue('2026-09-03', 'daily'), '2026-09-04');
assert.equal(nextFloorTaskDue('2026-09-03', 'weekly'), '2026-09-10');
assert.equal(nextFloorTaskDue('2026-09-04', 'weekdays'), '2026-09-07');
assert.equal(nextFloorTaskDue('2026-09-03', 'none'), null);

const now = '2026-09-03T12:00:00.000Z';
const today = '2026-09-03';
let tasks: FloorTask[] = [];

const added = applyFloorTaskAction(
  tasks,
  { op: 'upsert', title: 'Restock bands', list: 'floor' },
  now,
  today
);
assert.ok(added.task);
assert.equal(added.task?.title, 'Restock bands');
assert.equal(added.task?.due_date, today);
assert.equal(added.task?.status, 'open');
tasks = added.tasks;
assert.equal(floorTaskSlice(added.task!, today), 'today');

const overdue = applyFloorTaskAction(
  tasks,
  { op: 'upsert', title: 'Call Barbara', due_date: '2026-09-01', priority: 'now' },
  now,
  today
);
tasks = overdue.tasks;
assert.equal(floorTaskSlice(overdue.task!, today), 'overdue');

const waiting = applyFloorTaskAction(
  tasks,
  { op: 'wait', id: added.task!.id, waiting_on: 'Coach Pat' },
  now,
  today
);
tasks = waiting.tasks;
assert.equal(waiting.task?.status, 'waiting');
assert.equal(waiting.task?.waiting_on, 'Coach Pat');

const withCheck = applyFloorTaskAction(
  tasks,
  {
    op: 'upsert',
    id: overdue.task!.id,
    title: 'Call Barbara',
    due_date: '2026-09-01',
    priority: 'now',
    checks: [{ id: 'chk_1', title: 'Left voicemail', done: false }],
  },
  now,
  today
);
tasks = withCheck.tasks;
const toggled = applyFloorTaskAction(
  tasks,
  { op: 'toggle_check', id: overdue.task!.id, check_id: 'chk_1' },
  now,
  today
);
tasks = toggled.tasks;
assert.equal(toggled.task?.checks[0].done, true);

const repeating = applyFloorTaskAction(
  tasks,
  {
    op: 'upsert',
    title: 'Open studio',
    due_date: today,
    repeat: 'daily',
  },
  now,
  today
);
tasks = repeating.tasks;
const done = applyFloorTaskAction(
  tasks,
  { op: 'complete', id: repeating.task!.id },
  now,
  today
);
tasks = done.tasks;
assert.equal(
  tasks.find((t) => t.id === repeating.task!.id)?.status,
  'done'
);
const spawned = tasks.find(
  (t) => t.title === 'Open studio' && t.status === 'open'
);
assert.ok(spawned);
assert.equal(spawned?.due_date, '2026-09-04');
assert.equal(spawned?.repeat, 'daily');

const counts = countFloorTaskSlices(tasks, today);
assert.ok(counts.overdue >= 1);
assert.ok(counts.done >= 1);
assert.ok(counts.waiting >= 1);

const ordered = [...tasks].sort(sortFloorTasks);
assert.equal(ordered[0].priority, 'now');

const nav = readFileSync(resolve('lib/chrome/module-nav.ts'), 'utf8');
assert.match(nav, /name: 'Tasks', href: '\/dashboard\/fitgraph\/tasks'/);
assert.match(nav, /name: 'Tasks', href: '\/dashboard\/medicalgraph\/tasks'/);
assert.match(
  nav,
  /name: 'Tasks', href: '\/dashboard\/fitgraph\/tasks'[\s\S]*section: 'Floor'/
);
assert.match(
  nav,
  /name: 'Tasks', href: '\/dashboard\/medicalgraph\/tasks'[\s\S]*section: 'Floor'/
);

const gymApi = readFileSync(
  resolve('app/api/fitness/fitgraph/route.ts'),
  'utf8'
);
assert.match(gymApi, /action === 'floor_task'/);
const medApi = readFileSync(
  resolve('app/api/clinic/medicalgraph/route.ts'),
  'utf8'
);
assert.match(medApi, /action === 'floor_task'/);
assert.match(
  readFileSync(resolve('app/dashboard/fitgraph/tasks/page.tsx'), 'utf8'),
  /AdvisorFloorTasks/
);
assert.match(
  readFileSync(resolve('app/dashboard/medicalgraph/tasks/page.tsx'), 'utf8'),
  /AdvisorFloorTasks/
);

console.log('advisor-floor-tasks.test.ts ok');
