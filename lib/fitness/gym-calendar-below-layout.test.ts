/**
 * Gym calendar: only working hours and diary colours sit under the week diary.
 * Run: npx --yes tsx lib/fitness/gym-calendar-below-layout.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cal = readFileSync(
  resolve('app/dashboard/fitgraph/calendar/page.tsx'),
  'utf8'
);
const wait = cal.indexOf('title={`Waitlist · ${waitlistCount}`}');
const list = cal.indexOf('title={`Sessions on ${day}`}');
const diary = cal.indexOf('title="Gym schedule · this week"');
const hours = cal.indexOf('title="Gym working hours"');
const colors = cal.indexOf('title="Diary colours"');
const peek = cal.indexOf('<ScheduleEventPeek');

assert.ok(wait > 0 && list > 0 && diary > 0 && hours > 0 && colors > 0);
assert.ok(wait < diary, 'waitlist is not under the calendar');
assert.ok(list < diary, 'session list is not under the calendar');
assert.ok(diary < hours, 'working hours sit under the calendar');
assert.ok(hours < colors, 'diary colours follow working hours');
assert.ok(colors < peek, 'event peek stays after the under-calendar panels');

assert.match(cal, /hoursOpen/);
assert.match(cal, /colorsOpen/);
assert.match(cal, /collapsible=\{false\}/);
assert.match(
  cal,
  /title="Gym working hours"[\s\S]*accentClass="border-yellow-200 bg-yellow-50\/50[\s\S]*title="Diary colours"[\s\S]*accentClass="border-yellow-200 bg-yellow-50\/50/
);

const hoursEd = readFileSync(
  resolve('components/schedule/WorkingHoursEditor.tsx'),
  'utf8'
);
assert.match(hoursEd, /collapsible\?: boolean/);
assert.match(hoursEd, /collapsible \? header : null/);

console.log('gym-calendar-below-layout.test.ts ok');
