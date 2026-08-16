/**
 * Run: npx --yes tsx lib/accounting/afs-period.test.ts
 */
import assert from 'node:assert/strict';
import {
  addCalendarDays,
  calendarDayCount,
  isFullFiscalYear,
  priorComparablePeriod,
} from './afs-period';

assert.equal(addCalendarDays('2026-03-01', -1), '2026-02-28');
assert.equal(addCalendarDays('2026-03-01', 365), '2027-03-01');
assert.equal(calendarDayCount('2026-03-01', '2027-02-28'), 365);
assert.equal(isFullFiscalYear('2026-03-01', '2027-02-28', 3), true);
assert.equal(isFullFiscalYear('2026-03-01', '2026-08-31', 3), false);

const fy = priorComparablePeriod('2026-03-01', '2027-02-28', 3);
assert.equal(fy.from, '2025-03-01');
assert.equal(fy.to, '2026-02-28');
assert.match(fy.label, /2025/);

const mid = priorComparablePeriod('2026-06-01', '2026-08-31', 3);
assert.equal(mid.to, '2026-05-31');
assert.equal(calendarDayCount(mid.from, mid.to), calendarDayCount('2026-06-01', '2026-08-31'));

console.log('afs-period ok');
