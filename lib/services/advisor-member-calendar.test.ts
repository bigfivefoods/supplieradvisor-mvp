/**
 * Run: npx --yes tsx lib/services/advisor-member-calendar.test.ts
 */
import assert from 'node:assert/strict';
import {
  bookAdvisorMemberSlot,
  generateAdvisorMemberSlots,
  parseVirtualSlotId,
  pushDeskNotice,
  newDeskNotice,
  toPortalOpenSlots,
  virtualSlotId,
  type ClinicMemberStore,
} from './advisor-member-calendar';
import { promoteWaitlistBooking } from './advisor-booking';

const hours = {
  default_open: '09:00',
  default_close: '11:00',
  days: {
    '1': { closed: false, open: '09:00', close: '11:00' },
    '2': { closed: false, open: '09:00', close: '11:00' },
    '3': { closed: false, open: '09:00', close: '11:00' },
    '4': { closed: false, open: '09:00', close: '11:00' },
    '5': { closed: false, open: '09:00', close: '11:00' },
    '6': { closed: true, open: '09:00', close: '11:00' },
    '0': { closed: true, open: '09:00', close: '11:00' },
  },
};

function monday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const store: ClinicMemberStore = {
  appointments: [],
  bookings: [],
  services: [
    { id: 'svc_1', name: 'Consult', default_duration_min: 60, active: true },
  ],
  practitioners: [{ id: 'pr_1', name: 'Dr Lane', active: true }],
  patients: [
    { id: 'pat_1', name: 'Sam', email: 'sam@example.com', desk_join_status: 'accepted' },
  ],
  desk_notices: [],
  settings: {
    allow_public_booking: true,
    share_member_calendar: true,
    generate_member_slots: true,
    member_slot_minutes: 60,
    working_hours: hours,
  },
};

const date = monday();
const slots = generateAdvisorMemberSlots(store, { from: date, to: date });
assert.ok(slots.length >= 2, 'expected generated hours');
assert.equal(slots[0].virtual, true);
assert.equal(slots[0].start_time, '09:00');
assert.equal(slots[0].end_time, '10:00');
assert.equal(slots[0].practitioner_name, 'Dr Lane');

const parsed = parseVirtualSlotId(slots[0].id);
assert.ok(parsed);
assert.equal(parsed?.date, date);
assert.equal(parsed?.start, '09:00');
assert.equal(virtualSlotId({ practitionerId: 'pr_1', date, start: '09:00' }), slots[0].id);

const blocked: ClinicMemberStore = {
  ...store,
  appointments: [
    {
      id: 'apt_busy',
      service_id: 'svc_1',
      date,
      start_time: '09:00',
      end_time: '10:00',
      duration_min: 60,
      status: 'scheduled',
      public: false,
      appointment_kind: 'personal',
      practitioner_id: 'pr_1',
    },
  ],
};
const afterBlock = generateAdvisorMemberSlots(blocked, { from: date, to: date });
assert.equal(
  afterBlock.some((s) => s.start_time === '09:00'),
  false,
  'personal time must hide the hour'
);

let n = 0;
const booked = bookAdvisorMemberSlot({
  store: {
    ...store,
    appointments: [],
    bookings: [],
    desk_notices: [],
  },
  module: 'psychiatrygraph',
  patientId: 'pat_1',
  slotId: slots[0].id,
  newId: (p) => `${p}_${++n}`,
  source: 'pwa',
});
assert.equal(booked.ok, true);
if (booked.ok) {
  assert.equal(booked.status, 'booked');
  assert.equal(booked.store.appointments.length, 1);
  assert.equal(booked.store.bookings.length, 1);
  assert.equal(booked.store.desk_notices?.[0]?.kind, 'booking_made');
  booked.store.patients.push({
    id: 'pat_2',
    name: 'Jo',
    desk_join_status: 'accepted',
  });
  const wait = bookAdvisorMemberSlot({
    store: booked.store,
    module: 'psychiatrygraph',
    patientId: 'pat_2',
    slotId: slots[0].id,
    newId: (p) => `${p}_${++n}`,
    source: 'pwa',
  });
  assert.equal(wait.ok, true);
  if (wait.ok) {
    assert.equal(wait.status, 'waitlist');
    assert.ok(
      wait.store.desk_notices?.some((n) => n.kind === 'booking_request')
    );
    const promoted = promoteWaitlistBooking(
      wait.store.bookings,
      wait.bookingId
    );
    assert.equal(promoted?.status, 'booked');
  }
}

const stackedBooked: ClinicMemberStore = {
  ...store,
  settings: { ...store.settings, generate_member_slots: false },
  appointments: [
    {
      id: 'apt_a',
      service_id: 'svc_1',
      date,
      start_time: '09:00',
      end_time: '10:00',
      duration_min: 60,
      status: 'scheduled',
      public: true,
      practitioner_id: 'pr_1',
    },
    {
      id: 'apt_b',
      service_id: 'svc_1',
      date,
      start_time: '09:00',
      end_time: '10:00',
      duration_min: 60,
      status: 'scheduled',
      public: true,
      practitioner_id: 'pr_2',
    },
  ],
  practitioners: [
    { id: 'pr_1', name: 'Dr Lane', active: true },
    { id: 'pr_2', name: 'Dr Kim', active: true },
  ],
  bookings: [
    {
      id: 'bk_a',
      appointment_id: 'apt_a',
      patient_id: 'pat_x',
      status: 'booked',
    },
    {
      id: 'bk_b',
      appointment_id: 'apt_b',
      patient_id: 'pat_y',
      status: 'booked',
    },
  ],
};
const portalSlots = toPortalOpenSlots(stackedBooked, {
  patientId: 'pat_1',
  from: date,
  to: date,
});
assert.equal(portalSlots.length, 1, 'booked clinicians collapse to one block');
assert.equal(portalSlots[0].service_name, 'Booked');
assert.equal(portalSlots[0].full, true);
assert.equal(portalSlots[0].clinician_name, null);

const closed = generateAdvisorMemberSlots({
  ...store,
  settings: { ...store.settings, share_member_calendar: false },
});
assert.equal(closed.length, 0);

const notices = pushDeskNotice(
  [],
  newDeskNotice({
    kind: 'member_joined',
    person_id: 'pat_1',
    person_name: 'Sam',
    source: 'pwa',
  })
);
assert.equal(notices.length, 1);
assert.equal(notices[0].status, 'new');

console.log('advisor-member-calendar.test.ts ok');
