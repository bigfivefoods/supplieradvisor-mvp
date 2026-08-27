/**
 * Run: npx --yes tsx lib/suppliers/otifef-persist.test.ts
 */
import assert from 'node:assert/strict';
import { scorecardInsertRows } from './otifef';

const rows = scorecardInsertRows({
  buyerProfileId: 9,
  fromDate: '2026-01-01',
  toDate: '2026-12-31',
  now: '2026-08-27T00:00:00.000Z',
  rows: [
    {
      supplier_id: 1,
      name: 'A',
      total_pos: 4,
      ot_percent: 90,
      if_percent: 80,
      ef_percent: 70,
      overall: 80,
      ot_days: 0,
    },
    {
      supplier_id: 2,
      name: 'B',
      total_pos: 2,
      ot_percent: 100,
      if_percent: 100,
      ef_percent: 100,
      overall: 100,
      ot_days: 0,
    },
  ],
});

assert.equal(rows.length, 2);
assert.equal(rows[0].buyer_profile_id, 9);
assert.equal(rows[0].supplier_profile_id, 1);
assert.equal(rows[1].otifef_pct, 100);
assert.equal(rows[0].period_start, '2026-01-01');

console.log('otifef-persist tests ok');
