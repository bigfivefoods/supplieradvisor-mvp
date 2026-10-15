/**
 * FleetAdvisor® desk writes: dates, odometer, reversals, audit, compliance.
 * Run: npx --yes tsx lib/fleet/brief114-ops.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFleetBook } from './empty-book';
import { applyFleetOp, type OpContext } from './ops';
import { collectPages, fleetDiff, fleetPersistStatus } from './fleetgraph-db';
import { fuelEfficiency } from './cpk';
import { centsFromRand } from './format';

const ctx: OpContext = {
  role: 'owner',
  actorId: 'actor-7',
  now: '2024-06-15T22:30:00.000Z',
  companyId: 1,
  enforceRealData: false,
};

function withVehicle() {
  const book = emptyFleetBook(1, ctx.now);
  const made = applyFleetOp(
    book,
    { op: 'vehicle.upsert', payload: { reg_no: 'CA 1', kind: 'rigid', ownership: 'owned' } },
    ctx
  );
  assert.equal(made.ok, true);
  if (!made.ok) throw new Error('vehicle');
  return made.book;
}

const dated = withVehicle();
const status = dated.status_events[0];
assert.equal(status.from_at, '2024-06-16');
assert.equal(status.by_actor, 'actor-7');

const first = applyFleetOp(
  dated,
  { op: 'odometer.add', payload: { vehicle_id: dated.vehicles[0].id, reading_km: 1000, read_at: '2024-06-10' } },
  ctx
);
assert.equal(first.ok, true);
if (!first.ok) throw new Error('odo');
assert.equal(first.book.vehicles[0].odometer_km, 1000);
assert.equal(first.book.odometer_readings[0].recorded_by, 'actor-7');
assert.equal(first.book.odometer_readings[0].anomaly, false);

const back = applyFleetOp(
  first.book,
  { op: 'odometer.add', payload: { vehicle_id: dated.vehicles[0].id, reading_km: 900, read_at: '2024-06-09' } },
  ctx
);
assert.equal(back.ok, true);
if (!back.ok) throw new Error('back');
assert.equal(back.book.vehicles[0].odometer_km, 1000);
assert.equal(back.book.odometer_readings[1].anomaly, true);

const cost = applyFleetOp(
  back.book,
  { op: 'cost_entry.add', payload: { vehicle_id: dated.vehicles[0].id, category: 'toll', amount_cents: 100 } },
  ctx
);
assert.equal(cost.ok, true);
if (!cost.ok) throw new Error('cost');
assert.equal(cost.book.cost_entries[0].occurred_on, '2024-06-16');
const entryId = cost.book.cost_entries[0].id;
const once = applyFleetOp(cost.book, { op: 'cost_entry.reverse', payload: { vehicle_id: dated.vehicles[0].id, reverses_id: entryId } }, ctx);
assert.equal(once.ok, true);
if (!once.ok) throw new Error('once');
const twice = applyFleetOp(once.book, { op: 'cost_entry.reverse', payload: { vehicle_id: dated.vehicles[0].id, reverses_id: entryId } }, ctx);
assert.equal(twice.ok, false);
const reversalId = once.book.cost_entries.find((row) => row.reverses_id === entryId)?.id;
const nested = applyFleetOp(
  once.book,
  { op: 'cost_entry.reverse', payload: { vehicle_id: dated.vehicles[0].id, reverses_id: reversalId } },
  ctx
);
assert.equal(nested.ok, false);

const driver = applyFleetOp(once.book, { op: 'driver.upsert', payload: { full_name: 'Amahle Nkosi', phone: '0821234567', notes: 'day shift' } }, ctx);
assert.equal(driver.ok, true);
if (!driver.ok) throw new Error('driver');
const audit = driver.book.audit[driver.book.audit.length - 1];
assert.equal(audit.payload.driver_id, driver.book.drivers[0].id);
assert.equal('full_name' in audit.payload, false);
assert.equal(JSON.stringify(audit.payload).includes('Amahle'), false);

const saved = applyFleetOp(
  driver.book,
  {
    op: 'driver.upsert',
    payload: { id: driver.book.drivers[0].id, full_name: 'Amahle Nkosi', phone: '0821234567', notes: 'day shift' },
  },
  ctx,
  driver.book.drivers[0].updated_at
);
assert.equal(saved.ok, true);
if (!saved.ok) throw new Error('saved');
assert.equal(saved.book.drivers[0].phone, '0821234567');
assert.equal(saved.book.drivers[0].notes, 'day shift');

const licence = applyFleetOp(
  saved.book,
  { op: 'compliance.upsert', payload: { subject_kind: 'driver', subject_id: saved.book.drivers[0].id, kind: 'driver_licence', expires_on: '2027-01-01' } },
  ctx
);
assert.equal(licence.ok, true);
if (!licence.ok) throw new Error('licence');
const again = applyFleetOp(
  licence.book,
  { op: 'compliance.upsert', payload: { subject_kind: 'driver', subject_id: saved.book.drivers[0].id, kind: 'driver_licence', expires_on: '2028-01-01' } },
  ctx,
  licence.book.compliance[0].updated_at
);
assert.equal(again.ok, true);
if (!again.ok) throw new Error('again');
assert.equal(again.book.compliance.filter((row) => row.kind === 'driver_licence').length, 1);
assert.equal(again.book.compliance[0].expires_on, '2028-01-01');

const blankJob = applyFleetOp(again.book, { op: 'job.upsert', payload: { status: 'draft', stops: [] } }, ctx);
assert.equal(blankJob.ok, true);
if (!blankJob.ok) throw new Error('job');
assert.equal(blankJob.book.jobs[0].customer_name, '');
assert.equal(JSON.stringify(blankJob.book.jobs).includes('Sample Retailer'), false);
assert.equal(JSON.stringify(blankJob.book.stops).includes('Sample Depot'), false);

const vehicleId = dated.vehicles[0].id;
const fuel = applyFleetOp(
  blankJob.book,
  {
    op: 'cost_entry.add',
    payload: {
      vehicle_id: vehicleId,
      category: 'fuel',
      amount_cents: 10000,
      occurred_on: '2024-06-02',
      litres: 40,
      odometer_km: 1200,
      full_tank: true,
      vat_claimable: true,
    },
  },
  ctx
);
assert.equal(fuel.ok, true);
if (!fuel.ok) throw new Error('fuel');
assert.equal(fuel.book.cost_entries.at(-1)?.vat_cents, 1500);
const fuelId = fuel.book.cost_entries.at(-1)?.id;
const reversedFuel = applyFleetOp(fuel.book, { op: 'cost_entry.reverse', payload: { vehicle_id: vehicleId, reverses_id: fuelId } }, ctx);
assert.equal(reversedFuel.ok, true);
if (!reversedFuel.ok) throw new Error('rev');
const reversal = reversedFuel.book.cost_entries.at(-1);
assert.equal(reversal?.occurred_on, '2024-06-02');
assert.equal(reversal?.litres, -40);
assert.equal(reversal?.full_tank, true);
assert.equal(reversal?.vat_cents, -1500);
assert.equal(reversal?.odometer_km, 1200);
const net = fuelEfficiency(
  reversedFuel.book.cost_entries.map((row) => ({
    id: row.id,
    reverses_id: row.reverses_id,
    vehicle_id: row.vehicle_id,
    category: row.category,
    occurred_on: row.occurred_on,
    amount_cents: row.amount_cents,
    litres: row.litres,
    odometer_km: row.odometer_km,
    full_tank: row.full_tank,
  }))
);
assert.equal(net.litresPer100, null);

const negative = applyFleetOp(fuel.book, { op: 'cost_entry.add', payload: { vehicle_id: vehicleId, category: 'toll', amount_cents: -5 } }, ctx);
assert.equal(negative.ok, false);
if (negative.ok) throw new Error('neg');
assert.equal(negative.status, 400);
const emptyOdo = applyFleetOp(fuel.book, { op: 'odometer.add', payload: { vehicle_id: vehicleId, reading_km: '' } }, ctx);
assert.equal(emptyOdo.ok, false);
const hugeProfile = applyFleetOp(
  fuel.book,
  { op: 'cost_profile.set', payload: { vehicle_id: vehicleId, finance_monthly_cents: Number.POSITIVE_INFINITY } },
  ctx
);
assert.equal(hugeProfile.ok, false);
if (hugeProfile.ok) throw new Error('huge');
assert.equal(hugeProfile.status, 400);
const negativeProfile = applyFleetOp(
  fuel.book,
  { op: 'cost_profile.set', payload: { vehicle_id: vehicleId, finance_monthly_cents: -100 } },
  ctx
);
assert.equal(negativeProfile.ok, false);

const june = applyFleetOp(
  fuel.book,
  { op: 'cost_profile.set', payload: { vehicle_id: vehicleId, effective_from: '2024-06-01', finance_monthly_cents: 100 } },
  ctx
);
assert.equal(june.ok, true);
if (!june.ok) throw new Error('june');
const may = applyFleetOp(
  june.book,
  { op: 'cost_profile.set', payload: { vehicle_id: vehicleId, effective_from: '2024-05-01', finance_monthly_cents: 50 } },
  ctx
);
assert.equal(may.ok, true);
if (!may.ok) throw new Error('may');
const mayRow = may.book.cost_profiles.find((row) => row.effective_from === '2024-05-01');
const juneRow = may.book.cost_profiles.find((row) => row.effective_from === '2024-06-01');
assert.equal(mayRow?.effective_to, '2024-06-01');
assert.equal(juneRow?.effective_to ?? null, null);
const clash = applyFleetOp(
  may.book,
  { op: 'cost_profile.set', payload: { vehicle_id: vehicleId, effective_from: '2024-06-01', finance_monthly_cents: 80 } },
  ctx
);
assert.equal(clash.ok, false);
if (clash.ok) throw new Error('clash');
assert.equal(clash.status, 409);

const basis = applyFleetOp(may.book, { op: 'settings.update', payload: { overhead_basis: 'nope' } }, ctx, may.book.workspace.updated_at);
assert.equal(basis.ok, false);
if (basis.ok) throw new Error('basis');
assert.equal(basis.status, 400);
const lane = applyFleetOp(may.book, { op: 'settings.update', payload: { cpk_min_trips_per_lane: 0 } }, ctx, may.book.workspace.updated_at);
assert.equal(lane.ok, false);
const retention = applyFleetOp(may.book, { op: 'settings.update', payload: { retention_days: 0 } }, ctx, may.book.workspace.updated_at);
assert.equal(retention.ok, false);

const noted = applyFleetOp(
  may.book,
  { op: 'vehicle.upsert', payload: { id: vehicleId, reg_no: 'CA 1', kind: 'rigid', ownership: 'owned', notes: 'keep me' } },
  ctx,
  may.book.vehicles[0].updated_at
);
assert.equal(noted.ok, true);
if (!noted.ok) throw new Error('noted');
const kept = applyFleetOp(
  noted.book,
  { op: 'vehicle.upsert', payload: { id: vehicleId, reg_no: 'CA 1', kind: 'rigid', ownership: 'owned' } },
  ctx,
  noted.book.vehicles[0].updated_at
);
assert.equal(kept.ok, true);
if (!kept.ok) throw new Error('kept');
assert.equal(kept.book.vehicles[0].notes, 'keep me');
const archived = applyFleetOp(
  kept.book,
  { op: 'vehicle.upsert', payload: { id: vehicleId, reg_no: 'CA 1', kind: 'rigid', ownership: 'owned', archived_at: true } },
  ctx,
  kept.book.vehicles[0].updated_at
);
assert.equal(archived.ok, true);
if (!archived.ok) throw new Error('arch');
const reused = applyFleetOp(archived.book, { op: 'vehicle.upsert', payload: { reg_no: 'CA 1', kind: 'van', ownership: 'leased' } }, ctx);
assert.equal(reused.ok, true);

const missingDate = applyFleetOp(
  kept.book,
  { op: 'compliance.upsert', payload: { subject_kind: 'vehicle', subject_id: vehicleId, kind: 'licence_disc' } },
  ctx
);
assert.equal(missingDate.ok, false);
const firstDate = applyFleetOp(
  kept.book,
  { op: 'compliance.upsert', payload: { subject_kind: 'vehicle', subject_id: vehicleId, kind: 'licence_disc', expires_on: '2027-01-01' } },
  ctx
);
assert.equal(firstDate.ok, true);
if (!firstDate.ok) throw new Error('date');
const stale = applyFleetOp(
  firstDate.book,
  { op: 'compliance.upsert', payload: { subject_kind: 'vehicle', subject_id: vehicleId, kind: 'licence_disc', expires_on: '2028-01-01' } },
  ctx
);
assert.equal(stale.ok, false);
if (stale.ok) throw new Error('stale');
assert.equal(stale.status, 409);
assert.match(stale.error, /already on file/);

const pool = applyFleetOp(kept.book, { op: 'overhead_pool.set', payload: { period_month: '2024-06-01', amount_cents: 5000 } }, ctx);
assert.equal(pool.ok, true);
if (!pool.ok) throw new Error('pool');
const poolAgain = applyFleetOp(pool.book, { op: 'overhead_pool.set', payload: { period_month: '2024-06-01', amount_cents: 6000 } }, ctx);
assert.equal(poolAgain.ok, false);
if (poolAgain.ok) throw new Error('pool again');
assert.equal(poolAgain.status, 409);
const badPool = applyFleetOp(pool.book, { op: 'overhead_pool.set', payload: { period_month: '2024-07-01', amount_cents: -1 } }, ctx);
assert.equal(badPool.ok, false);
const zeroTarget = applyFleetOp(pool.book, { op: 'cpk_target.set', payload: { scope_kind: 'fleet', layer: 'fully_loaded', target_cents_per_km: 0 } }, ctx);
assert.equal(zeroTarget.ok, false);

const withStops = applyFleetOp(
  pool.book,
  {
    op: 'job.upsert',
    payload: {
      status: 'booked',
      stops: [
        { id: 'stop-a', kind: 'pickup', place_name: 'One' },
        { id: 'stop-b', kind: 'delivery', place_name: 'Two' },
      ],
    },
  },
  ctx
);
assert.equal(withStops.ok, true);
if (!withStops.ok) throw new Error('stops');
const job = withStops.book.jobs.at(-1);
const moved = applyFleetOp(
  withStops.book,
  {
    op: 'job.upsert',
    payload: {
      id: job?.id,
      status: 'booked',
      stops: [
        { id: 'stop-b', kind: 'pickup', place_name: 'Two' },
        { id: 'stop-c', kind: 'delivery', place_name: 'Three' },
      ],
    },
  },
  ctx,
  job?.updated_at
);
assert.equal(moved.ok, true);
if (!moved.ok) throw new Error('moved');
const diff = fleetDiff(withStops.book, moved.book);
assert.deepEqual(diff.delete_stop_ids, ['stop-a']);
const seq = diff.upserts.fg_job_stops.map((row) => `${row.id}:${row.seq}`).sort();
assert.deepEqual(seq, ['stop-b:1', 'stop-c:2']);
assert.equal(fleetPersistStatus({ code: '23505', message: 'duplicate key' }).ok, false);
assert.equal(fleetPersistStatus({ code: '23505', message: 'duplicate key' }).ok === false && fleetPersistStatus({ code: '23505', message: 'fg_reverse_closed' }).status, 409);

assert.equal(centsFromRand('1.005'), 101);
assert.equal(centsFromRand('8.325'), 833);
assert.equal(centsFromRand(''), null);
assert.equal(centsFromRand(Number.NaN), null);
assert.equal(centsFromRand(Number.POSITIVE_INFINITY), null);

const added = applyFleetOp(moved.book, { op: 'job.upsert', payload: { status: 'draft', new_customer_name: 'Sample Buyer', stops: [] } }, ctx);
assert.equal(added.ok, true);
if (!added.ok) throw new Error('buyer');
assert.equal(added.book.customers.at(-1)?.trading_name, 'Sample Buyer');
assert.equal(added.book.jobs.at(-1)?.customer_id, added.book.customers.at(-1)?.id);

async function main() {
  const pages = await collectPages(async (from, to) => {
    const all = Array.from({ length: 1001 }, (_, index) => index + 1);
    return { data: all.slice(from, to + 1), error: null };
  });
  assert.equal(pages.error, null);
  assert.equal(pages.rows.length, 1001);
  assert.equal(pages.rows[0], 1);
  assert.equal(pages.rows[1000], 1001);
  console.log('brief114-ops.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
