/**
 * Run: npx --yes tsx lib/fitness/member-profile.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore } from './fitgraph';
import {
  ageFromDob,
  appendJoinEvent,
  memberBirthday,
  memberJoinTimeline,
  memberPersonalBests,
  monthlyStatements,
  nextOfKinLabel,
  passportFacts,
} from './member-profile';

assert.equal(ageFromDob('1990-08-19', '2026-08-19'), 36);
assert.equal(ageFromDob('1990-08-20', '2026-08-19'), 35);
assert.equal(ageFromDob('bad'), null);

const client = {
  id: 'cli_1',
  code: 'A1',
  name: 'Ada',
  email: 'ada@test.com',
  id_number: '9001014800088',
  date_of_birth: '1990-01-01',
  next_of_kin: 'Sam',
  next_of_kin_phone: '082111',
  next_of_kin_relationship: 'spouse',
  start_date: '2026-02-01',
  created_at: '2026-01-15T10:00:00.000Z',
  updated_at: '2026-02-01T10:00:00.000Z',
  invite_accepted_at: '2026-01-20T10:00:00.000Z',
  platform_user_id: 'did:privy:ada',
  passport: {
    date_of_birth: '1990-01-01',
    emergency_name: 'Sam',
    emergency_phone: '082111',
    emergency_relationship: 'spouse',
    city: 'Cape Town',
    country: 'South Africa',
    allergies: 'Bees',
    goals: '5km under 30',
  },
  join_events: appendJoinEvent(
    { join_events: [] },
    {
      at: '2026-01-20T10:00:00.000Z',
      kind: 'joined_pwa',
      title: 'Joined from SA Member',
      source: 'pwa',
    }
  ),
};

assert.equal(memberBirthday(client), '1990-01-01');
assert.match(String(nextOfKinLabel(client)), /Sam/);
assert.ok(passportFacts(client).some((f) => f.label === 'Allergies'));
assert.ok(passportFacts(client).some((f) => f.label === 'Next of kin'));

const store = emptyFitgraphStore();
store.clients.push(client);
store.membership_plans.push({
  id: 'pln_1',
  code: 'FSF',
  name: 'FSF 5am',
  price_zar: 910,
  billing: 'monthly',
  created_at: '2026-01-01T00:00:00.000Z',
});
store.subscriptions.push({
  id: 'sub_1',
  client_id: 'cli_1',
  plan_id: 'pln_1',
  status: 'active',
  started_at: '2026-02-01',
  created_at: '2026-02-01T00:00:00.000Z',
  updated_at: '2026-02-01T00:00:00.000Z',
});
store.goals = [
  {
    id: 'g1',
    client_id: 'cli_1',
    title: '5 km run',
    category: 'performance',
    status: 'achieved',
    kind: 'run_5k',
    current_value: 28,
    unit: 'min',
    achieved_at: '2026-06-01T00:00:00.000Z',
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
  },
];
store.watch_sessions = [
  {
    id: 'w1',
    client_id: 'cli_1',
    source: 'garmin',
    started_at: '2026-06-02T06:00:00.000Z',
    duration_min: 42,
    distance_km: 7.2,
    calories: 510,
    created_at: '2026-06-02T07:00:00.000Z',
  },
];

const timeline = memberJoinTimeline(store, client);
assert.ok(timeline.some((t) => t.title.includes('Joined from SA Member')));
assert.ok(timeline.some((t) => t.title.includes('FSF 5am')));
assert.ok(timeline.some((t) => t.title.includes('Membership start')));

const pbs = memberPersonalBests(store, 'cli_1');
assert.ok(pbs.some((p) => p.label === '5 km run' && p.value.includes('28')));
assert.ok(pbs.some((p) => p.label.includes('distance') && p.value.includes('7.20')));

const months = monthlyStatements([
  {
    id: 'ch1',
    kind: 'gym',
    ref_id: 'cli_1',
    member_name: 'Ada',
    description: 'February membership',
    amount_zar: 910,
    status: 'paid',
    due_date: '2026-02-01',
    created_at: '2026-02-01T00:00:00.000Z',
    source: 'subscription',
  },
  {
    id: 'ch2',
    kind: 'gym',
    ref_id: 'cli_1',
    member_name: 'Ada',
    description: 'March membership',
    amount_zar: 910,
    status: 'open',
    due_date: '2026-03-01',
    created_at: '2026-03-01T00:00:00.000Z',
    source: 'subscription',
  },
]);
assert.equal(months.length, 2);
assert.equal(months[0].month, '2026-03');
assert.equal(months[0].open_zar, 910);
assert.equal(months[1].paid_zar, 910);

console.log('member-profile.test.ts ok');
