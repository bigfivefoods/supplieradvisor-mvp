/**
 * Run: npx --yes tsx lib/clinic/appointment-visit.test.ts
 */
import assert from 'node:assert/strict';
import {
  appointmentVisitPatients,
  notesForVisit,
} from './appointment-visit';

const rows = appointmentVisitPatients({
  appointmentId: 'a1',
  bookings: [
    { id: 'b1', appointment_id: 'a1', patient_id: 'p1', status: 'booked' },
    {
      id: 'b2',
      appointment_id: 'a1',
      patient_id: 'p2',
      status: 'cancelled',
    },
    {
      id: 'b3',
      appointment_id: 'a2',
      patient_id: 'p1',
      status: 'booked',
    },
    {
      id: 'b4',
      appointment_id: 'a1',
      patient_id: 'p3',
      status: 'attended',
      family_member_name: 'Sam',
    },
  ],
  patients: [
    { id: 'p1', name: 'Ada', email: 'ada@x.test' },
    { id: 'p3', name: 'Bev' },
  ],
});
assert.equal(rows.length, 2);
assert.equal(rows[0].name, 'Ada');
assert.equal(rows[1].familyMemberName, 'Sam');

const notes = notesForVisit(
  [
    {
      id: 'n1',
      person_id: 'p1',
      body: 'a',
      appointment_id: 'a1',
      created_at: '2026-08-01',
      updated_at: '2026-08-01',
    },
    {
      id: 'n2',
      person_id: 'p1',
      body: 'other',
      appointment_id: 'a9',
      created_at: '2026-08-02',
      updated_at: '2026-08-02',
    },
    {
      id: 'n3',
      person_id: 'p2',
      body: 'x',
      appointment_id: 'a1',
      created_at: '2026-08-03',
      updated_at: '2026-08-03',
    },
  ],
  { patientId: 'p1', appointmentId: 'a1' }
);
assert.equal(notes.length, 1);
assert.equal(notes[0].id, 'n1');

console.log('appointment-visit ok');
