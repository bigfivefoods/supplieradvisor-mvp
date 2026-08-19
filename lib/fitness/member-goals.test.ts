/**
 * Run: npx --yes tsx lib/fitness/member-goals.test.ts
 */
import assert from 'node:assert/strict';
import {
  createMemberGoal,
  goalProgressPct,
  goalReached,
  latestGoalActual,
  logGoalActual,
} from './member-goals';
import { matchWatchToSession } from './wearables';
import { emptyFitgraphStore } from './fitgraph';

const weight = createMemberGoal({
  client_id: 'c1',
  kind: 'weight',
  start_value: 90,
  target_value: 80,
  target_date: '2026-12-01',
});
assert.equal(weight.direction, 'decrease');
assert.equal(weight.unit, 'kg');
assert.equal(latestGoalActual(weight), 90);
assert.equal(goalProgressPct(weight), 0);

const mid = logGoalActual(weight, 85);
assert.equal(mid.current_value, 85);
assert.equal(goalProgressPct(mid), 50);
assert.equal(goalReached(mid), false);

const done = logGoalActual(mid, 80);
assert.equal(done.status, 'achieved');
assert.equal(goalProgressPct(done), 100);

const run = createMemberGoal({
  client_id: 'c1',
  kind: 'run_5k',
  start_value: 32,
  target_value: 25,
});
assert.equal(run.unit, 'min');
const faster = logGoalActual(run, 26);
assert.equal(goalReached(faster), false);
assert.equal(goalReached(logGoalActual(run, 24)), true);

const store = emptyFitgraphStore();
store.sessions.push({
  id: 's1',
  class_type_id: 'ct1',
  date: '2026-08-19',
  start_time: '06:00',
  status: 'scheduled',
  created_at: '2026-08-01T00:00:00Z',
} as never);
store.bookings.push({
  id: 'b1',
  session_id: 's1',
  client_id: 'c1',
  status: 'attended',
  booked_at: '2026-08-18T00:00:00Z',
});
const hit = matchWatchToSession(store, 'c1', '2026-08-19T06:05:00', 45);
assert.equal(hit.session_id, 's1');
assert.equal(hit.booking_id, 'b1');
const miss = matchWatchToSession(store, 'c1', '2026-08-19T18:00:00', 45);
assert.equal(miss.session_id, null);

console.log('member-goals.test.ts ok');
