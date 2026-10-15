/**
 * FleetAdvisor® validation.
 * Run: npx --yes tsx lib/fleet/brief114-validation.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFleetBook } from './empty-book';
import { applyFleetOp } from './ops';
import { assertLedgerCategory, assertNoIdentityText, cleanEmail, findIdentityKey, sameCompanyCustomer } from './validation';

assert.ok(findIdentityKey({ licence_no: '123' }));
assert.ok(findIdentityKey({ nested: { passport_number: 'x' } }));
assert.ok(findIdentityKey({ id_number: '1' }));
assert.equal(findIdentityKey({ licence_code: 'EC' }), null);
assert.equal(cleanEmail(' Sample.Driver.A@Example.com '), 'sample.driver.a@example.com');
assert.equal(assertLedgerCategory('depreciation').ok, false);
assert.equal(assertLedgerCategory('fuel').ok, true);
assert.equal(sameCompanyCustomer(4, 4), true);
assert.equal(sameCompanyCustomer(5, 4), false);
assert.equal(sameCompanyCustomer(null, 4), false);

const book = emptyFleetBook(4, '2024-07-02T00:00:00.000Z');
book.workspace.id = 'ws';
book.workspace.updated_at = '2024-07-02T00:00:00.000Z';
const ctx = { role: 'owner' as const, actorId: 'u', now: '2024-07-02T01:00:00.000Z', companyId: 4, enforceRealData: true };
const identity = applyFleetOp(book, { op: 'driver.upsert', payload: { full_name: 'A', id_number: '800101' } }, ctx);
assert.equal(identity.ok, false);
const huge = applyFleetOp(book, { op: 'vehicle.upsert', payload: { reg_no: 'X', kind: 'rigid', ownership: 'owned', notes: 'n'.repeat(9000) } }, ctx);
assert.equal(huge.ok, false);
const money = applyFleetOp(
  book,
  { op: 'cost_entry.add', payload: { vehicle_id: 'missing', category: 'fuel', amount_cents: 10 ** 20 } },
  { ...ctx, enforceRealData: false }
);
assert.equal(money.ok, false);
book.vehicles.push({
  id: 'v1',
  company_id: 4,
  reg_no: 'SAMPLE 09',
  kind: 'van',
  ownership: 'owned',
  make: '',
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
  updated_at: '2024-07-02T00:00:00.000Z',
});
const badEnum = applyFleetOp(book, { op: 'vehicle.upsert', payload: { reg_no: 'ZZ1', kind: 'spaceship', ownership: 'owned' } }, { ...ctx, enforceRealData: false });
assert.equal(badEnum.ok, false);
const personal = applyFleetOp(
  book,
  { op: 'driver.upsert', payload: { full_name: 'Sample Driver D', phone: '000' } },
  ctx
);
assert.equal(personal.ok, false);
if (!personal.ok) assert.match(personal.error, /Demo-data mode/);

assert.equal(assertNoIdentityText('Call 0821234567').ok, true);
assert.equal(assertNoIdentityText('8001015009087').ok, false);
assert.equal(assertNoIdentityText('Reference 1234567890123').ok, true);
assert.equal(assertNoIdentityText('80010150090870').ok, true);
assert.equal(assertNoIdentityText('licence number ABC123456').ok, false);
assert.equal(assertNoIdentityText('passport no X1234567').ok, false);
const refused = applyFleetOp(
  book,
  { op: 'job.upsert', payload: { customer_name: 'Depot', notes: 'ID 8001015009087', status: 'draft' } },
  { ...ctx, enforceRealData: false }
);
assert.equal(refused.ok, false);

console.log('brief114-validation.test.ts ok');
