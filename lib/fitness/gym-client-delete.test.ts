/**
 * Removing a member from the book must tombstone the id so merge cannot
 * resurrect them. Same pattern as calendar session delete.
 * Run: npx --yes tsx lib/fitness/gym-client-delete.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emptyFitgraphStore } from '@/lib/fitness/fitgraph';
import { mergeFitgraphStores } from '@/lib/fitness/fitgraph-merge';

const route = readFileSync(resolve('app/api/fitness/fitgraph/route.ts'), 'utf8');
const deleteBlock = route.split("action === 'delete'")[1] || '';
assert.match(deleteBlock, /entity === 'clients'/);
assert.match(deleteBlock, /rememberRemovedFitgraphIds\(store, 'clients'/);
assert.match(deleteBlock, /rememberRemovedFitgraphIds\(store, 'bookings'/);
assert.match(deleteBlock, /_deleted: true/);

/** Same drop rules as sa_module_store_merge_id_array / Brief 50. */
function mergeIdArray(
  existing: Array<{ id: string; _deleted?: boolean; name?: string }>,
  incoming: Array<{ id: string; _deleted?: boolean; name?: string }>,
  removedIds: string[]
) {
  const incomingById = new Map(incoming.map((row) => [row.id, row]));
  const tombstones = new Set(
    incoming.filter((row) => row._deleted === true).map((row) => row.id)
  );
  const out = incoming.filter((row) => row._deleted !== true);
  for (const row of existing) {
    if (incomingById.has(row.id) || removedIds.includes(row.id) || tombstones.has(row.id)) {
      continue;
    }
    out.push(row);
  }
  return out;
}

const stored = mergeIdArray(
  [
    { id: 'cli_gone', name: 'Gone Person' },
    { id: 'cli_keep', name: 'Keep Person' },
  ],
  [
    { id: 'cli_keep', name: 'Keep Person' },
    { id: 'cli_gone', _deleted: true },
  ],
  ['cli_gone']
);
assert.deepEqual(
  stored.map((row) => row.id),
  ['cli_keep']
);
assert.match(
  deleteBlock,
  /deletePatchKeys\.push\('removed_ids', 'subscriptions', 'bookings'\)/
);
assert.match(deleteBlock, /entity === 'bookings'/);
assert.match(deleteBlock, /rememberRemovedFitgraphIds\(store, 'bookings', \[id\]\)/);

const page = readFileSync(
  resolve('app/dashboard/fitgraph/clients/page.tsx'),
  'utf8'
);
assert.match(page, /entity: 'clients'/);
assert.match(page, /action: 'delete'/);
assert.match(page, /Remove \$\{c\.name/);

const table = readFileSync(
  resolve('components/fitness/MemberAllocateTable.tsx'),
  'utf8'
);
assert.match(table, /removed_ids\?\.clients/);
assert.match(table, /onClick=\{\(\) => onDelete\(c\)\}/);

const roster = readFileSync(resolve('lib/fitness/vuka-roster.ts'), 'utf8');
assert.match(roster, /tombstoned\.has\(billedId\)/);

const live = emptyFitgraphStore();
live.clients.push({
  id: 'cli_gone',
  code: 'G',
  name: 'Gone Person',
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
});
live.clients.push({
  id: 'cli_keep',
  code: 'K',
  name: 'Keep Person',
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
});
live.subscriptions.push({
  id: 'sub_gone',
  client_id: 'cli_gone',
  plan_id: 'plan_a',
  status: 'active',
  started_at: '2026-08-01',
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
});
live.bookings.push({
  id: 'bkg_gone',
  session_id: 'ses_1',
  client_id: 'cli_gone',
  status: 'booked',
  booked_at: '2026-08-01T00:00:00.000Z',
} as never);

const withoutTombstone = emptyFitgraphStore();
withoutTombstone.clients.push(live.clients[1]);
const resurrected = mergeFitgraphStores(live, withoutTombstone);
assert.ok(
  resurrected.clients.some((c) => c.id === 'cli_gone'),
  'without a tombstone, merge still keeps the deleted member'
);

const deleted = emptyFitgraphStore();
deleted.clients.push(live.clients[1]);
deleted.removed_ids = { clients: ['cli_gone'], bookings: ['bkg_gone'] };
const afterDelete = mergeFitgraphStores(live, deleted);
assert.equal(
  afterDelete.clients.map((c) => c.id).join(','),
  'cli_keep'
);
assert.ok(afterDelete.removed_ids?.clients?.includes('cli_gone'));
assert.equal(
  afterDelete.bookings.some((b) => b.id === 'bkg_gone'),
  false
);

console.log('gym-client-delete.test.ts ok');
