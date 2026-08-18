/**
 * Run: npx --yes tsx lib/fitness/class-allocate.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore } from './fitgraph';
import {
  applyChargedNote,
  allocateMemberToClass,
  calendarCoverage,
  formatScheduleLabel,
  parseBilledZar,
  parseScheduleHint,
  scheduleClassOnCalendar,
  sessionRosterNames,
  suggestClassSchedule,
  updateClassDesk,
} from './class-allocate';
import {
  ensureVukaClassCatalog,
  VUKA_COMPANY_ID,
} from './vuka-class-catalog';

assert.equal(parseBilledZar('Roster import · R770.50/pm'), 770.5);
assert.equal(parseBilledZar('Charged R910.00/pm'), 910);
assert.equal(parseBilledZar('no amount'), null);
assert.equal(
  applyChargedNote('Roster import · R770.50/pm', 775),
  'Roster import · R775.00/pm'
);
assert.equal(
  formatScheduleLabel('05:00', {
    frequency: 'weekly',
    weekdays: [1, 3, 5],
  }),
  '5:00am Mon / Wed / Fri'
);
const hint = parseScheduleHint('5:00am Mon / Wed / Fri');
assert.equal(hint.start_time, '05:00');
assert.deepEqual(hint.weekdays.sort(), [1, 3, 5]);

const store = emptyFitgraphStore();
ensureVukaClassCatalog(store, {
  companyId: VUKA_COMPANY_ID,
  now: '2026-08-17T10:00:00.000Z',
});
const fsf = store.membership_plans.find((p) => p.code === 'VUKA_FSF_5AM')!;
const boot = store.membership_plans.find((p) => p.code === 'VUKA_BOOT_1730')!;
const unlim = store.membership_plans.find((p) => p.code === 'VUKA_UNLIM')!;
const pilates1 = store.membership_plans.find((p) => p.code === 'VUKA_PILATES_1')!;

store.clients.push({
  id: 'cli_ada',
  code: 'A1',
  name: 'Ada',
  notes: 'Roster import · R770.50/pm',
  membership_status: 'active',
  active: true,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
});
store.clients.push({
  id: 'cli_bev',
  code: 'B1',
  name: 'Bev',
  membership_status: 'active',
  active: true,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
});

const suggested = suggestClassSchedule(store, fsf);
assert.equal(suggested.start_time, '05:00');
assert.deepEqual(suggested.weekdays.sort(), [1, 3, 5]);
assert.equal(suggested.frequency, 'weekly');

const scheduled = scheduleClassOnCalendar(store, {
  planId: fsf.id,
  date: '2026-08-17',
  start_time: '05:00',
  end_time: '06:00',
  recurrence: {
    frequency: 'weekly',
    interval: 1,
    weekdays: [1, 3, 5],
    count: 6,
  },
  now: '2026-08-17T10:00:00.000Z',
});
if ('error' in scheduled) throw new Error(scheduled.error);
assert.equal(scheduled.sessions.length, 6);
assert.equal(scheduled.sessions[0].series_id, 'vuka_ser_fsf_5am');
assert.ok(fsf.series_ids?.includes('vuka_ser_fsf_5am'));
assert.deepEqual(
  calendarCoverage(store, fsf, '2026-08-17').coachNames,
  []
);
store.coaches.push({
  id: 'coh_pat',
  code: 'PAT',
  name: 'Pat Coach',
  specialties: [],
  active: true,
  created_at: '2026-08-01T00:00:00.000Z',
});
for (const s of scheduled.sessions) s.coach_id = 'coh_pat';
assert.deepEqual(
  calendarCoverage(store, fsf, '2026-08-17').coachNames,
  ['Pat Coach']
);
const desk = updateClassDesk(store, {
  planId: fsf.id,
  patch: { price_zar: 920, name: 'FSF 5am' },
  coachId: 'coh_pat',
  fromDate: '2026-08-17',
  now: '2026-08-17T10:00:00.000Z',
});
if ('error' in desk) throw new Error(desk.error);
assert.equal(fsf.price_zar, 920);
assert.equal(fsf.name, 'FSF 5am');
assert.equal(fsf.default_coach_id, 'coh_pat');
assert.equal(scheduled.sessions[0].coach_id, 'coh_pat');

const allocated = allocateMemberToClass(store, {
  clientId: 'cli_ada',
  planId: fsf.id,
  chargedZar: 775,
  now: '2026-08-17T10:00:00.000Z',
});
if ('error' in allocated) throw new Error(allocated.error);
assert.equal(allocated.subscription?.charged_zar, 775);
assert.equal(store.clients[0].agreed_rate_zar, 775);
assert.equal(allocated.booked, 6);
assert.match(String(store.clients[0].notes), /R775\.00\/pm/);
assert.ok(sessionRosterNames(store, scheduled.sessions[0].id).includes('Ada'));

const switched = allocateMemberToClass(store, {
  clientId: 'cli_ada',
  planId: boot.id,
  chargedZar: 475,
  now: '2026-08-17T10:00:00.000Z',
});
if ('error' in switched) throw new Error(switched.error);
assert.equal(switched.cancelled, 1);
assert.equal(
  store.subscriptions.find((s) => s.plan_id === fsf.id)?.status,
  'cancelled'
);

store.subscriptions.push({
  id: 'sub_bev_fsf',
  client_id: 'cli_bev',
  plan_id: fsf.id,
  status: 'active',
  started_at: '2026-08-01',
  charged_zar: 910,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
});
const more = scheduleClassOnCalendar(store, {
  planId: fsf.id,
  date: '2026-08-17',
  start_time: '05:00',
  end_time: '06:00',
  recurrence: {
    frequency: 'weekly',
    interval: 1,
    weekdays: [1, 3, 5],
    count: 6,
  },
  now: '2026-08-17T10:00:00.000Z',
});
assert.ok('error' in more);

store.clients.push({
  id: 'cli_pil',
  code: 'P1',
  name: 'Pip',
  membership_status: 'active',
  active: true,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
});
const pilAlloc = allocateMemberToClass(store, {
  clientId: 'cli_pil',
  planId: pilates1.id,
  chargedZar: 475,
  now: '2026-08-17T10:00:00.000Z',
});
if ('error' in pilAlloc) throw new Error(pilAlloc.error);
const pilSched = scheduleClassOnCalendar(store, {
  planId: pilates1.id,
  date: '2026-08-17',
  start_time: '17:30',
  end_time: '18:15',
  recurrence: {
    frequency: 'weekly',
    interval: 1,
    weekdays: [1, 2],
    count: 4,
  },
  now: '2026-08-17T10:00:00.000Z',
});
if ('error' in pilSched) throw new Error(pilSched.error);
assert.equal(pilSched.sessions.length, 4);
assert.equal(pilSched.booked, 2);

const blocked = scheduleClassOnCalendar(store, {
  planId: unlim.id,
  date: '2026-08-17',
  start_time: '06:00',
});
assert.ok('error' in blocked);

const bootSched = scheduleClassOnCalendar(store, {
  planId: boot.id,
  date: '2026-08-17',
  start_time: '17:30',
  end_time: '18:30',
  recurrence: {
    frequency: 'weekly',
    interval: 1,
    weekdays: [1, 2, 4],
    count: 3,
  },
  now: '2026-08-17T10:00:00.000Z',
});
if ('error' in bootSched) throw new Error(bootSched.error);
assert.ok(bootSched.booked >= 1);
assert.ok(
  sessionRosterNames(store, bootSched.sessions[0].id).includes('Ada')
);

const times = updateClassDesk(store, {
  planId: boot.id,
  sessionPatch: { start_time: '17:45', end_time: '18:45' },
  fromDate: '2026-08-17',
  now: '2026-08-17T10:00:00.000Z',
});
if ('error' in times) throw new Error(times.error);
assert.ok(times.sessionsUpdated >= 1);
assert.equal(bootSched.sessions[0].start_time, '17:45');

const privateOnly = allocateMemberToClass(store, {
  clientId: 'cli_bev',
  kind: 'private',
  coachId: 'coh_pat',
  chargedZar: 650,
  now: '2026-08-17T10:00:00.000Z',
});
if ('error' in privateOnly) throw new Error(privateOnly.error);
assert.equal(privateOnly.subscription, null);
const bev = store.clients.find((c) => c.id === 'cli_bev')!;
assert.equal(bev.private_client, true);
assert.equal(bev.coach_id, 'coh_pat');
assert.equal(bev.private_rate_zar, 650);

const missingCoach = allocateMemberToClass(store, {
  clientId: 'cli_bev',
  kind: 'private',
  now: '2026-08-17T10:00:00.000Z',
});
assert.ok('error' in missingCoach);

const both = allocateMemberToClass(store, {
  clientId: 'cli_ada',
  member: true,
  privateClient: true,
  planId: boot.id,
  coachId: 'coh_pat',
  chargedZar: 475,
  privateRateZar: 800,
  now: '2026-08-17T10:00:00.000Z',
});
if ('error' in both) throw new Error(both.error);
const ada = store.clients.find((c) => c.id === 'cli_ada')!;
assert.equal(ada.private_client, true);
assert.equal(ada.coach_id, 'coh_pat');
assert.equal(ada.private_rate_zar, 800);
assert.equal(ada.agreed_rate_zar, 475);
assert.equal(both.subscription?.plan_id, boot.id);
assert.equal(both.subscription?.charged_zar, 475);

console.log('class-allocate.test.ts ok');
