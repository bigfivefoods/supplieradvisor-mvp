/**
 * Run: npx --yes tsx lib/clinic/consolidate-diary-slots.test.ts
 */
import assert from 'node:assert/strict';
import { consolidateClinicDiarySlots } from './consolidate-diary-slots';

const nine = {
  date: '2026-08-18',
  start_time: '09:00',
  end_time: '09:45',
  service_name: 'Consult',
};

const stacked = consolidateClinicDiarySlots([
  { ...nine, id: 'a', clinician_name: 'Dr A', full: true },
  { ...nine, id: 'b', clinician_name: 'Dr B', full: true },
  { ...nine, id: 'c', clinician_name: 'Dr C', full: true },
]);
assert.equal(stacked.length, 1);
assert.equal(stacked[0].service_name, 'Booked');
assert.equal(stacked[0].clinician_name, null);
assert.equal(stacked[0].full, true);

const mixed = consolidateClinicDiarySlots([
  { ...nine, id: 'a', clinician_name: 'Dr A', full: true },
  { ...nine, id: 'b', clinician_name: 'Dr B', full: false },
  { ...nine, id: 'c', clinician_name: 'Dr C', full: false },
  {
    ...nine,
    start_time: '10:00',
    end_time: '10:45',
    id: 'd',
    clinician_name: 'Dr A',
    full: false,
  },
]);
assert.equal(mixed.length, 2);
assert.equal(mixed[0].id, 'b');
assert.equal(mixed[0].full, false);
assert.equal(mixed[0].clinician_name, null);
assert.equal(mixed[1].id, 'd');

const memberPwa = consolidateClinicDiarySlots(
  [
    { ...nine, id: 'a', clinician_name: 'Dr A', full: true },
    { ...nine, id: 'b', clinician_name: 'Dr B', full: true },
  ],
  { availableOnly: true }
);
assert.equal(memberPwa.length, 0);

const preferred = consolidateClinicDiarySlots([
  { ...nine, id: 'a', clinician_name: 'Dr A', full: false },
  {
    ...nine,
    id: 'b',
    clinician_name: 'Dr B',
    full: false,
    is_preferred_clinician: true,
  },
]);
assert.equal(preferred.length, 1);
assert.equal(preferred[0].id, 'b');

const mine = consolidateClinicDiarySlots([
  { ...nine, id: 'a', clinician_name: 'Dr A', full: true, my_status: 'booked' },
  { ...nine, id: 'b', clinician_name: 'Dr B', full: true },
]);
assert.equal(mine.length, 1);
assert.equal(mine[0].my_status, 'booked');
assert.equal(mine[0].clinician_name, 'Dr A');

console.log('consolidate-diary-slots tests ok');
