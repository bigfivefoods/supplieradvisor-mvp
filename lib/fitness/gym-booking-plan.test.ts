/**
 * Gym Bookings call-in plan: today / week working days / planned members.
 * Run: npx --yes tsx lib/fitness/gym-booking-plan.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defaultWorkingHours } from '../schedule/working-hours';
import { emptyFitgraphStore } from './fitgraph';
import { SYS_PT_CODE } from './session-times';
import {
  gymPlanClassesOnDate,
  gymPlanDateLabel,
  gymPlanMonday,
  gymPlanWeek,
} from './gym-booking-plan';

assert.equal(gymPlanMonday('2026-09-02'), '2026-08-31');
assert.equal(gymPlanDateLabel('2026-08-31'), '31 Aug');
assert.equal(gymPlanDateLabel('2026-09-02'), '2 Sep');

const store = emptyFitgraphStore();
store.class_types.push(
  {
    id: 'cls_boot',
    code: 'BOOT',
    name: 'Bootcamp',
    capacity: 16,
    created_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'cls_pt',
    code: SYS_PT_CODE,
    name: 'Private PT',
    created_at: '2026-08-01T00:00:00.000Z',
  }
);
store.coaches.push({
  id: 'coh_pat',
  code: 'PAT',
  name: 'Pat',
  specialties: [],
  active: true,
  created_at: '2026-08-01T00:00:00.000Z',
});
store.clients.push(
  {
    id: 'cli_ada',
    code: 'A1',
    name: 'Ada',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'cli_ben',
    code: 'B1',
    name: 'Ben',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  }
);
store.sessions.push(
  {
    id: 'ses_mon',
    class_type_id: 'cls_boot',
    coach_id: 'coh_pat',
    date: '2026-08-31',
    start_time: '06:00',
    status: 'scheduled',
    capacity: 16,
    created_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'ses_wed',
    class_type_id: 'cls_boot',
    coach_id: 'coh_pat',
    date: '2026-09-02',
    start_time: '17:30',
    status: 'scheduled',
    created_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'ses_sun',
    class_type_id: 'cls_boot',
    coach_id: 'coh_pat',
    date: '2026-09-06',
    start_time: '09:00',
    status: 'scheduled',
    created_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'ses_pt',
    class_type_id: 'cls_pt',
    coach_id: 'coh_pat',
    date: '2026-09-02',
    start_time: '12:00',
    status: 'scheduled',
    session_kind: 'private_pt',
    created_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'ses_away',
    class_type_id: 'cls_boot',
    coach_id: 'coh_pat',
    date: '2026-09-02',
    start_time: '08:00',
    status: 'scheduled',
    session_kind: 'away',
    created_at: '2026-08-01T00:00:00.000Z',
  }
);
store.bookings.push({
  id: 'bkg_ada',
  session_id: 'ses_wed',
  client_id: 'cli_ada',
  status: 'booked',
  booked_at: '2026-08-30T00:00:00.000Z',
});
store.bookings.push({
  id: 'bkg_ben',
  session_id: 'ses_pt',
  client_id: 'cli_ben',
  status: 'booked',
  booked_at: '2026-08-30T00:00:00.000Z',
});

const today = gymPlanClassesOnDate(store, '2026-09-02');
assert.deepEqual(
  today.map((c) => `${c.session.start_time} ${c.className}`),
  ['12:00 Private PT', '17:30 Bootcamp']
);
assert.equal(today[0].coachName, 'Pat');
assert.equal(today[1].coachName, 'Pat');
assert.deepEqual(
  today[0].members.map((m) => m.name),
  ['Ben']
);
assert.deepEqual(
  today[1].members.map((m) => m.name),
  ['Ada']
);

const week = gymPlanWeek(store, defaultWorkingHours(), '2026-09-02');
assert.deepEqual(
  week.map((d) => `${d.short} ${d.date}`),
  [
    'Mon 2026-08-31',
    'Tue 2026-09-01',
    'Wed 2026-09-02',
    'Thu 2026-09-03',
    'Fri 2026-09-04',
    'Sat 2026-09-05',
    'Sun 2026-09-06',
  ]
);
assert.equal(week[0].hoursLabel, '08:00–17:00');
assert.equal(week[5].hoursLabel, '08:00–13:00');
assert.equal(week[6].hoursLabel, 'Closed');
assert.equal(week[6].closed, true);
assert.equal(week[0].classes[0]?.className, 'Bootcamp');
assert.equal(week[2].classes.length, 2);

const closedSat = defaultWorkingHours();
closedSat.days = { ...(closedSat.days || {}), '6': { closed: true } };
const noSunClass = emptyFitgraphStore();
noSunClass.sessions.push({
  id: 'ses_tue',
  class_type_id: 'cls_boot',
  date: '2026-09-01',
  start_time: '07:00',
  status: 'scheduled',
  created_at: '2026-08-01T00:00:00.000Z',
});
noSunClass.class_types.push(store.class_types[0]);
const weekNoSun = gymPlanWeek(noSunClass, closedSat, '2026-08-31');
assert.deepEqual(
  weekNoSun.map((d) => d.short),
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
);

const page = readFileSync(
  resolve('app/dashboard/fitgraph/bookings/page.tsx'),
  'utf8'
);
assert.match(page, /title="Plan"/);
assert.match(page, /This week/);
assert.match(page, /Custom/);
assert.match(page, /classes and private PT/);
assert.match(page, /gymPlanWeek/);
assert.match(page, /<GymBookingPlanBoard\s+days=/);
assert.match(page, /type="date"/);

const nav = readFileSync(resolve('lib/chrome/module-nav.ts'), 'utf8');
assert.match(nav, /name: 'Plan', href: '\/dashboard\/fitgraph\/bookings'/);
assert.match(nav, /name: 'Bookings', href: '\/dashboard\/physiograph\/bookings'/);

const board = readFileSync(
  resolve('components/fitness/GymBookingPlanBoard.tsx'),
  'utf8'
);
assert.equal(today[0].className, 'Private PT');
assert.equal(today[0].coachName, 'Pat');
assert.deepEqual(today[0].members.map((m) => m.name), ['Ben']);
assert.match(board, /Members planned/);
assert.match(board, /Coach/);
assert.match(board, /aria-expanded/);
assert.match(board, /Coach · \$\{card\.coachName\}/);
assert.match(board, /Members planned · \$\{card\.members\.length\}/);
assert.match(board, /day\.classes\.map\(\(card\) => \(\s*<PlanClassCard/s);

console.log('gym-booking-plan.test.ts ok');
