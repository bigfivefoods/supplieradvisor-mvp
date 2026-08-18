/**
 * Run: npx --yes tsx lib/clinic/notify-follow-up.test.ts
 */
import assert from 'node:assert/strict';
import {
  advisorBellFollowUps,
  followUpNotifyCopy,
} from './notify-follow-up';
import { clinicBookFollowUpSlot } from './book-follow-up';

const copy = followUpNotifyCopy({
  module: 'medicalgraph',
  brand: 'Grove Practice',
  patientName: 'Ada',
  followUp: {
    title: 'Wound check',
    advice: 'How is the incision?',
    message: 'Reply on the app',
    remind_on: '2026-08-25',
  },
  mode: 'now',
});
assert.match(copy.memberBody, /incision/);
assert.match(copy.advisorBody, /Ada/);

const booked = followUpNotifyCopy({
  module: 'medicalgraph',
  brand: 'Grove Practice',
  patientName: 'Ada',
  followUp: {
    title: 'Follow-up',
    advice: 'Review bloods',
    message: null,
    remind_on: '2026-08-25',
  },
  mode: 'booked',
  appointmentWhen: '2026-08-25 09:00',
});
assert.match(booked.memberBody, /2026-08-25 09:00/);

const slot = clinicBookFollowUpSlot({
  appointments: [
    {
      id: 'a1',
      service_id: 'svc1',
      date: '2026-08-26',
      start_time: '09:00',
      status: 'scheduled',
    },
    {
      id: 'a2',
      service_id: 'svc_sys_personal',
      date: '2026-08-25',
      start_time: '08:00',
      status: 'scheduled',
      appointment_kind: 'personal',
    },
  ],
  bookings: [],
  patientId: 'p1',
  serviceId: 'svc1',
  fromDate: '2026-08-20',
  now: '2026-08-18T10:00:00Z',
  newBookingId: () => 'bkg_1',
});
assert.equal(slot.ok, true);
if (slot.ok) {
  assert.equal(slot.appointment.id, 'a1');
  assert.equal(slot.booking.source, 'follow_up');
}

const none = clinicBookFollowUpSlot({
  appointments: [
    {
      id: 'a2',
      service_id: 'svc_sys_personal',
      date: '2026-08-25',
      start_time: '08:00',
      status: 'scheduled',
      appointment_kind: 'personal',
    },
  ],
  bookings: [],
  patientId: 'p1',
  fromDate: '2026-08-20',
  now: '2026-08-18T10:00:00Z',
  newBookingId: () => 'bkg_1',
});
assert.equal(none.ok, false);

const bell = advisorBellFollowUps(
  {
    medicalgraph: {
      patients: [
        {
          id: 'p1',
          name: 'Ada',
          follow_ups: [
            {
              id: 'f1',
              remind_on: '2026-08-18',
              title: 'Check-in',
              advice: 'How are you feeling?',
              status: 'scheduled',
              created_at: '2026-08-10',
            },
            {
              id: 'f2',
              remind_on: '2026-09-01',
              advice: 'Later',
              status: 'scheduled',
              created_at: '2026-08-10',
            },
          ],
        },
      ],
    },
  },
  '2026-08-18'
);
assert.equal(bell.length, 1);
assert.equal(bell[0].source, 'medicalgraph');
assert.match(bell[0].href, /medicalgraph\/patients\/p1/);

console.log('notify-follow-up.test.ts ok');
