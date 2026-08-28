/**
 * Run: npx --yes tsx lib/schedule/working-hours.test.ts
 */
import assert from 'node:assert/strict';
import {
  compactWorkingHours,
  defaultWorkingHours,
  diaryWeekWindow,
  weekdayFromIso,
} from './working-hours';

const rows = compactWorkingHours(defaultWorkingHours());
assert.equal(rows[0]?.days, 'Mon–Fri');
assert.equal(rows[0]?.hours, '08:00–17:00');
assert.equal(rows[1]?.days, 'Sat');
assert.equal(rows[1]?.hours, '08:00–13:00');
assert.equal(rows[2]?.days, 'Sun');
assert.equal(rows[2]?.hours, 'Closed');

assert.equal(weekdayFromIso('2026-08-17'), 1);
assert.equal(weekdayFromIso('2026-08-23'), 0);

const win = diaryWeekWindow(defaultWorkingHours());
assert.equal(win.hourStart, 8);
assert.equal(win.hourEnd, 17);
assert.deepEqual(win.closedWeekdays, [0]);

const late = diaryWeekWindow({
  default_open: '07:30',
  default_close: '18:00',
  days: {
    '1': { closed: false, open: '07:30', close: '18:00' },
    '0': { closed: true },
  },
});
assert.equal(late.hourStart, 7);
assert.equal(late.hourEnd, 18);

console.log('working-hours compact: ok');
