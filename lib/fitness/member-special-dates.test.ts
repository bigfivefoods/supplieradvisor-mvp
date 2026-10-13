/**
 * Run: npx --yes tsx lib/fitness/member-special-dates.test.ts
 */
import assert from 'node:assert/strict';
import {
  clientIdsForCoach,
  memberSpecialDates,
  memberSpecialDatesForStore,
  missingBirthdayCount,
  nextMonthDayOccurrence,
  specialDateToday,
  specialDateWindowDays,
  specialDatesCsv,
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
assert.match(adaAnn.label, /Gym anniversary/);

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

const practice = memberSpecialDates(
  [
    {
      id: 'p1',
      name: 'Nia',
      medical: { date_of_birth: '1992-10-20' },
      start_date: '2024-10-20',
      created_at: '2024-10-20T00:00:00.000Z',
      coach_id: 'dr_1',
      family: [
        {
          id: 'fam_leo',
          name: 'Leo',
          relationship: 'child',
          date_of_birth: '2018-10-18',
          active: true,
        },
        {
          id: 'fam_blank',
          name: '   ',
          relationship: 'child',
          date_of_birth: '2016-01-01',
          active: true,
        },
      ],
    },
    {
      id: 'p2',
      name: 'Omar',
      active: false,
      medical: { date_of_birth: '1980-10-15' },
      start_date: '2020-01-01',
      family: [
        {
          id: 'fam_inactive_parent',
          name: 'Ivy',
          relationship: 'child',
          date_of_birth: '2015-10-16',
        },
      ],
    },
    {
      id: 'p3',
      name: 'No date',
      start_date: '2020-01-01',
      family: [
        {
          id: 'fam_nodob',
          name: 'Sam',
          relationship: 'spouse',
        },
      ],
    },
  ],
  {
    from: '2026-10-13',
    days: 30,
    place: 'practice',
    includeHousehold: true,
    kinds: ['birthday', 'membership_anniversary'],
  }
);

const niaBday = practice.find((r) => r.id.startsWith('bday-p1-'))!;
assert.equal(niaBday.on, '2026-10-20');
assert.equal(niaBday.years, 34);
assert.equal(niaBday.client_id, 'p1');

const niaAnn = practice.find((r) => r.kind === 'membership_anniversary')!;
assert.equal(niaAnn.on, '2026-10-20');
assert.equal(niaAnn.years, 2);
assert.match(niaAnn.label, /Patient anniversary/);
assert.equal(/Gym anniversary/.test(niaAnn.label), false);

const leo = practice.find((r) => r.name.startsWith('Leo'))!;
assert.equal(leo.on, '2026-10-18');
assert.equal(leo.years, 8);
assert.equal(leo.client_id, 'p1');
assert.equal(leo.household, true);
assert.equal(leo.coach_id, 'dr_1');
assert.equal(
  practice.some((r) => r.kind === 'membership_anniversary' && r.household),
  false
);
assert.equal(practice.some((r) => r.name.includes('Ivy')), false);
assert.equal(practice.some((r) => r.client_id === 'p2'), false);
assert.equal(practice.some((r) => r.kind === 'joined'), false);

const firstYear = memberSpecialDates(
  [
    {
      id: 'p4',
      name: 'First year',
      start_date: '2025-10-20',
      date_of_birth: '1990-01-01',
    },
  ],
  { from: '2026-10-13', days: 30, place: 'practice' }
);
const firstAnn = firstYear.find((r) => r.kind === 'membership_anniversary')!;
assert.equal(firstAnn.on, '2026-10-20');
assert.equal(firstAnn.years, 1);
assert.equal(firstAnn.days_until, 7);

const missing = missingBirthdayCount([
  {
    id: 'p1',
    name: 'Nia',
    medical: { date_of_birth: '1992-10-20' },
    family: [
      { id: 'fam_nodob', name: 'Sam', relationship: 'spouse' },
      { id: 'fam_leo', name: 'Leo', date_of_birth: '2018-10-18' },
    ],
  },
  { id: 'p3', name: 'No date' },
  { id: 'gone', name: 'Gone', active: false },
]);
assert.equal(missing.people, 1);
assert.equal(missing.household, 1);

assert.equal(specialDateWindowDays('14', '2026-10-13'), 14);
assert.equal(specialDateWindowDays('month', '2026-10-13'), 18);
assert.equal(specialDateWindowDays('month', '2026-10-31'), 0);
assert.equal(specialDateWindowDays('month', '2026-02-01'), 27);
assert.equal(specialDateWindowDays('year', '2026-10-13'), 366);
assert.equal(
  specialDateToday(new Date('2026-10-13T22:30:00.000Z')),
  '2026-10-14'
);
assert.equal(
  specialDateToday(new Date('2026-10-13T21:30:00.000Z')),
  '2026-10-13'
);

const coachHousehold = memberSpecialDates(
  [
    {
      id: 'c1',
      name: 'Ada',
      date_of_birth: '1986-10-20',
      coach_id: 'coh_1',
      family: [
        {
          id: 'fam_leo',
          name: 'Leo, Jr',
          relationship: 'child',
          date_of_birth: '2018-10-18',
        },
      ],
    },
  ],
  {
    from: '2026-10-13',
    days: 14,
    coachClientIds: ['c1'],
    includeHousehold: true,
    kinds: ['birthday'],
  }
);
assert.equal(coachHousehold.length, 2);
assert.equal(coachHousehold.every((r) => r.client_id === 'c1'), true);

const csv = specialDatesCsv(coachHousehold, {
  assigneeHeader: 'Coach',
  assigneeNames: { coh_1: 'Asha' },
});
assert.match(csv, /"Leo, Jr · Child of Ada"/);
assert.match(csv, /Asha/);
assert.match(csv, /Birthday/);

console.log('member-special-dates.test.ts ok');
