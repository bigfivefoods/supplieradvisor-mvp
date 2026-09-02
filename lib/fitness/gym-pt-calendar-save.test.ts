/**
 * Private PT calendar save must be one request — not a client upsert
 * (that path stamps CRM / wallet and hung the desk).
 * Run: npx --yes tsx lib/fitness/gym-pt-calendar-save.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emptyFitgraphStore } from './fitgraph';
import { applyPrivatePtBooking } from './class-allocate';

const cal = readFileSync(
  resolve('app/dashboard/fitgraph/calendar/page.tsx'),
  'utf8'
);
assert.match(cal, /save_calendar_sessions/);
assert.match(cal, /client_id:/);
assert.doesNotMatch(cal, /entity: 'clients'/);
assert.doesNotMatch(
  cal,
  /bookMembersOntoSession\(s\.id, \[form\.client_id\]\)/
);

const route = readFileSync(
  resolve('app/api/fitness/fitgraph/route.ts'),
  'utf8'
);
assert.match(route, /action === 'save_calendar_sessions'/);
assert.match(route, /applyPrivatePtBooking/);
assert.match(route, /body\.lite !== true && rec\.lite !== true/);
assert.doesNotMatch(
  route,
  /await import\(\s*['"]@\/lib\/fitness\/class-allocate['"]/
);
assert.match(cal, /lite: true/);

const store = emptyFitgraphStore();
store.clients.push({
  id: 'c1',
  code: '1',
  name: 'Ada',
  active: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
});
store.sessions.push({
  id: 's1',
  class_type_id: 'pt',
  date: '2026-09-02',
  start_time: '08:00',
  status: 'scheduled',
  session_kind: 'private_pt',
  created_at: '2026-01-01T00:00:00.000Z',
});
const r = applyPrivatePtBooking(store, {
  sessionIds: ['s1'],
  clientId: 'c1',
  now: '2026-09-02T07:00:00.000Z',
  rateZar: 800,
});
assert.equal(r.added, 1);
assert.equal(store.clients[0].private_rate_zar, 800);

console.log('gym-pt-calendar-save.test.ts ok');
