/**
 * Run: npx --yes tsx lib/accounting/management-pack.test.ts
 */
import assert from 'node:assert/strict';
import { monthKeysInclusive, trendMonthKeys } from './management-pack';

assert.deepEqual(monthKeysInclusive('2026-03-01', '2026-05-31'), [
  '2026-03',
  '2026-04',
  '2026-05',
]);

const padded = trendMonthKeys('2026-08-01', '2026-08-31');
assert.equal(padded.length, 6);
assert.equal(padded[padded.length - 1], '2026-08');
assert.equal(padded[0], '2026-03');

const long = trendMonthKeys('2025-01-01', '2026-08-31');
assert.equal(long.length, 12);
assert.equal(long[0], '2025-09');
assert.equal(long[11], '2026-08');

console.log('management-pack months ok');
