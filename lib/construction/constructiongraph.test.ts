/**
 * ConstructionAdvisor® store merge, seed, and UID.
 * Run: npx --yes tsx lib/construction/constructiongraph.test.ts
 */
import assert from 'node:assert/strict';
import {
  CONSTRUCTIONGRAPH_MODULE_ID,
  CONSTRUCTIONGRAPH_PACK_ID,
  constructiongraphSeedStore,
  emptyConstructiongraphStore,
  mergeConstructiongraphStore,
  readConstructiongraphFromMetadata,
  summariseConstructiongraph,
  writeConstructiongraphToMetadata,
} from './constructiongraph';

assert.equal(CONSTRUCTIONGRAPH_MODULE_ID, 'constructiongraph');
assert.equal(CONSTRUCTIONGRAPH_PACK_ID, 'construction_building');

const existing = mergeConstructiongraphStore(emptyConstructiongraphStore(), {
  sites: [
    {
      id: 's1',
      code: 'SITE-01',
      name: 'Podium',
      status: 'on_site',
      contract_value: 10_000_000,
    },
    {
      id: 's2',
      code: 'SITE-02',
      name: 'Warehouse',
      status: 'tender',
    },
  ],
  variations: [
    { id: 'v1', number: 'VO-001', description: 'Extra steel', amount: 100_000, status: 'draft' },
  ],
});

const merged = mergeConstructiongraphStore(existing, {
  sites: [
    {
      id: 's2',
      code: 'SITE-02',
      name: 'Warehouse B',
      status: 'awarded',
    },
    {
      id: 's3',
      code: 'SITE-03',
      name: 'Clinic',
      status: 'on_site',
    },
  ],
  variations: [
    { id: 'v1', number: 'VO-001', description: 'Extra steel', amount: 125_000, status: 'submitted' },
  ],
});

assert.deepEqual(
  merged.sites.map((s) => s.id),
  ['s2', 's3', 's1']
);
assert.equal(merged.sites[0]?.name, 'Warehouse B');
assert.equal(merged.sites[2]?.name, 'Podium');
assert.equal(merged.variations[0]?.amount, 125_000);
assert.equal(merged.variations[0]?.status, 'submitted');

const metadata = writeConstructiongraphToMetadata(
  { timezone: 'Africa/Johannesburg' },
  merged
);
assert.equal(metadata.timezone, 'Africa/Johannesburg');
const roundTrip = readConstructiongraphFromMetadata(metadata);
assert.equal(roundTrip.sites.length, 3);
assert.equal(roundTrip.sites[0]?.status, 'awarded');

const seed = constructiongraphSeedStore('2026-09-10T08:00:00.000Z');
assert.ok(seed.sites.length >= 1);
assert.equal(seed.sites[0]?.contract_type, 'JBCC');
const summary = summariseConstructiongraph(seed);
assert.equal(summary.sites, seed.sites.length);
assert.ok(summary.contractValue > 0);
assert.ok(summary.certified > 0);
assert.equal(summary.openSnags, 1);

const emptySummary = summariseConstructiongraph(emptyConstructiongraphStore());
assert.equal(emptySummary.sites, 0);
assert.equal(emptySummary.certified, 0);

console.log('constructiongraph.test.ts ok');
