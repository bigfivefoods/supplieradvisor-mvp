/**
 * Run: npx --yes tsx lib/fitness/member-goals.test.ts
 */
import assert from 'node:assert/strict';
import {
  applyGoalToStore,
  createMemberGoal,
  goalProgressPct,
  goalReached,
  hydrateGoalsFromPeople,
  latestGoalActual,
  logGoalActual,
  memberFacingGoals,
  parseGoalNumber,
  retainMemberProgress,
} from './member-goals';
import { matchWatchToSession } from './wearables';
import {
  emptyFitgraphStore,
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
} from './fitgraph';

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

assert.equal(parseGoalNumber(''), null);
assert.equal(parseGoalNumber('  '), null);
assert.equal(parseGoalNumber('90.5'), 90.5);
assert.equal(parseGoalNumber(0), 0);
assert.equal(parseGoalNumber('85 kg'), 85);
assert.equal(parseGoalNumber('2:30'), 2.5);

const persist = emptyFitgraphStore();
persist.clients = [
  { id: 'c1', name: 'Ada', code: 'A', created_at: '', updated_at: '' } as never,
];
const saved = createMemberGoal({
  client_id: 'c1',
  kind: 'weight',
  start_value: 90,
  target_value: 80,
});
applyGoalToStore(persist, saved);
const blob = writeFitgraphToMetadata({}, persist);
const reloaded = readFitgraphFromMetadata(blob);
assert.equal(reloaded.goals?.length, 1);
assert.equal(reloaded.goals?.[0].start_value, 90);
assert.equal(reloaded.goals?.[0].target_value, 80);
const withActual = logGoalActual(reloaded.goals![0], 85);
applyGoalToStore(reloaded, withActual);
const blob2 = writeFitgraphToMetadata({}, reloaded);
const again = readFitgraphFromMetadata(blob2);
assert.equal(again.goals?.[0].current_value, 85);
assert.ok((again.goals?.[0].check_ins || []).length >= 2);
applyGoalToStore(persist, withActual);
assert.equal(persist.clients[0].goals?.[0].current_value, 85);
assert.equal((persist.clients[0].goals?.[0].check_ins || []).length >= 2, true);
assert.equal((persist.clients[0].result_logs || []).length >= 1, true);
assert.equal(weight.check_ins?.length, 1);

const fromProfile = emptyFitgraphStore();
fromProfile.clients = [
  {
    id: 'c1',
    name: 'Ada',
    code: 'A',
    created_at: '',
    updated_at: '',
    goals: [persist.clients[0].goals![0]],
  } as never,
];
fromProfile.goals = [];
hydrateGoalsFromPeople(fromProfile);
assert.equal(fromProfile.goals?.length, 1);
assert.equal(memberFacingGoals(fromProfile, 'c1').length, 1);
assert.equal(memberFacingGoals(fromProfile, 'c1')[0]?.actual, 85);

const onlyOnPerson = emptyFitgraphStore();
onlyOnPerson.clients = [
  {
    id: 'c1',
    name: 'Ada',
    code: 'A',
    created_at: '',
    updated_at: '',
    goals: [persist.clients[0].goals![0]],
  } as never,
];
assert.equal(memberFacingGoals(onlyOnPerson, 'c1')[0]?.target_value, 80);

const recovered = emptyFitgraphStore();
recovered.clients = [
  {
    id: 'c1',
    name: 'Ada',
    code: 'A',
    created_at: '',
    updated_at: '',
    result_logs: [
      {
        id: 'r1',
        kind: 'goal',
        title: 'Lose weight',
        value: '88',
        numeric: 88,
        unit: 'kg',
        at: '2026-08-20T00:00:00Z',
        source_id: 'goal_old',
      },
    ],
  } as never,
];
hydrateGoalsFromPeople(recovered);
assert.equal(memberFacingGoals(recovered, 'c1')[0]?.title, 'Lose weight');
assert.equal(memberFacingGoals(recovered, 'c1')[0]?.actual, 88);

const latestKeep = emptyFitgraphStore();
latestKeep.goals = [
  {
    id: 'keep_me',
    client_id: 'c1',
    title: 'Keep',
    category: 'physical',
    status: 'active',
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
  } as never,
];
const wiped = emptyFitgraphStore();
wiped.goals = [];
const kept = retainMemberProgress(latestKeep, wiped);
assert.equal(kept.goals?.some((g) => g.id === 'keep_me'), true);

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
