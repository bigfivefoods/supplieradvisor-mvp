/**
 * FleetAdvisor® desk writes: dates, odometer, reversals, audit, compliance.
 * Run: npx --yes tsx lib/fleet/brief114-ops.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFleetBook } from './empty-book';
import { applyFleetOp, type OpContext } from './ops';
import { collectPages } from './fleetgraph-db';

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
