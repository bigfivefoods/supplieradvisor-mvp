/**
 * Gym Bookings roster + Website/Preview merge.
 * Run: npx --yes tsx lib/advisors/gym-bookings-and-grow.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MODULE_NAV } from '../chrome/module-nav';

const gym = MODULE_NAV.find((m) => m.id === 'fitgraph');
assert.ok(gym);
const names = gym!.steps.map((s) => s.name);
assert.ok(names.includes('Bookings'));
assert.ok(names.includes('Website & apps'));
assert.equal(names.includes('View portal'), false);
assert.equal(names.includes('Website'), false);
const site = gym!.steps.find((s) => s.name === 'Website & apps');
assert.equal(site!.href, '/dashboard/fitgraph/website');
assert.equal(site!.section, 'Grow');
const bookingsNav = gym!.steps.find((s) => s.name === 'Bookings');
assert.equal(bookingsNav!.href, '/dashboard/fitgraph/bookings');
assert.equal(bookingsNav!.section, 'Floor');

for (const id of [
  'physiograph',
  'dentalgraph',
  'psychiatrygraph',
  'medicalgraph',
  'vetgraph',
]) {
  const mod = MODULE_NAV.find((m) => m.id === id);
  assert.ok(mod, `${id} nav exists`);
  const stepNames = mod!.steps.map((s) => s.name);
  assert.ok(stepNames.includes('View portal'), `${id} keeps View portal`);
  assert.ok(stepNames.includes('Website'), `${id} keeps Website`);
}

const bookings = readFileSync(
  resolve('app/dashboard/fitgraph/bookings/page.tsx'),
  'utf8'
);
assert.match(bookings, /call in the plan/);
assert.match(bookings, /addSessions/);
assert.match(bookings, /Search member/);
assert.match(bookings, /mark_attendance/);
assert.match(bookings, /AdvisorMemberJoinInbox/);
assert.match(bookings, /AdvisorWaitlistDesk/);
assert.match(bookings, /issue_class_invite/);
assert.match(bookings, /gymPlanWeek/);
assert.match(bookings, /This week/);
assert.match(bookings, /Custom/);

const website = readFileSync(
  resolve('app/dashboard/fitgraph/website/page.tsx'),
  'utf8'
);
assert.match(website, /tab === 'preview'/);
assert.match(website, /AdvisorPortalPreviewDesk/);
assert.match(website, /AdvisorPortalManager/);
assert.match(website, /showGrowPreviews=\{false\}/);
assert.match(website, /Publish/);
assert.match(website, /Preview/);
assert.match(website, /AdvisorRoomsCard/);
assert.match(website, /FitContractDocsPanel/);
assert.match(website, /AdvisorPayoutSettings/);
assert.match(website, /gym check-in QR/);
assert.match(website, /AdvisorMemberPwaCard|onSavePwa/);

const portal = readFileSync(
  resolve('app/dashboard/fitgraph/portal/page.tsx'),
  'utf8'
);
assert.match(
  portal,
  /redirect\('\/dashboard\/fitgraph\/website\?tab=preview'\)/
);

const manager = readFileSync(
  resolve('components/advisors/AdvisorPortalManager.tsx'),
  'utf8'
);
assert.match(manager, /showGrowPreviews !== false/);
assert.match(manager, /<AdvisorGrowPreviews/);
assert.match(manager, /module=\{module\}/);

const flow = readFileSync(
  resolve('components/fitness/FitgraphSystemFlow.tsx'),
  'utf8'
);
assert.match(flow, /\/dashboard\/fitgraph\/website\?tab=preview/);
assert.doesNotMatch(flow, /href: '\/dashboard\/fitgraph\/portal'/);

console.log('gym-bookings-and-grow.test.ts ok');
