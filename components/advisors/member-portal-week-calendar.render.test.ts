/**
 * Run: npx --yes tsx components/advisors/member-portal-week-calendar.render.test.ts
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemberPortalWeekCalendar } from './MemberPortalWeekCalendar';

const html = renderToStaticMarkup(
  createElement(MemberPortalWeekCalendar, {
    events: [
      {
        id: '1',
        date: '2026-08-18',
        start_time: '09:00',
        end_time: '09:30',
        title: 'Consult',
      },
    ],
    hourStart: 8,
    hourEnd: 17,
    weekStart: '2026-08-17',
    hidePeek: true,
    closedWeekdays: [0],
    hoursHint: 'Mon–Fri 08:00–17:00 · Sat 08:00–13:00 · Sun Closed',
  })
);

assert.match(html, /17–23 Aug/);
assert.match(html, /Mon–Fri 08:00–17:00/);
assert.match(html, /2\.25rem repeat\(7/);
assert.equal((html.match(/2\.25rem repeat\(7/g) || []).length, 1);
assert.doesNotMatch(html, /min-w-\[640px\]/);
assert.match(html, />17</);
assert.match(html, />18</);
assert.match(html, />23</);
assert.match(html, /Closed/);
assert.match(html, /08:00/);
assert.match(html, /16:00/);
assert.match(html, /Consult/);
assert.match(html, /09:00/);

console.log('member-portal-week-calendar.render.test.ts ok');
