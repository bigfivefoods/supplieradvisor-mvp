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

// ── Brief 30 tests ────────────────────────────────────────────────────────────

// T1: Coach upsert_goal twice on same coach id → ONE goal; second save keeps check_ins
{
  const s = emptyFitgraphStore();
  s.coaches = [{
    id: 'coach1', name: 'Bob', code: 'B', created_at: '', updated_at: '',
    goals: [],
  } as never];
  s.clients = [];
  s.goals = [];
  const g1 = createMemberGoal({ client_id: 'coach1', kind: 'weight', start_value: 90, target_value: 80, nowIso: '2026-08-01T00:00:00Z' });
  applyGoalToStore(s, g1);
  // Log an actual so there is a check_in beyond the start one
  const g1a = logGoalActual(s.goals![0], 88, { nowIso: '2026-08-05T00:00:00Z' });
  applyGoalToStore(s, g1a);
  const checkInsAfterFirst = (s.goals![0].check_ins || []).length;
  assert.ok(checkInsAfterFirst >= 2, 'should have start + actual check_in');
  // Simulate second upsert: find prev by same kind+title+active, spread it (keeping check_ins)
  const prev = (s.goals || []).find(g => g.client_id === 'coach1' && g.kind === 'weight' && g.status === 'active');
  assert.ok(prev, 'first goal should exist');
  const g2 = { ...prev!, target_value: 75, updated_at: '2026-08-10T00:00:00Z' };
  applyGoalToStore(s, g2);
  const coachGoals = (s.goals || []).filter(g => g.client_id === 'coach1');
  assert.equal(coachGoals.length, 1, 'should be ONE goal after second save');
  assert.equal(coachGoals[0].target_value, 75);
  assert.ok((coachGoals[0].check_ins || []).length >= 2, 'check_ins must be kept on second upsert');
}

// T2: logGoalActual with custom nowIso → check_ins[0].at starts with that date;
//     writeFitgraphToMetadata / readFitgraphFromMetadata roundtrip still has it
{
  const s = emptyFitgraphStore();
  s.clients = [{ id: 'c2', name: 'Eve', code: 'E', created_at: '', updated_at: '' } as never];
  const g = createMemberGoal({ client_id: 'c2', kind: 'weight', start_value: 90, target_value: 80 });
  applyGoalToStore(s, g);
  const logged = logGoalActual(s.goals![0], 85, { nowIso: '2026-08-12T00:00:00.000Z' });
  applyGoalToStore(s, logged);
  const blob = writeFitgraphToMetadata({}, s);
  const reloaded = readFitgraphFromMetadata(blob);
  const ci = (reloaded.goals || [])[0]?.check_ins || [];
  const aug12 = ci.find(c => c.at.startsWith('2026-08-12'));
  assert.ok(aug12, 'check_in dated 2026-08-12 must survive roundtrip');
}

// T3: retainMemberProgress(latestWithChecks, incomingPlanOnly) keeps the check-ins
{
  const latest = emptyFitgraphStore();
  const goalWithHistory: import('./fitgraph-relationship').FitGoal = {
    id: 'gH',
    client_id: 'c3',
    title: 'Lose weight',
    category: 'physical',
    status: 'active',
    check_ins: [{ id: 'ci1', at: '2026-08-01T00:00:00Z', metric_value: 90 }],
    created_at: '2026-08-01',
    updated_at: '2026-08-10',
    created_by_role: 'member',
  };
  latest.goals = [goalWithHistory];
  latest.clients = [{ id: 'c3', name: 'Carl', code: 'C', created_at: '', updated_at: '', goals: [goalWithHistory] } as never];
  // incoming has same goal id but no check_ins (plan-only save)
  const incoming = emptyFitgraphStore();
  const planOnly = { ...goalWithHistory, check_ins: [] };
  incoming.goals = [planOnly];
  incoming.clients = [{ id: 'c3', name: 'Carl', code: 'C', created_at: '', updated_at: '', goals: [planOnly] } as never];
  const merged = retainMemberProgress(latest, incoming);
  const mergedGoal = (merged.goals || []).find(g => g.id === 'gH');
  assert.ok(mergedGoal, 'goal must exist');
  assert.ok((mergedGoal!.check_ins || []).length >= 1, 'check_ins must be retained from latest');
}

// T4: Injury on a person survives a later goal save that omitted injuries
{
  const s = emptyFitgraphStore();
  const injury = { id: 'inj1', body_part: 'knee', note: 'strained', created_at: '2026-08-01' };
  s.clients = [{ id: 'c4', name: 'Dan', code: 'D', created_at: '', updated_at: '', injuries: [injury], goals: [] } as never];
  s.goals = [];
  // Now simulate a goal-only save that wipes injuries from incoming
  const incoming = emptyFitgraphStore();
  const newGoal = createMemberGoal({ client_id: 'c4', kind: 'weight', start_value: 80, target_value: 70 });
  incoming.goals = [newGoal];
  incoming.clients = [{ id: 'c4', name: 'Dan', code: 'D', created_at: '', updated_at: '', injuries: [], goals: [newGoal] } as never];
  const retained = retainMemberProgress(s, incoming);
  const client = (retained.clients || []).find(c => c.id === 'c4');
  assert.ok(
    ((client as never as { injuries?: Array<{ id?: string }> })?.injuries || []).some(i => i.id === 'inj1'),
    'injury must survive goal save'
  );
}

console.log('member-goals.test.ts ok');
