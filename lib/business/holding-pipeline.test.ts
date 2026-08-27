/**
 * Run: npx --yes tsx lib/business/holding-pipeline.test.ts
 */
import assert from 'node:assert/strict';
import {
  annotateGroupOpportunity,
  descendantIdsFromHoldingEdges,
} from './holding-pipeline';

const edges = [
  { parent_id: 1, child_id: 2, link_type: 'holding', status: 'active' },
  { parent_id: 2, child_id: 3, link_type: 'holding', status: 'active' },
  { parent_id: 1, child_id: 9, link_type: 'association', status: 'active' },
  { parent_id: 1, child_id: 8, link_type: 'holding', status: 'pending' },
];

assert.deepEqual(descendantIdsFromHoldingEdges(1, edges), [2, 3]);
assert.deepEqual(descendantIdsFromHoldingEdges(2, edges), [3]);
assert.deepEqual(descendantIdsFromHoldingEdges(3, edges), []);

const cycle = [
  { parent_id: 1, child_id: 2, link_type: 'holding', status: 'active' },
  { parent_id: 2, child_id: 1, link_type: 'holding', status: 'active' },
];
assert.deepEqual(descendantIdsFromHoldingEdges(1, cycle), [2]);

const names = new Map([
  [10, 'Holding'],
  [20, 'OpCo'],
]);
const own = annotateGroupOpportunity(
  { id: 1, profile_id: 10, name: 'Own deal' },
  10,
  names
);
assert.equal(own.group_rollup, false);
assert.equal(own.source_company_name, 'Holding');

const sub = annotateGroupOpportunity(
  { id: 2, profile_id: 20, name: 'Sub deal' },
  10,
  names
);
assert.equal(sub.group_rollup, true);
assert.equal(sub.source_company_name, 'OpCo');

console.log('holding-pipeline tests ok');
