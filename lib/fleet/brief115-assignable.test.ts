/**
 * FleetAdvisor® assignability reasons.
 * Run: npx --yes tsx lib/fleet/brief115-assignable.test.ts
 */
import assert from 'node:assert/strict';
import { isAssignable, type AssignContext } from './isAssignable';
import type { FleetCompliance, FleetDriver, FleetVehicle } from './types';

const banned = /\b(legal|compliant|certified)\b/i;
const today = '2026-06-01';
const planned = '2026-08-01';

function vehicle(patch: Partial<FleetVehicle> = {}): FleetVehicle {
  return {
    id: 'v1',
    company_id: 1,
    reg_no: 'CA 123',
    kind: 'rigid',
    ownership: 'owned',
    make: '',
    model: '',
    year: null,
    vin: '',
    gvm_kg: 8000,
    tare_kg: null,
    payload_kg: null,
    fuel_type: '',
    tank_litres: null,
    odometer_km: null,
    odometer_at: null,
    status: 'active',
    depot_label: '',
    tracker_fitted: false,
    tracker_provider: '',
    notes: '',
    archived_at: null,
    updated_at: today,
    ...patch,
  };
}

function driver(patch: Partial<FleetDriver> = {}): FleetDriver {
  return {
    id: 'd1',
    company_id: 1,
    full_name: 'Sample Driver',
    phone: '',
    email: '',
    employment: 'employee',
    licence_code: 'EC',
    status: 'active',
    person_id: null,
    notes: '',
    archived_at: null,
    updated_at: today,
    ...patch,
  };
}

function item(patch: Partial<FleetCompliance>): FleetCompliance {
  return {
    id: patch.id || 'item',
    company_id: 1,
    subject_kind: 'vehicle',
    subject_id: 'v1',
    kind: 'licence_disc',
    reference: '',
    issued_on: '2026-01-01',
    expires_on: '2027-01-01',
    detail: {},
    status_note: '',
    archived_at: null,
    updated_at: today,
    ...patch,
  };
}

function ctx(items: FleetCompliance[], patch: Partial<AssignContext> = {}): AssignContext {
  return {
    items,
    workspace: { expiring_window_days: 30, prdp_gvm_threshold_kg: 3500, expected_vehicle_kinds: [], expected_driver_kinds: [] },
    ...patch,
  };
}

const covered = [
  item({ id: 'disc', kind: 'licence_disc', expires_on: '2027-01-01' }),
  item({ id: 'road', kind: 'roadworthy', expires_on: '2027-01-01' }),
  item({ id: 'ins', kind: 'insurance', expires_on: '2027-01-01' }),
];

const clear = isAssignable({ kind: 'vehicle', row: vehicle() }, planned, ctx(covered, { workspace: { expiring_window_days: 30, prdp_gvm_threshold_kg: 3500, expected_vehicle_kinds: ['licence_disc', 'roadworthy', 'insurance'] } }));
assert.equal(clear.assignable, true);
assert.equal(clear.reasons.length, 0);

for (const status of ['sold', 'off_road', 'workshop'] as const) {
  const result = isAssignable({ kind: 'vehicle', row: vehicle({ status }) }, planned, ctx(covered));
  assert.equal(result.assignable, false);
  assert.ok(result.reasons.some((reason) => reason.code === 'status' && reason.severity === 'block'));
}

const archived = isAssignable({ kind: 'vehicle', row: vehicle({ archived_at: today }) }, planned, ctx(covered));
assert.equal(archived.assignable, false);
assert.ok(archived.reasons.some((reason) => reason.code === 'archived'));

const leave = isAssignable({ kind: 'driver', row: driver({ status: 'on_leave' }) }, planned, ctx([], { workspace: { expiring_window_days: 30, prdp_gvm_threshold_kg: null, expected_driver_kinds: [] } }));
assert.equal(leave.assignable, false);
assert.ok(leave.reasons.some((reason) => reason.code === 'status'));

const early = isAssignable(
  { kind: 'vehicle', row: vehicle() },
  planned,
  ctx([item({ expires_on: '2026-07-01' })], { workspace: { expiring_window_days: 30, prdp_gvm_threshold_kg: null, expected_vehicle_kinds: [] } })
);
assert.equal(early.assignable, false);
assert.match(early.reasons.find((reason) => reason.code === 'expired')?.message || '', /expired 31 days before this date/);

for (const [expiry, window, code] of [
  ['2026-08-01', 0, 'expiring'],
  ['2026-08-02', 1, 'expiring'],
  ['2026-08-31', 30, 'expiring'],
  ['2026-09-01', 30, null],
] as const) {
  const result = isAssignable(
    { kind: 'vehicle', row: vehicle() },
    planned,
    ctx([item({ expires_on: expiry })], { workspace: { expiring_window_days: window, prdp_gvm_threshold_kg: null, expected_vehicle_kinds: [] } })
  );
  if (code) assert.ok(result.reasons.some((reason) => reason.code === code && reason.severity === 'warn'));
  else assert.equal(result.reasons.some((reason) => reason.kind === 'licence_disc'), false);
  assert.equal(result.assignable, true);
}

const noCard = isAssignable({ kind: 'vehicle', row: vehicle() }, planned, ctx(covered));
assert.equal(noCard.reasons.some((reason) => reason.kind === 'operator_card'), false);
const card = isAssignable({ kind: 'vehicle', row: vehicle() }, planned, ctx([...covered, item({ id: 'card', kind: 'operator_card', expires_on: '2026-07-01' })]));
assert.ok(card.reasons.some((reason) => reason.kind === 'operator_card' && reason.severity === 'block'));

const missingCountry = isAssignable(
  { kind: 'vehicle', row: vehicle() },
  planned,
  ctx(covered, { needs: { crossBorder: true, countries: ['bw'] }, workspace: { expiring_window_days: 30, prdp_gvm_threshold_kg: null, expected_vehicle_kinds: [] } })
);
assert.ok(missingCountry.reasons.some((reason) => reason.code === 'cross_border'));
const coveredCountry = isAssignable(
  { kind: 'vehicle', row: vehicle() },
  planned,
  ctx(
    [...covered, item({ id: 'xb', kind: 'cross_border_permit', detail: { countries: ['BW'] }, expires_on: '2027-01-01' })],
    { needs: { crossBorder: true, countries: ['BW'] }, workspace: { expiring_window_days: 30, prdp_gvm_threshold_kg: null, expected_vehicle_kinds: [] } }
  )
);
assert.equal(coveredCountry.reasons.some((reason) => reason.code === 'cross_border'), false);

const abnormal = isAssignable(
  { kind: 'vehicle', row: vehicle() },
  planned,
  ctx(covered, { needs: { abnormal: true }, workspace: { expiring_window_days: 30, prdp_gvm_threshold_kg: null, expected_vehicle_kinds: [] } })
);
assert.ok(abnormal.reasons.some((reason) => reason.code === 'abnormal' && reason.severity === 'block'));

const driverItems = [
  item({ id: 'lic', subject_kind: 'driver', subject_id: 'd1', kind: 'driver_licence', expires_on: '2027-01-01' }),
  item({ id: 'med', subject_kind: 'driver', subject_id: 'd1', kind: 'medical', expires_on: null, detail: { next_review_on: '2026-05-01' } }),
];
const medical = isAssignable(
  { kind: 'driver', row: driver() },
  planned,
  ctx(driverItems, { workspace: { expiring_window_days: 30, prdp_gvm_threshold_kg: null, expected_driver_kinds: [] }, pairedVehicle: { id: 'v1', gvm_kg: 2000 } })
);
assert.ok(medical.reasons.some((reason) => reason.code === 'medical_review' && reason.severity === 'warn'));
assert.equal(medical.assignable, true);

const gvm = isAssignable(
  { kind: 'driver', row: driver() },
  planned,
  ctx(driverItems, { workspace: { expiring_window_days: 30, prdp_gvm_threshold_kg: 3500, expected_driver_kinds: [] }, needs: { vehicleGvmKg: 4000 } })
);
assert.ok(gvm.reasons.some((reason) => reason.code === 'prdp_gvm' && reason.severity === 'warn'));
assert.equal(gvm.assignable, true);

const dangerous = isAssignable(
  { kind: 'driver', row: driver() },
  planned,
  ctx([...driverItems, item({ id: 'pr', subject_kind: 'driver', subject_id: 'd1', kind: 'prdp', detail: { category: 'G' }, expires_on: '2027-01-01' })], {
    workspace: { expiring_window_days: 30, prdp_gvm_threshold_kg: 3500, expected_driver_kinds: [] },
    needs: { dangerousGoods: true, vehicleGvmKg: 4000 },
  })
);
assert.ok(dangerous.reasons.some((reason) => reason.code === 'prdp_d' && reason.severity === 'block'));
assert.equal(dangerous.assignable, false);

const vehicleDangerous = isAssignable(
  { kind: 'vehicle', row: vehicle() },
  planned,
  ctx([item({ id: 'disc-dg', expires_on: '2027-01-01' })], {
    needs: { dangerousGoods: true },
    workspace: { expiring_window_days: 30, prdp_gvm_threshold_kg: null, expected_vehicle_kinds: [] },
  })
);
assert.equal(vehicleDangerous.reasons.some((reason) => reason.code === 'prdp_d'), false);
assert.equal(vehicleDangerous.assignable, true);

const driverCovered = isAssignable(
  { kind: 'driver', row: driver() },
  planned,
  ctx(
    [...driverItems, item({ id: 'prd', subject_kind: 'driver', subject_id: 'd1', kind: 'prdp', detail: { category: 'D' }, expires_on: '2027-01-01' })],
    {
      needs: { dangerousGoods: true },
      workspace: { expiring_window_days: 30, prdp_gvm_threshold_kg: null, expected_driver_kinds: [] },
    }
  )
);
assert.equal(driverCovered.reasons.some((reason) => reason.code === 'prdp_d'), false);
assert.equal(driverCovered.assignable, true);

const notRecorded = isAssignable(
  { kind: 'vehicle', row: vehicle() },
  planned,
  ctx([], { workspace: { expiring_window_days: 30, prdp_gvm_threshold_kg: null, expected_vehicle_kinds: ['licence_disc'] } })
);
assert.ok(notRecorded.reasons.some((reason) => reason.code === 'not_recorded' && reason.message.includes('Not recorded')));
assert.equal(notRecorded.assignable, true);

for (const result of [clear, early, card, medical, gvm, dangerous, vehicleDangerous, driverCovered, notRecorded]) {
  for (const reason of result.reasons) assert.equal(banned.test(reason.message), false, reason.message);
}

console.log('brief115-assignable.test.ts ok');
