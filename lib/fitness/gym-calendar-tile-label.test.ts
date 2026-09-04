/**
 * Gym calendar tiles show class + coach only; roster is on the open card.
 * Run: npx --yes tsx lib/fitness/gym-calendar-tile-label.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cal = readFileSync(
  resolve('app/dashboard/fitgraph/calendar/page.tsx'),
  'utf8'
);
const eventsBlock = cal.slice(
  cal.indexOf('const scheduleEvents'),
  cal.indexOf('const schedulePeople')
);

assert.match(eventsBlock, /ct\?\.name \|\| 'Class'/);
assert.match(eventsBlock, /person_name:/);
assert.match(eventsBlock, /coach\?\.name/);
assert.doesNotMatch(eventsBlock, /sessionRosterNames/);
assert.doesNotMatch(eventsBlock, /names\.join/);
assert.doesNotMatch(eventsBlock, /Nobody booked/);
assert.match(eventsBlock, /Personal block/);
assert.match(eventsBlock, /: undefined,/);

assert.match(cal, /ClassBookedRoster/);
assert.match(cal, /Open to see members/);
assert.doesNotMatch(cal, /roster\.map\(\(b\) => b\.name\)\.join/);

const grid = readFileSync(
  resolve('components/schedule/PracticeScheduleCalendar.tsx'),
  'utf8'
);
const tile = grid.slice(
  grid.indexOf('{compact ? ('),
  grid.indexOf('{ev.meta ? (')
);
assert.match(tile, /ev\.person_name/);
assert.match(tile, /ev\.title/);

console.log('gym-calendar-tile-label.test.ts ok');
