/**
 * Run: npx --yes tsx lib/clinic/visit-history.test.ts
 */
import assert from 'node:assert/strict';
import { buildPatientVisitHistory } from './visit-history';

const rows = buildPatientVisitHistory({
  patientId: 'p1',
  today: '2026-08-19',
  bookings: [
    { id: 'b-old', appointment_id: 'a-old', patient_id: 'p1', status: 'attended' },
    { id: 'b-new', appointment_id: 'a-new', patient_id: 'p1', status: 'booked' },
    { id: 'b-x', appointment_id: 'a-old', patient_id: 'p2', status: 'attended' },
    { id: 'b-c', appointment_id: 'a-old', patient_id: 'p1', status: 'cancelled' },
  ],
  appointments: [
    {
      id: 'a-old',
      date: '2026-08-01',
      start_time: '09:00',
      service_id: 's1',
      practitioner_id: 'pr1',
    },
    {
      id: 'a-new',
      date: '2026-08-22',
      start_time: '11:00',
      service_id: 's1',
      practitioner_id: 'pr1',
    },
  ],
  services: [{ id: 's1', name: 'GP consult' }],
  practitioners: [{ id: 'pr1', name: 'Dr Ada' }],
  visitNotes: [
    {
      id: 'n1',
      person_id: 'p1',
      appointment_id: 'a-old',
      body: 'Shared note',
      created_at: '2026-08-01T10:00:00Z',
    },
    {
      id: 'n2',
      person_id: 'p1',
      appointment_id: 'a-old',
      body: 'Private note',
      private: true,
      created_at: '2026-08-01T10:05:00Z',
    },
  ],
  scripts: [
    { appointment_id: 'a-old', medication: 'Amoxil', status: 'active' },
  ],
  patientFacing: true,
});

assert.equal(rows.length, 2);
assert.equal(rows[0].upcoming, true);
assert.equal(rows[1].upcoming, false);
assert.equal(rows[1].service_name, 'GP consult');
assert.equal(rows[1].notes.length, 1);
assert.equal(rows[1].notes[0].body, 'Shared note');
assert.equal(rows[1].scripts[0].medication, 'Amoxil');

const desk = buildPatientVisitHistory({
  patientId: 'p1',
  today: '2026-08-19',
  bookings: [
    { id: 'b-old', appointment_id: 'a-old', patient_id: 'p1', status: 'attended' },
  ],
  appointments: [
    { id: 'a-old', date: '2026-08-01', start_time: '09:00' },
  ],
  visitNotes: [
    {
      id: 'n2',
      person_id: 'p1',
      appointment_id: 'a-old',
      body: 'Private note',
      private: true,
    },
  ],
  patientFacing: false,
});
assert.equal(desk[0].notes[0].body, 'Private note');

console.log('visit-history.test.ts ok');
