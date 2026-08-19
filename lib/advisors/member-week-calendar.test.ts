/**
 * Run: npx --yes tsx lib/advisors/member-week-calendar.test.ts
 */
import assert from 'node:assert/strict';
import {
  bookingsToMemberCalendarEvents,
  eventEndMinutes,
  hourRange,
  mergeMemberCalendarEvents,
  mondayOf,
  slotsToMemberCalendarEvents,
  weekDays,
} from './member-week-calendar';

assert.equal(mondayOf('2026-08-19'), '2026-08-17');
assert.equal(weekDays('2026-08-17').length, 7);
assert.equal(weekDays('2026-08-17')[6], '2026-08-23');

const slot = slotsToMemberCalendarEvents([
  {
    id: 's1',
    date: '2026-08-18',
    start_time: '06:00',
    end_time: '06:45',
    class_name: 'Morning strength',
    coach_name: 'Alex',
    my_status: null,
    full: false,
  },
])[0];
assert.equal(slot.title, 'Morning strength');
assert.equal(eventEndMinutes(slot), 6 * 60 + 45);

const mine = bookingsToMemberCalendarEvents([
  {
    booking_id: 'b1',
    date: '2026-08-18',
    start_time: '06:00',
    class_name: 'Morning strength',
    status: 'booked',
  },
]);
const merged = mergeMemberCalendarEvents([slot], mine);
assert.equal(merged.length, 1);

const range = hourRange([slot]);
assert.equal(range.start, 6);
assert.ok(range.end >= 7);

console.log('member-week-calendar.test.ts ok');
