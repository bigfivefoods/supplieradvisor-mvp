/**
 * Run: npx --yes tsx lib/fitness/class-allocate.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore } from './fitgraph';
import {
  applyChargedNote,
  allocateMemberToClass,
  calendarCoverage,
  classRosterPeople,
  formatScheduleLabel,
  parseBilledZar,
  parseScheduleHint,
  resolveAllocatedCharge,
  scheduleClassOnCalendar,
  bookDeskMemberOntoSession,
  sessionRosterNames,
  sessionRosterRows,
  setClassMembers,
  stampCatalogSeriesAndBookSubscribers,
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
assert.equal(
  sessionRosterNames(store, scheduled.sessions[0].id).includes('Ada'),
  false
);

const multi = allocateMemberToClass(store, {
  clientId: 'cli_ada',
  planIds: [fsf.id, boot.id],
  chargedZar: 775,
  now: '2026-08-17T10:00:00.000Z',
});
if ('error' in multi) throw new Error(multi.error);
assert.equal(
  store.subscriptions.filter(
    (s) =>
      s.client_id === 'cli_ada' &&
      (s.status === 'active' || s.status === 'trialing')
  ).length,
  2
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

assert.equal(
  resolveAllocatedCharge(fsf, { planIds: [fsf.id], chargedZar: 775 }),
  775
);
assert.equal(
  resolveAllocatedCharge(boot, {
    planIds: [fsf.id, boot.id],
    chargedZar: 775,
  }),
  Number(boot.price_zar)
);
assert.equal(
  resolveAllocatedCharge(boot, {
    planIds: [fsf.id, boot.id],
    chargesByPlanId: { [boot.id]: 400 },
  }),
  400
);

const perClass = allocateMemberToClass(store, {
  clientId: 'cli_bev',
  member: true,
  privateClient: true,
  planIds: [fsf.id, boot.id],
  chargesByPlanId: { [fsf.id]: 800, [boot.id]: 400 },
  coachId: 'coh_pat',
  privateRateZar: 900,
  person: {
    name: 'Beverly',
    email: 'bev@test.com',
    phone: '0821110000',
    notes: 'Sibling rate',
  },
  now: '2026-08-17T10:00:00.000Z',
});
if ('error' in perClass) throw new Error(perClass.error);
const bevSaved = store.clients.find((c) => c.id === 'cli_bev')!;
assert.equal(bevSaved.name, 'Beverly');
assert.equal(bevSaved.email, 'bev@test.com');
assert.equal(bevSaved.phone, '0821110000');
assert.match(String(bevSaved.notes), /Sibling rate/);
assert.equal(bevSaved.private_rate_zar, 900);
assert.equal(bevSaved.agreed_rate_zar, 1200);
assert.equal(
  store.subscriptions.find(
    (s) => s.client_id === 'cli_bev' && s.plan_id === fsf.id
  )?.charged_zar,
  800
);
assert.equal(
  store.subscriptions.find(
    (s) => s.client_id === 'cli_bev' && s.plan_id === boot.id
  )?.charged_zar,
  400
);

const parkedByFlags = allocateMemberToClass(store, {
  clientId: 'cli_ada',
  member: false,
  privateClient: false,
  now: '2026-08-20T09:00:00.000Z',
});
if ('error' in parkedByFlags) throw new Error(parkedByFlags.error);
const adaOff = store.clients.find((c) => c.id === 'cli_ada')!;
assert.equal(adaOff.active, false);
assert.equal(adaOff.membership_status, 'cancelled');

const parked = allocateMemberToClass(store, {
  clientId: 'cli_bev',
  inactive: true,
  person: { name: 'Beverly', notes: 'Taking a break' },
  now: '2026-08-20T10:00:00.000Z',
});
if ('error' in parked) throw new Error(parked.error);
const bevOff = store.clients.find((c) => c.id === 'cli_bev')!;
assert.equal(bevOff.active, false);
assert.equal(bevOff.membership_status, 'cancelled');
assert.equal(bevOff.membership_plan_id, null);
assert.equal(bevOff.notes, 'Taking a break');
assert.equal(
  store.subscriptions.some(
    (s) =>
      s.client_id === 'cli_bev' &&
      (s.status === 'active' || s.status === 'trialing')
  ),
  false
);

const revived = allocateMemberToClass(store, {
  clientId: 'cli_bev',
  member: true,
  planId: boot.id,
  chargedZar: 475,
  now: '2026-08-20T11:00:00.000Z',
});
if ('error' in revived) throw new Error(revived.error);
const bevOn = store.clients.find((c) => c.id === 'cli_bev')!;
assert.equal(bevOn.active, true);
assert.equal(bevOn.membership_status, 'active');
assert.equal(bevOn.membership_plan_id, boot.id);

const diary = emptyFitgraphStore();
ensureVukaClassCatalog(diary, {
  companyId: VUKA_COMPANY_ID,
  now: '2026-08-17T10:00:00.000Z',
});
const diaryFsf = diary.membership_plans.find((p) => p.code === 'VUKA_FSF_5AM')!;
const diaryKb = diary.membership_plans.find((p) => p.code === 'VUKA_KB_1630')!;
diary.clients.push({
  id: 'cli_cam',
  code: 'C1',
  name: 'Cam',
  membership_status: 'active',
  active: true,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
});
diary.sessions.push({
  id: 'ses_owner_fsf',
  class_type_id: 'vuka_cls_fsf',
  series_id: 'ser_random_owner',
  date: '2026-08-24',
  start_time: '05:00',
  status: 'scheduled',
  created_at: '2026-08-17T00:00:00.000Z',
});
diary.sessions.push({
  id: 'ses_owner_kb',
  class_type_id: 'vuka_cls_kb',
  series_id: 'ser_random_kb',
  date: '2026-08-24',
  start_time: '16:30',
  status: 'scheduled',
  created_at: '2026-08-17T00:00:00.000Z',
});
const camOn = allocateMemberToClass(diary, {
  clientId: 'cli_cam',
  planId: diaryFsf.id,
  now: '2026-08-17T10:00:00.000Z',
});
if ('error' in camOn) throw new Error(camOn.error);
assert.ok(camOn.booked >= 1);
assert.ok(sessionRosterNames(diary, 'ses_owner_fsf').includes('Cam'));
assert.equal(sessionRosterNames(diary, 'ses_owner_kb').includes('Cam'), false);
assert.equal(diary.sessions[0].series_id, 'ser_random_owner');

diary.clients.push({
  id: 'cli_dot',
  code: 'D1',
  name: 'Dot',
  membership_status: 'active',
  active: true,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
});
const dotOn = allocateMemberToClass(diary, {
  clientId: 'cli_dot',
  planId: diaryKb.id,
  bookUpcoming: false,
  now: '2026-08-17T10:00:00.000Z',
});
if ('error' in dotOn) throw new Error(dotOn.error);
assert.equal(dotOn.booked, 0);
assert.ok(sessionRosterNames(diary, 'ses_owner_kb').includes('Dot'));
const stamped = stampCatalogSeriesAndBookSubscribers(
  diary,
  [diary.sessions[0], diary.sessions[1]],
  '2026-08-17T10:00:00.000Z'
);
assert.equal(diary.sessions[0].series_id, 'vuka_ser_fsf_5am');
assert.equal(diary.sessions[1].series_id, 'vuka_ser_kb_1630');
assert.ok(stamped >= 1);
assert.ok(
  diary.bookings.some(
    (b) =>
      b.client_id === 'cli_dot' &&
      b.session_id === 'ses_owner_kb' &&
      b.status !== 'cancelled'
  )
);

const seatStore = emptyFitgraphStore();
seatStore.sessions.push({
  id: 's-seat',
  class_type_id: 'ct1',
  date: '2026-08-25',
  start_time: '06:00',
  status: 'scheduled',
  created_at: '2026-08-01T00:00:00Z',
} as never);
seatStore.clients.push({
  id: 'c-seat',
  code: 'S1',
  name: 'Seat',
  active: true,
  membership_status: 'active',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
});
const firstSeat = bookDeskMemberOntoSession(
  seatStore,
  seatStore.sessions[0],
  seatStore.clients[0],
  '2026-08-25T06:00:00Z',
  { force: true }
);
assert.equal(firstSeat, 'booked');
const secondSeat = bookDeskMemberOntoSession(
  seatStore,
  seatStore.sessions[0],
  seatStore.clients[0],
  '2026-08-25T06:01:00Z',
  { force: true }
);
assert.equal(secondSeat, 'skipped');
assert.equal(
  seatStore.bookings.filter(
    (b) => b.session_id === 's-seat' && b.client_id === 'c-seat'
  ).length,
  1
);
assert.equal(sessionRosterRows(seatStore, 's-seat').length, 1);

// ── setClassMembers (Brief 34): this class only, denorm, diary ────────────
const roster = emptyFitgraphStore();
ensureVukaClassCatalog(roster, {
  companyId: VUKA_COMPANY_ID,
  now: '2026-08-17T10:00:00.000Z',
});
const rFsf = roster.membership_plans.find((p) => p.code === 'VUKA_FSF_5AM')!;
const rBoot = roster.membership_plans.find((p) => p.code === 'VUKA_BOOT_1730')!;
roster.clients.push({
  id: 'cli_eve',
  code: 'E1',
  name: 'Eve',
  membership_status: 'active',
  active: true,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
});
roster.clients.push({
  id: 'cli_zed',
  code: 'Z1',
  name: 'Zed Inactive',
  membership_status: 'cancelled',
  active: false,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
});
for (let i = 0; i < 90; i += 1) {
  roster.clients.push({
    id: `cli_cap_${i}`,
    code: `CAP${i}`,
    name: i === 85 ? 'Zelda Cap' : `Cap Person ${i}`,
    email: i === 85 ? 'zelda@gym.test' : `cap${i}@gym.test`,
    phone: i === 85 ? '0820000085' : `0820000${String(i).padStart(3, '0')}`,
    membership_status: 'active',
    active: true,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  });
}
assert.ok(classRosterPeople(roster, 'Zelda Cap').some((c) => c.id === 'cli_cap_85'));
assert.ok(classRosterPeople(roster, 'zelda@gym.test').some((c) => c.id === 'cli_cap_85'));
assert.ok(classRosterPeople(roster, '0820000085').some((c) => c.id === 'cli_cap_85'));
assert.ok(classRosterPeople(roster).length > 80);
assert.equal(
  classRosterPeople(roster).some((c) => c.id === 'cli_zed'),
  false
);

const fsfCal = scheduleClassOnCalendar(roster, {
  planId: rFsf.id,
  date: '2026-08-17',
  start_time: '05:00',
  end_time: '06:00',
  recurrence: {
    frequency: 'weekly',
    interval: 1,
    weekdays: [1, 3, 5],
    count: 4,
  },
  now: '2026-08-17T10:00:00.000Z',
});
if ('error' in fsfCal) throw new Error(fsfCal.error);
const bootCal = scheduleClassOnCalendar(roster, {
  planId: rBoot.id,
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
if ('error' in bootCal) throw new Error(bootCal.error);

const eveBoth = allocateMemberToClass(roster, {
  clientId: 'cli_eve',
  planIds: [rFsf.id, rBoot.id],
  chargesByPlanId: { [rFsf.id]: 800, [rBoot.id]: 400 },
  now: '2026-08-17T10:00:00.000Z',
});
if ('error' in eveBoth) throw new Error(eveBoth.error);
const eveLive = roster.subscriptions.filter(
  (s) =>
    s.client_id === 'cli_eve' &&
    (s.status === 'active' || s.status === 'trialing')
);
assert.equal(eveLive.length, 2);
assert.ok(sessionRosterNames(roster, fsfCal.sessions[0].id).includes('Eve'));
assert.ok(sessionRosterNames(roster, bootCal.sessions[0].id).includes('Eve'));
const eveRow = roster.clients.find((c) => c.id === 'cli_eve')!;
assert.equal(eveRow.agreed_rate_zar, 1200);
assert.equal(eveRow.membership_plan_id, rFsf.id);

const dropFsf = setClassMembers(roster, {
  planId: rFsf.id,
  clientIds: [],
  now: '2026-08-18T09:00:00.000Z',
});
if ('error' in dropFsf) throw new Error(dropFsf.error);
assert.equal(dropFsf.dropped, 1);
assert.equal(
  roster.subscriptions.find(
    (s) => s.client_id === 'cli_eve' && s.plan_id === rFsf.id
  )?.status,
  'cancelled'
);
const bootSub = roster.subscriptions.find(
  (s) => s.client_id === 'cli_eve' && s.plan_id === rBoot.id
);
assert.equal(bootSub?.status, 'active');
assert.equal(bootSub?.charged_zar, 400);
const eveAfter = roster.clients.find((c) => c.id === 'cli_eve')!;
assert.equal(eveAfter.membership_plan_id, rBoot.id);
assert.equal(eveAfter.agreed_rate_zar, 400);
assert.equal(eveAfter.active, true);
assert.ok(roster.clients.some((c) => c.id === 'cli_eve'));
const futureFsf = fsfCal.sessions.find((s) => s.date >= '2026-08-18');
const futureBoot = bootCal.sessions.find((s) => s.date >= '2026-08-18');
if (!futureFsf || !futureBoot) throw new Error('expected future class dates');
assert.equal(
  sessionRosterNames(roster, futureFsf.id).includes('Eve'),
  false
);
assert.ok(sessionRosterNames(roster, futureBoot.id).includes('Eve'));
assert.equal(
  roster.bookings.some(
    (b) =>
      b.client_id === 'cli_eve' &&
      b.session_id === futureFsf.id &&
      b.status !== 'cancelled' &&
      b.status !== 'attended' &&
      b.status !== 'no_show'
  ),
  false
);
assert.ok(
  roster.bookings.some(
    (b) =>
      b.client_id === 'cli_eve' &&
      b.session_id === futureBoot.id &&
      b.status !== 'cancelled'
  )
);

const skipInactive = setClassMembers(roster, {
  planId: rFsf.id,
  clientIds: ['cli_zed', 'cli_eve'],
  now: '2026-08-18T10:00:00.000Z',
});
if ('error' in skipInactive) throw new Error(skipInactive.error);
assert.equal(
  roster.subscriptions.some(
    (s) =>
      s.client_id === 'cli_zed' &&
      s.plan_id === rFsf.id &&
      (s.status === 'active' || s.status === 'trialing')
  ),
  false
);
assert.equal(
  roster.subscriptions.find(
    (s) => s.client_id === 'cli_eve' && s.plan_id === rFsf.id
  )?.status,
  'active'
);
assert.equal(
  roster.subscriptions.find(
    (s) => s.client_id === 'cli_eve' && s.plan_id === rBoot.id
  )?.status,
  'active'
);
assert.equal(
  roster.subscriptions.find(
    (s) => s.client_id === 'cli_eve' && s.plan_id === rFsf.id
  )?.charged_zar,
  800
);

const parkEve = allocateMemberToClass(roster, {
  clientId: 'cli_eve',
  inactive: true,
  now: '2026-08-20T10:00:00.000Z',
});
if ('error' in parkEve) throw new Error(parkEve.error);
assert.ok(roster.clients.some((c) => c.id === 'cli_eve'));
const eveParked = roster.clients.find((c) => c.id === 'cli_eve')!;
assert.equal(eveParked.active, false);
assert.equal(eveParked.membership_status, 'cancelled');
assert.equal(eveParked.membership_plan_id, null);
assert.equal(
  roster.subscriptions.some(
    (s) =>
      s.client_id === 'cli_eve' &&
      (s.status === 'active' || s.status === 'trialing')
  ),
  false
);
assert.equal(
  roster.bookings.some(
    (b) =>
      b.client_id === 'cli_eve' &&
      b.status !== 'cancelled' &&
      b.status !== 'attended' &&
      b.status !== 'no_show' &&
      (roster.sessions.find((s) => s.id === b.session_id)?.date || '') >=
        '2026-08-20'
  ),
  false
);
const afterPark = setClassMembers(roster, {
  planId: rBoot.id,
  clientIds: ['cli_eve'],
  now: '2026-08-20T11:00:00.000Z',
});
if ('error' in afterPark) throw new Error(afterPark.error);
assert.equal(afterPark.members, 0);
assert.equal(
  roster.subscriptions.some(
    (s) =>
      s.client_id === 'cli_eve' &&
      (s.status === 'active' || s.status === 'trialing')
  ),
  false
);

console.log('class-allocate.test.ts ok');
