/**
 * Run: npx --yes tsx lib/suppliers/srm-desk.test.ts
 */
import assert from 'node:assert/strict';
import {
  compareNum,
  compareText,
  groupBy,
  inviteBoardColumn,
  matchesQuery,
  poBoardColumn,
  supplierBoardColumn,
  supplierTimeline,
  timelineFromStamps,
} from './srm-desk';

assert.equal(matchesQuery('  ', ['Kelpac']), true);
assert.equal(matchesQuery('kel', ['Kelpac', 'Cape Town']), true);
assert.equal(matchesQuery('durban', ['Kelpac', 'Cape Town']), false);

assert.equal(compareText('b', 'a', 'asc') > 0, true);
assert.equal(compareText('b', 'a', 'desc') < 0, true);
assert.equal(compareNum(10, 2, 'desc') < 0, true);
assert.equal(compareNum(Number.NaN, 2, 'asc') < 0, true);

const grouped = groupBy(
  [
    { id: 1, status: 'active' },
    { id: 2, status: 'active' },
    { id: 3, status: 'prospect' },
  ],
  (row) => row.status
);
assert.deepEqual(
  grouped.map((g) => [g.key, g.rows.length]),
  [
    ['active', 2],
    ['prospect', 1],
  ]
);

const events = timelineFromStamps([
  { id: 'bad', title: 'Skip', at: 'not-a-date' },
  { id: 'empty', title: 'Skip', at: null },
  { id: 'old', title: 'Added', at: '2026-01-01T08:00:00.000Z' },
  { id: 'new', title: 'Updated', at: '2026-06-01T08:00:00.000Z' },
]);
assert.deepEqual(
  events.map((e) => e.id),
  ['new', 'old']
);

const life = supplierTimeline({
  created_at: '2026-01-02T00:00:00.000Z',
  invited_at: '2026-01-03T00:00:00.000Z',
  updated_at: '2026-01-04T00:00:00.000Z',
  status: 'prospect',
});
assert.equal(life[0]?.id, 'updated');
assert.equal(life.some((e) => e.id === 'accepted'), false);
assert.equal(life.find((e) => e.id === 'updated')?.detail, 'Status prospect');

assert.equal(poBoardColumn('SENT'), 'sent');
assert.equal(poBoardColumn('mystery'), 'other');
assert.equal(supplierBoardColumn(null), 'prospect');
assert.equal(supplierBoardColumn('blocked'), 'blocked');
assert.equal(inviteBoardColumn('Revoked'), 'revoked');
assert.equal(inviteBoardColumn('weird'), 'other');

console.log('srm-desk.test.ts ok');
