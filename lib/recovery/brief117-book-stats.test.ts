/**
 * Run: npx --yes tsx lib/recovery/brief117-book-stats.test.ts
 */
import assert from 'node:assert/strict';
import { assembleBookStats, summariseBookRows } from './book-stats';
import { bookStats, harbourMemory, type MemoryBook } from './preview-memory';
import { projectBookStats } from './project';
import type { RecoverBookStats, RecoverRole } from './types';

function shifted(book: MemoryBook): MemoryBook {
  const accounts = book.accounts.map((row, index) => {
    if (index === 0) return { ...row, state: 'recalled' as const };
    if (index === 1) return { ...row, state: 'closed' as const };
    if (index === 2) return { ...row, state: 'arrangement' as const };
    if (index === 3) return { ...row, state: 'paid' as const };
    if (index === 4) return { ...row, state: 'prescribed' as const };
    if (index === 5) return { ...row, state: 'stopped' as const };
    return row;
  });
  return { ...book, accounts };
}

const fixture = shifted(harbourMemory());
const rows = fixture.accounts.map((row) => ({
  balance_cents: row.balance_cents,
  assigned_to: row.assignee,
  state: row.state,
}));
const summary = summariseBookRows(rows);
const owner = bookStats(fixture, 'owner');
assert.ok(owner);
assert.equal(owner.placedCount, summary.placedCount);
assert.equal(owner.assignedCount, summary.assignedCount);
assert.equal(owner.unassignedCount, summary.unassignedCount);
assert.equal(owner.arrangementCount, summary.arrangementCount);
assert.equal(owner.paidCount, summary.paidCount);
assert.equal(owner.recalledCount, summary.recalledCount);
assert.equal(owner.closedCount, summary.closedCount);
assert.equal(owner.placedBalanceCents, summary.placedBalanceCents);
assert.equal(owner.recalledCount, 1);
assert.equal(owner.closedCount, 1);
assert.equal(summary.closedCount, rows.filter((row) => row.state === 'closed').length);
assert.equal(rows.filter((row) => row.state === 'prescribed' || row.state === 'stopped').length, 2);

const agent = bookStats(fixture, 'agent');
assert.ok(agent);
assert.equal(agent.assignedCount, fixture.accounts.filter((row) => row.assignee === 'pieter').length);
assert.equal(agent.placedBalanceCents, 0);
assert.equal(agent.unassignedCount, 0);
assert.equal(agent.arrangementCount, undefined);
assert.equal(agent.paidCount, undefined);
assert.equal(agent.recalledCount, undefined);
assert.equal(agent.closedCount, undefined);
assert.notEqual(agent.assignedCount, summary.assignedCount);

const viewer = bookStats(fixture, 'viewer');
assert.ok(viewer);
assert.equal(viewer.placedCount, summary.placedCount);
assert.equal(viewer.arrangementCount, undefined);
assert.equal(viewer.paidCount, undefined);
assert.equal(viewer.recalledCount, undefined);
assert.equal(viewer.closedCount, undefined);
assert.equal(viewer.assignedCount, 0);
assert.equal(viewer.unassignedCount, 0);

const full: RecoverBookStats = {
  placedCount: 7,
  placedBalanceCents: 31,
  assignedCount: 11,
  unassignedCount: 13,
  imported: true,
  arrangementCount: 17,
  paidCount: 19,
  recalledCount: 23,
  closedCount: 29,
};

function expectRole(role: RecoverRole, check: (stats: RecoverBookStats | null) => void) {
  check(projectBookStats(role, full));
}

expectRole('owner', (stats) => {
  assert.equal(stats?.placedBalanceCents, 31);
  assert.equal(stats?.recalledCount, 23);
  assert.equal(stats?.closedCount, 29);
});
expectRole('manager', (stats) => assert.equal(stats?.unassignedCount, 13));
expectRole('finance', (stats) => {
  assert.equal(stats?.placedBalanceCents, 31);
  assert.equal(stats?.arrangementCount, 17);
  assert.equal(stats?.paidCount, 19);
  assert.equal(stats?.closedCount, 29);
});
expectRole('compliance', (stats) => {
  assert.equal(stats?.placedBalanceCents, 31);
  assert.equal(stats?.recalledCount, 23);
});
expectRole('viewer', (stats) => {
  assert.equal(stats?.placedCount, 7);
  assert.equal(stats?.imported, true);
  assert.equal(stats?.assignedCount, 0);
  assert.equal(stats?.arrangementCount, undefined);
  assert.equal(stats?.paidCount, undefined);
  assert.equal(stats?.recalledCount, undefined);
  assert.equal(stats?.closedCount, undefined);
});
expectRole('agent', (stats) => {
  assert.equal(stats?.assignedCount, 11);
  assert.equal(stats?.placedCount, 11);
  assert.equal(stats?.placedBalanceCents, 0);
  assert.equal(stats?.arrangementCount, undefined);
  assert.equal(stats?.imported, true);
});
expectRole('none', (stats) => assert.equal(stats, null));

async function main() {
const wide = await assembleBookStats({
  async count(filter) {
    const counts = {
      placed: 2500,
      assigned: 800,
      unassigned: 400,
      arrangement: 20,
      paid: 15,
      recalled: 9,
      closed: 4,
    };
    return { count: counts[filter], error: null };
  },
  async balance() {
    return { data: [{ balance_cents: 10, state: 'active' }], error: null };
  },
});
assert.ok(wide);
assert.equal(wide.placedCount, 2500);
assert.equal(wide.assignedCount, 800);
assert.equal(wide.recalledCount, 9);
assert.equal(wide.closedCount, 4);
assert.equal(wide.placedBalanceCents, 10);
assert.equal(wide.imported, true);

const pending = await assembleBookStats({
  async count() {
    return { count: null, error: { code: '42P01', message: 'relation "recover_accounts" does not exist' } };
  },
  async balance() {
    return { data: [], error: null };
  },
});
assert.equal(pending, null);

console.log('brief117-book-stats.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
