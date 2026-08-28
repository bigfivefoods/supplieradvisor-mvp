/**
 * Run: npx --yes tsx components/clinic/clinic-open-diary.render.test.ts
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClinicOpenDiary } from './ClinicMemberPwaUi';

const html = renderToStaticMarkup(
  createElement(ClinicOpenDiary, {
    slots: [
      {
        id: 's1',
        date: '2026-08-18',
        start_time: '09:00',
        end_time: '09:30',
        service_name: 'Consult',
        full: false,
      },
    ],
    color: '#0d9488',
    allowBooking: true,
    onBook: () => undefined,
    onJoinWaitlist: () => undefined,
  })
);

const cal = html.indexOf('17–23 Aug') >= 0 ? html.indexOf('2.25rem repeat(7') : html.indexOf('grid-template-columns');
const schedule = html.indexOf('>Schedule<');
const waitlist = html.indexOf('Join next-available waitlist');
const oneCal = html.indexOf('One practice calendar');
assert.ok(cal >= 0, 'calendar grid missing');
assert.ok(schedule > cal, 'Schedule copy should sit below the calendar');
assert.ok(waitlist > schedule, 'waitlist should sit below Schedule');
assert.ok(oneCal > waitlist, 'one-practice copy should sit last');
assert.match(html, /Look at the clinic calendar to book a session or join the waitlist/);
assert.match(html, /Book your regular clinician or another available practitioner/);

console.log('clinic-open-diary.render.test.ts ok');
