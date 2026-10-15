/**
 * Approving days adds eot_days and leaves the planned end alone.
 * Run: npx --yes tsx lib/construction/brief113-variations.test.ts
 */
import assert from 'node:assert/strict';
import { emptyConstructiongraphStore } from './constructiongraph';
import { decideVariation, lineAmount, variationTotal } from './variations-model';

assert.equal(lineAmount({ description: 'Extra', qty: 2, uom: 'm', rate: 50 }), 100);
assert.equal(lineAmount({ description: 'Lump', qty: 1, uom: 'sum', amount: 80 }), 80);

const store = emptyConstructiongraphStore();
store.programme = [{ id: 'walls', activity: 'Walls', planned_start: '2026-10-01', planned_end: '2026-10-10', kind: 'task', depends_on: [], eot_days: 0 }];
store.variations = [{
  id: 'vo',
  number: 'VO-01',
  description: 'Extra wall',
  title: 'Extra wall',
  days: 4,
  status: 'submitted',
  programme_row_ids: ['walls'],
  lines: [{ description: 'Brick', qty: 10, uom: 'm2', rate: 20 }],
}];
assert.equal(variationTotal(store.variations[0]!), 200);
const decided = decideVariation(store, { id: 'vo', decision: 'approved', name: 'Office', date: '2026-10-15' });
assert.equal(decided.ok, true);
if (!decided.ok) throw new Error('decide');
assert.equal(decided.store.variations[0]?.status, 'approved');
assert.equal(decided.store.programme[0]?.planned_end, '2026-10-10');
assert.equal(decided.store.programme[0]?.eot_days, 4);

console.log('brief113-variations.test.ts ok');
