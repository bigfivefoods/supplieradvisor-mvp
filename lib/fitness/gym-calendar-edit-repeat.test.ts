/**
 * Gym calendar: open/edit a one-off session and save it as a repeating series.
 * Run: npx --yes tsx lib/fitness/gym-calendar-edit-repeat.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emptyFitgraphStore } from './fitgraph';
import { expandSessionToSeries } from './class-allocate';

const cal = readFileSync(
  resolve('app/dashboard/fitgraph/calendar/page.tsx'),
  'utf8'
);
assert.match(cal, /showRepeatFields/);
assert.match(cal, /wantRepeat/);
assert.match(cal, /recurrenceApiPayload\(recurrence, form\.date\)/);
assert.match(cal, /Repeat below turns this one date into a series/);
assert.doesNotMatch(
  cal,
  /!selectedSessionId && form\.session_kind !== 'away' \?/
);

const route = readFileSync(
  resolve('app/api/fitness/fitgraph/route.ts'),
  'utf8'
);
assert.match(route, /expandSessionToSeries/);
assert.match(route, /parseRecurrenceBody/);
assert.match(route, /Saved as a series/);

const store = emptyFitgraphStore();
store.class_types.push({
  id: 'spin',
  code: 'SPIN',
  name: 'Spin',
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
});
store.sessions.push({
  id: 's-one',
  class_type_id: 'spin',
  date: '2026-09-07',
  start_time: '06:00',
  end_time: '06:45',
  status: 'scheduled',
  session_kind: 'class',
  created_at: '2026-01-01T00:00:00.000Z',
});
const r = expandSessionToSeries(store, {
  sessionId: 's-one',
  recurrence: { frequency: 'weekly', interval: 1, count: 3 },
  now: '2026-09-07T05:00:00.000Z',
});
assert.equal(r.added, 2);
assert.equal(store.sessions[0].id, 's-one');
assert.equal(store.sessions[0].origin, 'series');
assert.deepEqual(
  store.sessions.map((s) => s.date).sort(),
  ['2026-09-07', '2026-09-14', '2026-09-21']
);

console.log('gym-calendar-edit-repeat.test.ts ok');
