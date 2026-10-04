/**
 * Private PT scheduling: several active members, A–Z, not inactive.
 * Run: npx --yes tsx lib/fitness/gym-calendar-pt-members.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cal = readFileSync(
  resolve('app/dashboard/fitgraph/calendar/page.tsx'),
  'utf8'
);
assert.match(cal, /client_ids:/);
assert.match(cal, /Add member…/);
assert.match(cal, /No members yet — add one or more below/);
assert.match(
  cal,
  /\.filter\(\(c\) => c\.active !== false\)[\s\S]*localeCompare/
);
assert.doesNotMatch(cal, /Member \/ private client/);
assert.doesNotMatch(
  cal.slice(cal.indexOf("form.session_kind === 'private_pt' ? (")),
  /c\.active === false \? 'inactive'/
);

const route = readFileSync(
  resolve('app/api/fitness/fitgraph/route.ts'),
  'utf8'
);
assert.match(route, /parseFitClientIds\(body\.client_ids, body\.client_id\)/);
assert.match(route, /applyPrivatePtBookings/);
assert.match(
  route,
  /if \(entity === 'sessions'\) \{[\s\S]*upsertPatchKeys\.push\('bookings', 'clients'\)/
);

console.log('gym-calendar-pt-members.test.ts ok');
