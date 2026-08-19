/**
 * Run: npx --yes tsx lib/services/clinician-visit-care.test.ts
 */
import assert from 'node:assert/strict';
import { applyClinicianVisitCare } from './clinician-visit-care';

const store = {
  patients: [
    {
      id: 'p1',
      name: 'Sam',
      medical: { scripts: [] },
      client_notes: [],
      shared_movements: [],
    },
  ],
  appointments: [
    {
      id: 'a1',
      service_id: 's1',
      practitioner_id: 'c1',
      date: '2026-08-19',
      start_time: '09:00',
      status: 'scheduled',
    },
  ],
  bookings: [
    {
      id: 'b1',
      appointment_id: 'a1',
      patient_id: 'p1',
      status: 'booked',
    },
  ],
  services: [],
  visit_notes: [],
  movements: [],
};

const note = applyClinicianVisitCare(
  store as never,
  'physiograph',
  'c1',
  'Dr Lee',
  {
    action: 'upsert_client_note',
    patient_id: 'p1',
    appointment_id: 'a1',
    booking_id: 'b1',
    body: 'Home: ice after session',
  }
);
assert.equal(note.ok, true);
assert.equal(store.patients[0].client_notes.length, 1);

const rx = applyClinicianVisitCare(
  store as never,
  'physiograph',
  'c1',
  'Dr Lee',
  {
    action: 'medical_script_upsert',
    patient_id: 'p1',
    appointment_id: 'a1',
    script: { kind: 'rehab', medication: 'Clamshells', instructions: '3x10' },
  }
);
assert.equal(rx.ok, true);

console.log('clinician-visit-care.test.ts ok');
