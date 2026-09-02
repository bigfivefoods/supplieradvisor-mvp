/**
 * Brief 50 — stale-safe module-store merge guards.
 *
 * Run: npx --yes tsx lib/advisors/brief50-module-store-merge.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function mergeIdArray(existing: unknown, incoming: unknown, removedIds: string[] = []) {
  const existingArr = Array.isArray(existing) ? existing : [];
  const incomingArr = Array.isArray(incoming) ? incoming : [];
  const incomingById = new Map<string, Record<string, unknown>>();
  const tombstones = new Set<string>();
  const merged: unknown[] = [];

  for (const row of incomingArr) {
    if (
      row &&
      typeof row === 'object' &&
      !Array.isArray(row) &&
      typeof (row as { id?: unknown }).id === 'string'
    ) {
      const id = ((row as { id: string }).id || '').trim();
      if (!id) continue;
      const rec = row as Record<string, unknown>;
      const deleted =
        rec._deleted === true ||
        rec.deleted === true ||
        rec.is_deleted === true ||
        (typeof rec.deleted_at === 'string' && rec.deleted_at.trim().length > 0);
      incomingById.set(id, rec);
      if (deleted) tombstones.add(id);
      else merged.push(rec);
      continue;
    }
    merged.push(row);
  }

  for (const row of existingArr) {
    if (
      row &&
      typeof row === 'object' &&
      !Array.isArray(row) &&
      typeof (row as { id?: unknown }).id === 'string'
    ) {
      const id = ((row as { id: string }).id || '').trim();
      if (!id) continue;
      if (incomingById.has(id) || removedIds.includes(id) || tombstones.has(id)) {
        continue;
      }
      merged.push(row);
      continue;
    }
    merged.push(row);
  }

  return merged;
}

const ID_ARRAY_KEYS = new Set([
  'goals',
  'clients',
  'bookings',
  'sessions',
  'coaches',
  'programmes',
  'programme_logs',
  'visit_notes',
  'treatment_plans',
  'class_feedback',
  'check_ins',
  'membership_plans',
  'pt_packs',
  'subscriptions',
  'movements',
]);

function mergeModuleStore(existing: Record<string, unknown>, incoming: Record<string, unknown>) {
  const merged: Record<string, unknown> = { ...existing, ...incoming };
  const removedIdsMap =
    incoming.removed_ids && typeof incoming.removed_ids === 'object'
      ? (incoming.removed_ids as Record<string, unknown>)
      : {};

  for (const [key, value] of Object.entries(incoming)) {
    if (!Array.isArray(value) || !ID_ARRAY_KEYS.has(key)) continue;
    const removed = Array.isArray(removedIdsMap[key])
      ? (removedIdsMap[key] as unknown[])
          .map((v) => (v == null ? '' : String(v).trim()))
          .filter(Boolean)
      : [];
    merged[key] = mergeIdArray(existing[key], value, removed);
  }

  return merged;
}

const before = {
  goals: [
    {
      id: 'goal_1',
      current_value: 4,
      check_ins: [{ id: 'ci_1', date: '2026-09-01' }],
    },
  ],
  clients: [
    { id: 'client_1', name: 'Craig' },
    { id: 'client_2', name: 'Neo' },
  ],
};

const mergedMissingGoals = mergeModuleStore(before, {
  clients: [{ id: 'client_1', name: 'Craig Updated' }],
});
assert.equal(Array.isArray(mergedMissingGoals.goals), true);
assert.equal((mergedMissingGoals.goals as unknown[]).length, 1);
assert.equal(
  ((mergedMissingGoals.goals as Record<string, unknown>[])[0] || {}).id,
  'goal_1'
);

const mergedShortClients = mergeModuleStore(before, {
  clients: [{ id: 'client_1', name: 'Craig Updated' }],
});
assert.equal((mergedShortClients.clients as unknown[]).length, 2);
assert.equal(
  Boolean(
    (mergedShortClients.clients as Record<string, unknown>[]).find(
      (c) => c.id === 'client_2'
    )
  ),
  true
);

const mergedGoalWins = mergeModuleStore(before, {
  goals: [
    {
      id: 'goal_1',
      current_value: 8,
      check_ins: [{ id: 'ci_2', date: '2026-09-02' }],
    },
  ],
});
assert.equal((mergedGoalWins.goals as unknown[]).length, 1);
assert.deepEqual((mergedGoalWins.goals as Record<string, unknown>[])[0], {
  id: 'goal_1',
  current_value: 8,
  check_ins: [{ id: 'ci_2', date: '2026-09-02' }],
});

const root = join(__dirname, '../../');
const migration = readFileSync(
  join(root, 'supabase/migrations/20260902_brief50_module_store_merge.sql'),
  'utf8'
);
const reliability = readFileSync(join(root, 'RUN_THIS_RELIABILITY_IN_SUPABASE.sql'), 'utf8');

for (const sql of [migration, reliability]) {
  assert.equal(sql.includes('p_if_updated_at timestamptz DEFAULT NULL'), true);
  assert.equal(sql.includes("MESSAGE = 'stale_module_store'"), true);
  assert.equal(sql.includes('existing_updated_at > p_if_updated_at'), true);
  assert.equal(sql.includes('sa_merge_module_store_data'), true);
}

console.log('brief50-module-store-merge.test.ts ok');
