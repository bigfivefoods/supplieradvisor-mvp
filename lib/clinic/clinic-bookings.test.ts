/**
 * Run: npx --yes tsx lib/clinic/clinic-bookings.test.ts
 */
import assert from 'node:assert/strict';
import {
  clinicRosterRows,
  findClinicAppointmentSeat,
  resolveClinicBookingId,
} from './clinic-bookings';

const bookings = [
  {
    id: 'old',
    appointment_id: 'a1',
    patient_id: 'p1',
    status: 'booked',
    booked_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'new',
    appointment_id: 'a1',
    patient_id: 'p1',
    status: 'attended',
    booked_at: '2026-08-02T00:00:00Z',
    updated_at: '2026-08-25T08:00:00Z',
  },
  {
    id: 'other',
    appointment_id: 'a1',
    patient_id: 'p2',
    status: 'booked',
    booked_at: '2026-08-01T00:00:00Z',
  },
];

assert.equal(findClinicAppointmentSeat(bookings, 'a1', 'p1')?.id, 'new');
assert.equal(
  resolveClinicBookingId(
    bookings,
    { appointment_id: 'a1', patient_id: 'p1' },
    () => 'fresh'
  ),
  'new'
);
assert.equal(
  resolveClinicBookingId(
    bookings,
    { appointment_id: 'a1', patient_id: 'p9' },
    () => 'fresh'
  ),
  'fresh'
);

const rows = clinicRosterRows(bookings, 'a1', [
  { id: 'p1', name: 'Ann' },
  { id: 'p2', name: 'Bo' },
]);
assert.equal(rows.length, 2);
assert.equal(rows.find((r) => r.patient_id === 'p1')?.status, 'attended');
assert.equal(rows.find((r) => r.patient_id === 'p1')?.booking_id, 'new');

console.log('clinic-bookings.test.ts ok');
