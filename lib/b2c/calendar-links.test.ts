/**
 * Run: npx --yes tsx lib/b2c/calendar-links.test.ts
 */
import assert from 'node:assert/strict';
import {
  eventToIcs,
  googleCalendarUrl,
  memberCalendarIcs,
  outlookCalendarUrl,
} from './calendar-links';
import { hireJourneyCalendarEvent } from './hire-journeys';

const ev = {
  id: 'hire-1',
  title: 'Jumping castle hire',
  date: '2026-09-04',
  end_date: '2026-09-06',
  all_day: true,
  location: 'Sandton',
  description: 'Collect from desk',
};

const g = googleCalendarUrl(ev);
assert.match(g, /calendar\.google\.com\/calendar\/render/);
assert.match(g, /dates=20260904%2F20260907/);
assert.match(g, /text=Jumping\+castle\+hire/);

const o = outlookCalendarUrl(ev);
assert.match(o, /outlook\.live\.com\/calendar/);
assert.match(o, /startdt=2026-09-04T08%3A00%3A00/);

const icsEv = eventToIcs(ev);
assert.equal(icsEv.date, '2026-09-04');
assert.equal(icsEv.end_date, '2026-09-06');
assert.equal(icsEv.start_time, '08:00');

const ics = memberCalendarIcs([ev], 'SA Member');
assert.match(ics, /BEGIN:VCALENDAR/);
assert.match(ics, /DTSTART:20260904T080000/);
assert.match(ics, /DTEND:20260906T170000/);
assert.match(ics, /X-WR-CALNAME:SA Member/);

const cal = hireJourneyCalendarEvent({
  id: 'b1',
  item_title: 'JCB',
  brand: 'HireCo',
  start_date: '2026-10-01',
  end_date: '2026-10-03',
  status_label: 'On hire',
  next_action: 'Return by 2026-10-03',
  location: 'Depot',
  portal_path: '/hire/tok',
  collect_hours: '08:00–16:00',
  fulfillment_label: 'Collect from desk',
});
assert.ok(cal);
assert.equal(cal?.all_day, true);
assert.equal(cal?.end_date, '2026-10-03');
assert.equal(hireJourneyCalendarEvent({
  id: 'x',
  item_title: 'X',
  brand: 'B',
  start_date: null,
  end_date: null,
  status_label: 'Requested',
  next_action: 'Wait',
  portal_path: '/hire/x',
}), null);

console.log('calendar-links.test.ts ok');
