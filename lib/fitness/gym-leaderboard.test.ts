/**
 * Run: npx --yes tsx lib/fitness/gym-leaderboard.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore } from './fitgraph';
import {
  assignGymBoardActivity,
  benchmarkForDivision,
  buildGymBoardRows,
  clientEligibleForGymBoard,
  gymBoardAgeBandForAge,
  gymBoardForClient,
  memberGymBoardDivision,
  parseGymBoardSex,
  upsertGymBoardActivity,
  upsertGymBoardScore,
} from './gym-leaderboard';

assert.equal(parseGymBoardSex('Female'), 'female');
assert.equal(parseGymBoardSex('M'), 'male');
assert.equal(gymBoardAgeBandForAge(29)?.id, '25_34');
assert.equal(gymBoardAgeBandForAge(65)?.id, '65p');

const made = upsertGymBoardActivity([], {
  name: 'Back squat 5RM',
  unit: 'kg',
  win: 'higher',
  benchmarks: [
    { sex: 'male', band_id: '25_34', value: 140 },
    { sex: 'female', band_id: '25_34', value: 90 },
  ],
});
assert.equal(made.row.name, 'Back squat 5RM');
assert.equal(made.row.benchmarks.length, 2);

const store = emptyFitgraphStore();
store.leaderboard_activities = made.list;
store.clients = [
  {
    id: 'c1',
    name: 'Ada',
    code: 'A',
    created_at: '2020-01-01',
    date_of_birth: '1996-03-01',
    passport: { sex: 'female', date_of_birth: '1996-03-01' },
  },
  {
    id: 'c2',
    name: 'Ben',
    code: 'B',
    created_at: '2020-01-01',
    date_of_birth: '1994-06-01',
    passport: { sex: 'male', date_of_birth: '1994-06-01' },
  },
  {
    id: 'c3',
    name: 'Cara',
    code: 'C',
    created_at: '2020-01-01',
    date_of_birth: '1997-01-01',
    passport: { sex: 'female', date_of_birth: '1997-01-01' },
  },
] as never;

const div = memberGymBoardDivision(store.clients[0]);
assert.equal(div.sex, 'female');
assert.equal(div.band_id, '25_34');
assert.equal(benchmarkForDivision(made.row, div), 90);

store.class_types = [{ id: 'cls1', name: 'Strength', created_at: '' } as never];
store.sessions = [
  {
    id: 'ses1',
    class_type_id: 'cls1',
    date: '2026-08-01',
    start_time: '06:00',
    status: 'scheduled',
  } as never,
];
store.bookings = [
  { id: 'b1', session_id: 'ses1', client_id: 'c1', status: 'attended' } as never,
  { id: 'b2', session_id: 'ses1', client_id: 'c3', status: 'attended' } as never,
];

const assigned = assignGymBoardActivity([], {
  activity_id: made.row.id,
  class_type_id: 'cls1',
});
store.leaderboard_assignments = assigned.list;
assert.equal(clientEligibleForGymBoard(store, made.row.id, 'c1').ok, true);
assert.equal(clientEligibleForGymBoard(store, made.row.id, 'c2').ok, false);

store.leaderboard_scores = upsertGymBoardScore([], {
  activity_id: made.row.id,
  client_id: 'c1',
  value: 95,
  display: '95',
}).list;
store.leaderboard_scores = upsertGymBoardScore(store.leaderboard_scores, {
  activity_id: made.row.id,
  client_id: 'c3',
  value: 80,
  display: '80',
}).list;
store.leaderboard_scores = upsertGymBoardScore(store.leaderboard_scores, {
  activity_id: made.row.id,
  client_id: 'c2',
  value: 160,
  display: '160',
}).list;

const femaleBoard = buildGymBoardRows(store, made.row, div);
assert.equal(femaleBoard.length, 2);
assert.equal(femaleBoard[0].name, 'Ada');
assert.equal(femaleBoard[0].rank, 1);
assert.equal(femaleBoard[0].pct, 106);

const forAda = gymBoardForClient(store, store.clients[0]);
assert.equal(forAda.activities.length, 1);
assert.equal(forAda.activities[0].my_rank, 1);
assert.match(forAda.activities[0].standing, /1st of 2/);

console.log('gym-leaderboard.test.ts ok');
