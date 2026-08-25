/**
 * Run: npx --yes tsx lib/fitness/class-challenges.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore } from './fitgraph';
import {
  buildChallengeBoard,
  challengeForSession,
  clientEligibleForChallenge,
  openChallengesForClient,
  parseChallengeValue,
  standingLine,
  upsertChallengeScore,
  upsertClassChallenge,
} from './class-challenges';

const kg = parseChallengeValue('140', 'higher');
assert.ok(!('error' in kg));
assert.equal(kg.value, 140);

const time = parseChallengeValue('2:30', 'faster');
assert.ok(!('error' in time));
assert.equal(time.value, 150);

const miss = parseChallengeValue('', 'higher');
assert.ok('error' in miss);

const store = emptyFitgraphStore();
store.class_types.push({
  id: 'ct_str',
  code: 'STR',
  name: 'Morning strength',
  created_at: '2026-01-01T00:00:00.000Z',
});
store.clients.push(
  {
    id: 'c1',
    code: 'M1',
    name: 'Alex',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c2',
    code: 'M2',
    name: 'Priya',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c3',
    code: 'M3',
    name: 'Sam',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
);
store.sessions.push({
  id: 'ses_1',
  class_type_id: 'ct_str',
  coach_id: 'coh_1',
  date: '2026-08-25',
  start_time: '06:00',
  session_kind: 'class',
  status: 'scheduled',
  created_at: '2026-08-01T00:00:00.000Z',
});
store.bookings.push(
  {
    id: 'b1',
    session_id: 'ses_1',
    client_id: 'c1',
    status: 'attended',
    booked_at: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'b2',
    session_id: 'ses_1',
    client_id: 'c2',
    status: 'attended',
    booked_at: '2026-08-20T00:00:00.000Z',
  }
);

const made = upsertClassChallenge([], {
  class_type_id: 'ct_str',
  coach_id: 'coh_1',
  title: 'Back squat 5RM',
  unit: 'kg',
  win: 'higher',
  target: '140',
});
assert.equal(made.error, undefined);
assert.equal(made.row.target, 140);
store.class_challenges = made.list;

const hit = challengeForSession(store, store.sessions[0]);
assert.equal(hit?.id, made.row.id);

const ok = clientEligibleForChallenge(store, made.row, 'c1', 'ses_1');
assert.equal(ok.ok, true);
const no = clientEligibleForChallenge(store, made.row, 'c3', 'ses_1');
assert.equal(no.ok, false);

let scores = upsertChallengeScore([], {
  challenge_id: made.row.id,
  client_id: 'c1',
  value: 145,
  display: '145',
  division: 'rx',
}).list;
scores = upsertChallengeScore(scores, {
  challenge_id: made.row.id,
  client_id: 'c2',
  value: 130,
  display: '130',
  division: 'rx',
}).list;
store.class_challenge_scores = scores;

const board = buildChallengeBoard(store, made.row);
assert.equal(board[0].name, 'Alex');
assert.equal(board[0].rank, 1);
assert.equal(board[0].pct, 104);
assert.equal(board[1].name, 'Priya');

const views = openChallengesForClient(store, 'c1');
assert.equal(views.length, 1);
assert.equal(views[0].my_rank, 1);
assert.equal(views[0].field, 2);
assert.equal(standingLine(views[0]), 'You are 1st of 2');
assert.equal(openChallengesForClient(store, 'c3').length, 0);

console.log('class-challenges.test.ts ok');
