/**
 * Run: npx --yes tsx lib/accounting/period-lock.test.ts
 */
import assert from 'node:assert/strict';
import { calendarYmd, periodKeyFromDate } from './period-lock';

const mar = calendarYmd('2026-03-01');
assert.ok(mar);
assert.equal(mar.y, 2026);
assert.equal(mar.m, 3);
assert.equal(mar.d, 1);
assert.equal(periodKeyFromDate('2026-03-01'), '2026-03');
assert.equal(periodKeyFromDate('2026-03-31'), '2026-03');
assert.equal(periodKeyFromDate('2026-02-28'), '2026-02');

// Must not shift March 1 into February via UTC parsing
assert.equal(periodKeyFromDate('2026-03-01T00:00:00.000Z'.slice(0, 10)), '2026-03');

console.log('period-lock calendar dates ok');
