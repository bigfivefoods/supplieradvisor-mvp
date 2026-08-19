/**
 * Run: npx --yes tsx lib/clinic/clinic-movements.test.ts
 */
import assert from 'node:assert/strict';
import {
  SYSTEM_CLINIC_MOVEMENT_CATALOG,
  activeSharedMovements,
  ensureSystemClinicMovements,
  shareMovementWithPatient,
  upsertClientNote,
  upsertClinicMovement,
} from './clinic-movements';

const codes = SYSTEM_CLINIC_MOVEMENT_CATALOG.map((m) => m.code);
assert.equal(new Set(codes).size, codes.length, 'catalog codes unique');
assert.ok(codes.length >= 80, `expected exhaustive catalog, got ${codes.length}`);

const store: { movements?: ReturnType<typeof ensureSystemClinicMovements> extends number ? never : unknown } & {
  movements: import('./clinic-movements').ClinicMovement[];
} = { movements: [] };
const added = ensureSystemClinicMovements(store);
assert.equal(added, SYSTEM_CLINIC_MOVEMENT_CATALOG.length);
assert.equal(ensureSystemClinicMovements(store), 0);
assert.ok(store.movements.every((m) => m.system === true));

const custom = upsertClinicMovement(
  store.movements,
  { name: 'Clinic-specific SLRs', category: 'Knee' },
  new Date().toISOString(),
  (p) => `${p}_x`
);
assert.equal(custom.name, 'Clinic-specific SLRs');
assert.equal(custom.system, false);

const patient: {
  shared_movements?: import('./clinic-movements').PatientMovementShare[];
  client_notes?: import('./clinic-movements').PatientClientNote[];
} = {};
const share = shareMovementWithPatient(patient, {
  movement: store.movements[0],
  sets: '3',
  reps: '10',
  frequency: '2× daily',
  notes: 'Stop if pain > 3/10',
  appointment_id: 'apt1',
});
assert.equal(share.movement_name, store.movements[0].name);
assert.equal(activeSharedMovements(patient.shared_movements).length, 1);

const note = upsertClientNote(patient, {
  body: 'Ice 10 minutes after the session.',
  appointment_id: 'apt1',
  author_name: 'Lee',
});
assert.equal(patient.client_notes?.[0].id, note.id);
assert.throws(() => upsertClientNote(patient, { body: '  ' }));

console.log(`clinic-movements tests ok (${codes.length} catalog items)`);
