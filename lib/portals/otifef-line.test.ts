/**
 * Run: npx --yes tsx lib/portals/otifef-line.test.ts
 */
import assert from 'node:assert/strict';
import { otifefForLine, rollupOtifef } from './otifef-line';

const pending = otifefForLine({ ordered: 10 });
assert.equal(pending.pending, true);
assert.equal(pending.overall, null);

const perfect = otifefForLine({
  promised_date: '2026-08-01',
  actual_date: '2026-08-01',
  ordered: 10,
  delivered: 10,
  damaged: 0,
});
assert.equal(perfect.pending, false);
assert.equal(perfect.onTimeFlag, true);
assert.equal(perfect.overall, 100);

const lateShort = otifefForLine({
  promised_date: '2026-08-01',
  actual_date: '2026-08-03',
  ordered: 10,
  delivered: 8,
  damaged: 1,
});
assert.equal(lateShort.onTimeFlag, false);
assert.ok((lateShort.overall || 0) < 80);

const roll = rollupOtifef([perfect, pending]);
assert.equal(roll.totalPOs, 2);
assert.equal(roll.overall, 100);

console.log('otifef-line.test.ts ok');
