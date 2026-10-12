import assert from 'node:assert/strict';
import {
  addMinutes,
  dateOrNull,
  horizonScheduleEvents,
  kindOrTask,
  taskListBuckets,
  taskScheduleEvent,
  timeOrNull,
  type CrmTask,
} from './crm-tasks';

const task: CrmTask = {
  id: 4,
  profile_id: 102,
  customer_id: 9,
  opportunity_id: 3,
  title: 'Call the buyer',
  notes: null,
  kind: 'call',
  status: 'open',
  due_on: '2026-10-01',
  due_time: '14:00',
  assignee_user_id: 'u1',
  assignee_name: 'Craig',
  created_by: 'u1',
  completed_at: null,
};

assert.equal(kindOrTask('meeting'), 'meeting');
assert.equal(kindOrTask('nope'), 'task');
assert.equal(dateOrNull('2026-10-06T12:00:00Z'), '2026-10-06');
assert.equal(dateOrNull('soon'), null);
assert.equal(timeOrNull('09:30:00'), '09:30');
assert.equal(timeOrNull('25:00'), null);
assert.equal(addMinutes('23:50', 30), '23:59');

const ev = taskScheduleEvent(task, '2026-10-06');
assert.equal(ev.id, 'task-4');
assert.equal(ev.tone, 'rose');
assert.equal(ev.end_time, '14:30');

const done = taskScheduleEvent({ ...task, status: 'done', due_on: '2026-10-06' }, '2026-10-06');
assert.equal(done.tone, 'emerald');

const horizon = horizonScheduleEvents([
  {
    id: 8,
    name: 'Palm',
    customer_id: 2,
    company_name: 'Palm Footwear',
    stage: 'proposal',
    expected_close_date: '2026-10-20',
    next_step: 'Send quote',
    next_step_date: '2026-10-08',
    owner_name: 'Craig',
    sales_rep_user_id: 'u1',
  },
  {
    id: 9,
    name: 'Lost',
    customer_id: null,
    company_name: null,
    stage: 'closed_lost',
    expected_close_date: '2026-10-01',
    next_step: null,
    next_step_date: '2026-10-01',
    owner_name: null,
    sales_rep_user_id: null,
  },
]);
assert.equal(horizon.length, 2);
assert.equal(horizon[0].meta, 'close');
assert.equal(horizon[1].title, 'Next · Send quote');

const buckets = taskListBuckets(
  [
    task,
    { ...task, id: 5, due_on: '2026-10-06', status: 'open' },
    { ...task, id: 6, due_on: '2026-10-20', status: 'open' },
    { ...task, id: 7, due_on: '2026-09-01', status: 'done' },
  ],
  '2026-10-06'
);
assert.deepEqual(buckets.overdue.map((t) => t.id), [4]);
assert.deepEqual(buckets.dueToday.map((t) => t.id), [5]);
assert.deepEqual(buckets.upcoming.map((t) => t.id), [6]);
assert.deepEqual(buckets.done.map((t) => t.id), [7]);

console.log('sales/crm-tasks.test.ts ok');
