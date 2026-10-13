/**
 * Run: npx --yes tsx lib/customers/crm-desk.test.ts
 */
import assert from 'node:assert/strict';
import { buildCrmDesk, crmDeskCounts, crmToday } from './crm-desk';

const today = '2026-10-13';
assert.equal(crmToday(new Date('2026-10-13T22:30:00.000Z')), '2026-10-14');
assert.equal(crmToday(new Date('2026-10-13T10:00:00.000Z')), '2026-10-13');

const counts = crmDeskCounts(
  [
    { id: 1, status: 'new', next_action_date: '2026-10-01' },
    { id: 2, status: 'converted', next_action_date: '2026-10-01' },
    { id: 3, status: 'working', next_action_date: '2026-10-20' },
  ],
  [
    { id: 9, stage: 'proposal', amount: 1000, probability: 50 },
    { id: 10, stage: 'closed_won', amount: 400 },
    { id: 11, stage: 'closed_lost', amount: 50 },
  ],
  today
);
assert.equal(counts.overdueFollowups, 1);
assert.equal(counts.pipelineValue, 1000);
assert.equal(counts.weightedPipeline, 500);
assert.equal(counts.wonCount, 1);
assert.equal(counts.wonValue, 400);
assert.equal(counts.opportunitiesOpen, 1);

const desk = buildCrmDesk({
  today,
  leads: [
    { id: 1, name: 'Ada', status: 'new', next_action: 'Call', next_action_date: '2026-10-01' },
    { id: 2, name: 'Later', status: 'new', next_action_date: '2026-12-01' },
  ],
  opportunities: [
    {
      id: 9,
      name: 'Palm order',
      stage: 'proposal',
      expected_close_date: '2026-10-20',
      next_step: 'Send quote',
    },
  ],
  tasks: [
    { id: 4, title: 'Tasting', kind: 'meeting', status: 'open', due_on: '2026-10-15' },
    { id: 5, title: 'Done', status: 'done', due_on: '2026-10-01' },
  ],
});

assert.deepEqual(
  desk.map((item) => item.id),
  ['lead-1', 'task-4', 'opp-9']
);
assert.equal(desk[0]?.overdue, true);
assert.equal(desk[0]?.href, '/dashboard/customers/leads');
assert.equal(desk[1]?.href, '/sales/tasks');
assert.equal(desk[2]?.href, '/dashboard/customers/leads?tab=pipeline');

console.log('crm-desk.test.ts ok');
