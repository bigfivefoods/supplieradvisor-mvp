/**
 * FleetAdvisor® import mapping and demo-data gate.
 * Run: npx --yes tsx lib/fleet/brief115-import.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { emptyFleetBook } from './empty-book';
import { redactDryRun, sourceHash, validateDriverCsv, validateVehicleCsv } from './import-csv';
import { materialiseImport } from './import-materialise';
import {
  LICENCE_CODES,
  PREVIEW_SHIP_VEHICLE_ID,
  SHIP_DRIVER_COLUMNS,
  SHIP_VEHICLE_COLUMNS,
  mapShipDriver,
  mapShipVehicle,
  planShipVehicles,
  shipSourceHash,
} from './import-ship';
import { applyFleetOp } from './ops';
import { reminderDraft } from './reminder-form';
import { planReminders } from './reminders';
import { sampleFleetBook } from './sample-book';
import { sha256Hex } from './sha256';

assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

assert.equal(SHIP_DRIVER_COLUMNS.includes('license_number' as never), false);
assert.equal(SHIP_VEHICLE_COLUMNS.join(','), 'id,code,plate_number,make_model,vehicle_type,capacity_kg,status');

const truck = mapShipVehicle(
  { id: 's1', plate_number: 'ca 1', make_model: 'Sample Rigid', vehicle_type: 'truck', capacity_kg: 8000, status: 'in_use' },
  1,
  '2026-06-01T00:00:00.000Z',
  2
);
assert.equal(truck.vehicle?.kind, 'rigid');
assert.equal(truck.vehicle?.status, 'active');
assert.equal(truck.vehicle?.reg_no, 'CA 1');
assert.equal(truck.vehicle?.source_system, 'ship');
assert.equal(truck.vehicle?.payload_kg, 8000);
assert.equal(JSON.stringify(truck).includes('license_number'), false);

const workshop = mapShipVehicle({ id: 's2', plate_number: 'CA 2', vehicle_type: 'reefer', status: 'maintenance' }, 1, '2026-06-01', 3);
assert.equal(workshop.vehicle?.kind, 'rigid');
assert.equal(workshop.vehicle?.status, 'workshop');
const bike = mapShipVehicle({ id: 's3', plate_number: 'CA 3', vehicle_type: 'bike', status: 'offline' }, 1, '2026-06-01', 4);
assert.equal(bike.vehicle?.kind, 'other');
assert.equal(bike.vehicle?.status, 'off_road');
const other = mapShipVehicle({ id: 's4', plate_number: 'CA 4', vehicle_type: 'hover', status: 'available' }, 1, '2026-06-01', 5);
assert.equal(other.vehicle?.kind, 'other');
assert.ok(other.warnings.some((warning) => warning.code === 'kind_other'));

const driver = mapShipDriver(
  { id: 'd1', full_name: 'Sample Driver', phone: '010', email: 'Sample@Example.com', license_class: 'ec', status: 'off_duty' },
  1,
  '2026-06-01',
  2
);
assert.equal(driver.driver?.licence_code, 'EC');
assert.equal(driver.driver?.email, 'sample@example.com');
assert.equal(driver.driver?.status, 'on_leave');
assert.equal(JSON.stringify(driver).includes('license_number'), false);
assert.ok(LICENCE_CODES.includes('EC'));

const dropped = mapShipDriver({ id: 'd2', full_name: 'Sample Two', license_class: 'ZZ', status: 'suspended' }, 1, '2026-06-01', 3);
assert.equal(dropped.driver?.licence_code, '');
assert.equal(dropped.driver?.status, 'inactive');
assert.ok(dropped.warnings.some((warning) => warning.code === 'licence_code_dropped'));

const book = emptyFleetBook(1, '2026-06-01T00:00:00.000Z');
book.workspace.real_data_enabled = false;
const csv = 'reg_no,kind\nSAMPLE 9,rigid\n';
const parsed = validateVehicleCsv(csv, book, '2026-06-01T00:00:00.000Z');
assert.equal(parsed.summary.create, 1);
assert.equal(sourceHash('vehicles_csv', csv), sourceHash('vehicles_csv', csv));
assert.equal(sourceHash('vehicles_csv', csv), sha256Hex(`vehicles_csv\n${csv.trim()}`));

const fillBook = emptyFleetBook(1, '2026-06-01T00:00:00.000Z');
fillBook.vehicles = [
  {
    id: 'v',
    company_id: 1,
    reg_no: 'SAMPLE 9',
    kind: 'rigid',
    ownership: 'owned',
    make: 'Kept',
    model: '',
    year: null,
    vin: '',
    gvm_kg: null,
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
    updated_at: '2026-06-01T00:00:00.000Z',
  },
];
const linked = validateVehicleCsv('reg_no,make,model\nSAMPLE 9,Other,Rigid\n', fillBook, '2026-06-01T00:00:00.000Z');
assert.equal(linked.rows[0].action, 'link');
assert.equal(linked.summary.fill, 1);
const plan = linked.rows[0];
assert.ok('vehicle' in plan && plan.vehicle.make === 'Kept' && plan.vehicle.model === 'Rigid');

const drivers = validateDriverCsv('full_name,email\nSample Driver,sample@example.com\n', book, '2026-06-01T00:00:00.000Z');
const redacted = redactDryRun(drivers, true);
assert.equal(JSON.stringify(redacted.rows).toLowerCase().includes('sample driver'), false);
assert.equal(redacted.summary.create, drivers.summary.create);

const ctx = { role: 'owner' as const, actorId: 'owner', now: '2026-06-01T00:00:00.000Z', companyId: 1, enforceRealData: true };
const refused = applyFleetOp(book, { op: 'import.commit', payload: { kind: 'drivers_csv', source_hash: 'abc', plans: [] } }, ctx);
assert.equal(refused.ok, false);
const allowed = applyFleetOp(
  book,
  { op: 'import.commit', payload: { kind: 'vehicles_csv', source_hash: parsed.source_hash, plans: parsed.rows, summary: parsed.summary } },
  ctx
);
assert.equal(allowed.ok, false);

book.import_runs = [
  {
    id: 'dry',
    company_id: 1,
    kind: 'vehicles_csv',
    status: 'dry_run',
    row_counts: parsed.summary,
    source_hash: parsed.source_hash,
    source_label: 'file.csv',
    created_by: 'owner',
    dry_run: true,
    committed_at: null,
    created_at: '2026-06-01T00:00:00.000Z',
  },
];
const demoSneaky = applyFleetOp(
  book,
  {
    op: 'import.commit',
    payload: {
      kind: 'vehicles_csv',
      source_hash: parsed.source_hash,
      plans: [{ action: 'create', driver: { id: PREVIEW_SHIP_VEHICLE_ID, full_name: 'Real Person', company_id: 1 } }],
    },
  },
  ctx
);
assert.equal(demoSneaky.ok, false);
if (!demoSneaky.ok) assert.match(demoSneaky.error, /Demo-data mode/);
assert.equal(book.drivers.length, 0);

const badId = structuredClone(book);
badId.workspace.real_data_enabled = true;
const vehiclePlan = parsed.rows[0];
assert.ok('vehicle' in vehiclePlan);
const rejectedId = applyFleetOp(
  badId,
  {
    op: 'import.commit',
    payload: {
      kind: 'vehicles_csv',
      source_hash: parsed.source_hash,
      plans: [{ ...vehiclePlan, vehicle: { ...vehiclePlan.vehicle, id: 'ship-vehicle' } }],
    },
  },
  ctx
);
assert.equal(rejectedId.ok, false);
assert.equal(badId.vehicles.length, book.vehicles.length);

const realBook = structuredClone(book);
realBook.workspace.real_data_enabled = true;
const shape = applyFleetOp(
  realBook,
  {
    op: 'import.commit',
    payload: {
      kind: 'vehicles_csv',
      source_hash: parsed.source_hash,
      plans: [{ action: 'create', driver: { id: PREVIEW_SHIP_VEHICLE_ID, full_name: 'Real Person', company_id: 1 } }],
    },
  },
  ctx
);
assert.equal(shape.ok, false);
assert.equal(realBook.drivers.length, 0);

const aliased = validateVehicleCsv('plate,vehicle_type,gvm\nSAMPLE 77,rigid,9000\n', book, '2026-06-01T00:00:00.000Z');
assert.equal(aliased.summary.create, 1);
assert.ok('vehicle' in aliased.rows[0] && aliased.rows[0].vehicle.gvm_kg === 9000);
const duplicated = validateVehicleCsv('reg_no,kind\nSAMPLE 8,rigid\nSAMPLE 8,van\n', book, '2026-06-01T00:00:00.000Z');
assert.ok(duplicated.errors.some((error) => error.code === 'duplicate'));
const driverDup = validateDriverCsv('name,email,license_class\nSample A,a@example.com,EC\nSample B,a@example.com,C\n', book, '2026-06-01T00:00:00.000Z');
assert.equal(driverDup.summary.create, 1);
assert.ok(driverDup.errors.some((error) => error.code === 'duplicate'));

const shipRow = { id: 'ship-9', plate_number: 'SAMPLE 99', vehicle_type: 'truck', status: 'available' };
const shipPlans = planShipVehicles([shipRow], book, '2026-06-01T00:00:00.000Z', () => PREVIEW_SHIP_VEHICLE_ID);
assert.equal(shipPlans.rows[0].vehicle.id, PREVIEW_SHIP_VEHICLE_ID);
assert.equal(shipSourceHash('ship_vehicles', [shipRow]), shipSourceHash('ship_vehicles', [shipRow]));
const linkedShip = planShipVehicles([shipRow], { ...book, vehicles: [...book.vehicles, shipPlans.rows[0].vehicle] }, '2026-06-01T00:00:00.000Z', () => 'nope');
assert.equal(linkedShip.rows[0].action, 'link');
assert.equal(linkedShip.rows[0].vehicle.id, PREVIEW_SHIP_VEHICLE_ID);

const sample = sampleFleetBook();
const draft = reminderDraft(sample.reminders[0]);
const saved = applyFleetOp(
  sample,
  {
    op: 'reminder.upsert',
    payload: {
      id: draft.id,
      scope_kind: draft.scope_kind,
      kind: draft.kind,
      thresholds_days: draft.thresholds_days,
      channels: draft.channels,
      recipient_member_ids: draft.recipient_member_ids,
      enabled: draft.enabled,
    },
  },
  { role: 'owner', actorId: 'owner', now: '2024-07-02T12:00:00.000Z', companyId: sample.workspace.company_id, enforceRealData: false },
  sample.reminders[0].updated_at
);
assert.equal(saved.ok, true);
if (saved.ok) {
  const planned = planReminders({
    items: saved.book.compliance,
    rules: saved.book.reminders,
    vehicles: saved.book.vehicles,
    drivers: saved.book.drivers,
    members: saved.book.members,
    logKeys: [],
    now: '2024-07-02T12:00:00.000Z',
    workspace: saved.book.workspace,
  });
  assert.equal(planned.due.length, 1);
}
const freshDraft = reminderDraft(null);
assert.equal(freshDraft.enabled, false);
assert.deepEqual(freshDraft.recipient_member_ids, []);
assert.deepEqual(freshDraft.channels, []);

const junk = applyFleetOp(
  emptyFleetBook(1, '2026-06-01T00:00:00.000Z'),
  { op: 'settings.update', payload: { expected_vehicle_kinds: ['not-a-kind'] } },
  ctx
);
assert.equal(junk.ok, false);
if (!junk.ok) assert.match(junk.error, /expected date kinds/);

const committed = applyFleetOp(book, { op: 'import.commit', payload: { kind: 'vehicles_csv', source_hash: parsed.source_hash, plans: parsed.rows } }, ctx);
assert.equal(committed.ok, true);
if (committed.ok) {
  const again = applyFleetOp(committed.book, { op: 'import.commit', payload: { kind: 'vehicles_csv', source_hash: parsed.source_hash, plans: parsed.rows } }, ctx);
  assert.equal(again.ok, true);
  if (again.ok) {
    assert.equal(again.audit.payload.already_imported, true);
    assert.equal(again.book.vehicles.length, committed.book.vehicles.length);
  }
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

for (const file of [...walk('lib/fleet'), ...walk('app/api/fleet')]) {
  const src = readFileSync(file, 'utf8');
  assert.equal(/distribution_[a-z_]+\.(insert|update|upsert|delete)\(/i.test(src), false, file);
  assert.equal(/from\('distribution_[^']+'\)\.(insert|update|upsert|delete|rpc)/.test(src), false, file);
  if (file.endsWith('ship-source.ts') || file.endsWith('import-ship.ts')) {
    assert.equal(src.includes('license_number'), false, file);
  }
}

async function proveServerPlans() {
  const derived = await materialiseImport(
    book,
    {
      op: 'import.commit',
      payload: {
        kind: 'vehicles_csv',
        csv,
        source_label: 'Pasted CSV',
        plans: [{ action: 'create', driver: { full_name: 'Real Person', id: PREVIEW_SHIP_VEHICLE_ID } }],
      },
    },
    '2026-06-01T00:00:00.000Z'
  );
  assert.equal(derived.ok, true);
  if (derived.ok) {
    const plans = derived.op.payload.plans as Array<{ driver?: unknown; vehicle?: { reg_no?: string } }>;
    assert.equal(plans.some((row) => row.driver), false);
    assert.equal(plans[0]?.vehicle?.reg_no, 'SAMPLE 9');
    assert.equal(derived.op.payload.source_hash, parsed.source_hash);
  }
  const staff = readFileSync('app/api/fleet/fleetgraph/route.ts', 'utf8');
  assert.ok(staff.includes('materialiseImport'));
  console.log('brief115-import.test.ts ok');
}

proveServerPlans().catch((error) => {
  console.error(error);
  process.exit(1);
});
