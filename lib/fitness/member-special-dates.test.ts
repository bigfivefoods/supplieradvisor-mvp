/**
 * Run: npx --yes tsx lib/fitness/member-special-dates.test.ts
 */
import assert from 'node:assert/strict';
import {
  clientIdsForCoach,
  memberSpecialDates,
  memberSpecialDatesForStore,
  nextMonthDayOccurrence,
} from './member-special-dates';
import { emptyFitgraphStore } from './fitgraph';

assert.equal(nextMonthDayOccurrence('08-23', '2026-08-19'), '2026-08-23');
assert.equal(nextMonthDayOccurrence('08-19', '2026-08-19'), '2026-08-19');
assert.equal(nextMonthDayOccurrence('01-05', '2026-08-19'), '2027-01-05');
assert.equal(nextMonthDayOccurrence('02-29', '2026-08-19'), '2027-02-28');
assert.equal(nextMonthDayOccurrence('02-29', '2028-02-01'), '2028-02-29');

const people = [
  {
    id: 'c1',
    name: 'Ada',
    date_of_birth: '1986-08-23',
    start_date: '2023-08-20',
    coach_id: 'coh_1',
    created_at: '2023-08-20T00:00:00.000Z',
  },
  {
    id: 'c2',
    name: 'Bev',
    date_of_birth: '1990-08-19',
    start_date: '2026-08-17',
    coach_id: 'coh_2',
    created_at: '2026-08-17T00:00:00.000Z',
  },
  {
    id: 'c3',
    name: 'Cara',
    passport: { date_of_birth: '2000-08-25' },
    start_date: '2024-01-01',
    created_at: '2024-01-01T00:00:00.000Z',
  },
];

const rows = memberSpecialDates(people, { from: '2026-08-19', days: 14 });
const adaBday = rows.find((r) => r.client_id === 'c1' && r.kind === 'birthday')!;
assert.equal(adaBday.on, '2026-08-23');
assert.equal(adaBday.days_until, 4);
assert.equal(adaBday.years, 40);
assert.match(adaBday.label, /turns 40/);

const adaAnn = rows.find(
  (r) => r.client_id === 'c1' && r.kind === 'membership_anniversary'
)!;
assert.equal(adaAnn.on, '2026-08-20');
assert.equal(adaAnn.years, 3);

const bevBday = rows.find((r) => r.client_id === 'c2' && r.kind === 'birthday')!;
assert.equal(bevBday.days_until, 0);
assert.equal(bevBday.years, 36);

const bevJoin = rows.find((r) => r.client_id === 'c2' && r.kind === 'joined')!;
assert.equal(bevJoin.days_until, -2);

const cara = rows.find((r) => r.client_id === 'c3' && r.kind === 'birthday')!;
assert.equal(cara.on, '2026-08-25');

const coachOnly = memberSpecialDates(people, {
  from: '2026-08-19',
  days: 14,
  coachClientIds: ['c1'],
});
assert.equal(
  coachOnly.every((r) => r.client_id === 'c1'),
  true
);

const store = emptyFitgraphStore();
store.clients.push(
  {
    id: 'c1',
    code: 'A',
    name: 'Ada',
    date_of_birth: '1986-08-23',
    start_date: '2023-08-20',
    coach_id: 'coh_1',
    active: true,
    created_at: '2023-08-20T00:00:00.000Z',
    updated_at: '2023-08-20T00:00:00.000Z',
  },
  {
    id: 'c9',
    code: 'Z',
    name: 'Zed',
    date_of_birth: '1999-08-19',
    coach_id: null,
    active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  }
);
store.sessions.push({
  id: 'ses_1',
  class_type_id: 'ct',
  coach_id: 'coh_1',
  date: '2026-08-18',
  start_time: '06:00',
  status: 'scheduled',
  created_at: '2026-08-01T00:00:00.000Z',
});
store.bookings.push({
  id: 'bkg_1',
  session_id: 'ses_1',
  client_id: 'c9',
  status: 'booked',
  booked_at: '2026-08-01T00:00:00.000Z',
});
const ids = clientIdsForCoach(store, 'coh_1');
assert.equal(ids.has('c1'), true);
assert.equal(ids.has('c9'), true);
const forCoach = memberSpecialDatesForStore(store, {
  from: '2026-08-19',
  days: 14,
  coachId: 'coh_1',
});
assert.ok(forCoach.some((r) => r.client_id === 'c1'));
assert.ok(forCoach.some((r) => r.client_id === 'c9' && r.kind === 'birthday'));

console.log('member-special-dates.test.ts ok');
