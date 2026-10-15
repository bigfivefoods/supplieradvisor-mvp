/**
 * FleetAdvisor® company role to module role.
 * Run: npx --yes tsx lib/fleet/brief114-roles.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEAM_ROLE_OPTIONS } from '../business/permissions';
import { emptyFleetBook } from './empty-book';
import { applyFleetOp } from './ops';
import { allowedOpsForRole, capabilitiesFor, resolveFleetRole, viewForRole } from './roles';

const expected: Record<string, string> = {
  owner: 'owner',
  admin: 'manager',
  member: 'dispatcher',
  operations: 'dispatcher',
  finance: 'office',
  viewer: 'viewer',
  sales: 'viewer',
  sales_contractor: 'none',
};

for (const option of TEAM_ROLE_OPTIONS) {
  assert.equal(resolveFleetRole(option.value), expected[option.value], option.value);
}
assert.equal(resolveFleetRole('not-a-role'), 'none');
assert.equal(resolveFleetRole(null), 'none');
assert.equal(resolveFleetRole(''), 'none');
assert.equal(allowedOpsForRole('none').length, 0);

const book = emptyFleetBook(1, '2024-07-02T00:00:00.000Z');
book.jobs = [
  {
    id: 'job',
    company_id: 1,
    reference: 'J-1',
    customer_id: null,
    customer_name: 'Sample Retailer',
    service_type: '',
    cargo_description: '',
    cargo_kg: null,
    cargo_volume_m3: null,
    packages: null,
    status: 'draft',
    dangerous_goods: false,
    abnormal: false,
    abnormal_dims: null,
    cross_border: false,
    countries: [],
    price_cents: 888002,
    notes: '',
    vehicle_id: null,
    driver_id: null,
    archived_at: null,
    updated_at: '2024-07-02T00:00:00.000Z',
  },
];
book.cost_profiles = [
  {
    id: 'p',
    company_id: 1,
    vehicle_id: 'v',
    effective_from: '2024-06-01',
    effective_to: null,
    purchase_price_cents: null,
    residual_cents: null,
    depreciation_method: 'time',
    life_months: null,
    life_km: null,
    in_service_on: null,
    disposed_on: null,
    finance_monthly_cents: 0,
    insurance_annual_cents: 0,
    licences_annual_cents: 0,
    tracker_monthly_cents: 0,
    other_standing_monthly_cents: 0,
    driver_cost_monthly_cents: 999001,
    tyre_mode: 'accrual',
    tyre_set_cost_cents: null,
    tyre_life_km: null,
    updated_at: '2024-07-02T00:00:00.000Z',
  },
];
book.cost_entries = [
  {
    id: 'e',
    company_id: 1,
    vehicle_id: 'v',
    trip_id: null,
    driver_id: null,
    category: 'toll',
    occurred_on: '2024-06-02',
    amount_cents: 777003,
    vat_cents: 0,
    vat_claimable: true,
    litres: null,
    odometer_km: null,
    full_tank: false,
    source: 'manual',
    reference: '',
    note: '',
    reverses_id: null,
    created_at: '2024-07-02T00:00:00.000Z',
  },
];
book.overhead_pools = [
  { id: 'o', company_id: 1, period_month: '2024-06-01', amount_cents: 520000, basis: 'equal_vehicle_days', updated_at: '2024-07-02T00:00:00.000Z' },
];

const withCpk = {
  ...book,
  cpk: [{ vehicle_id: 'v', fully_loaded_per_km: 15.95, layer_lines: { standing: { driver: 2200000, finance: 1, insurance: 1, tracker: 1 } } }],
};

function jsonOf(role: ReturnType<typeof resolveFleetRole>, rates = false) {
  return JSON.stringify(viewForRole(withCpk, role, { dispatcherSeesRates: rates }));
}

const dispatcher = jsonOf('dispatcher');
assert.equal(dispatcher.includes('888002'), false);
assert.equal(dispatcher.includes('999001'), false);
assert.equal(dispatcher.includes('777003'), false);
assert.equal(dispatcher.includes('cost_entries'), false);
assert.equal(dispatcher.includes('cost_profiles'), false);
assert.equal(dispatcher.includes('overhead_pools'), false);
assert.equal(dispatcher.includes('"cpk"'), false);

const dispatcherRates = jsonOf('dispatcher', true);
assert.equal(dispatcherRates.includes('888002'), true);
assert.equal(dispatcherRates.includes('cost_entries'), false);

const office = jsonOf('office');
assert.equal(office.includes('888002'), true);
assert.equal(office.includes('777003'), true);
assert.equal(office.includes('999001'), false);
assert.equal(office.includes('cost_profiles'), true);

const viewer = jsonOf('viewer');
assert.equal(viewer.includes('888002'), true);
assert.equal(viewer.includes('cost_entries'), false);

const owner = jsonOf('owner');
assert.equal(owner.includes('999001'), true);
assert.equal(owner.includes('777003'), true);

assert.equal(capabilitiesFor('dispatcher').seesCosts, false);
assert.equal(capabilitiesFor('office').seesDriverPay, false);
assert.equal(capabilitiesFor('manager').seesCosts, true);
assert.equal(capabilitiesFor('manager').canConfirmRealData, false);
assert.equal(capabilitiesFor('owner').canConfirmRealData, true);

assert.equal(allowedOpsForRole('dispatcher').includes('cost_entry.add'), false);
assert.equal(allowedOpsForRole('dispatcher').includes('cost_profile.set'), false);
assert.equal(allowedOpsForRole('dispatcher').includes('overhead_pool.set'), false);
assert.equal(allowedOpsForRole('dispatcher').includes('cpk_target.set'), false);
assert.equal(allowedOpsForRole('office').length, 0);

const refused = applyFleetOp(
  book,
  { op: 'cost_entry.add', payload: { vehicle_id: 'v', category: 'toll', amount_cents: 1 } },
  { role: 'dispatcher', actorId: 'u', now: '2024-07-02T00:00:00.000Z', companyId: 1, enforceRealData: true }
);
assert.equal(refused.ok, false);
if (!refused.ok) assert.equal(refused.status, 403);
assert.equal(book.cost_entries.length, 1);

const route = readFileSync('app/api/fleet/fleetgraph/route.ts', 'utf8');
assert.ok(route.includes('viewForRole'));
assert.ok(route.includes('commitFleetOp'));
const getAt = route.indexOf('export async function GET');
const postAt = route.indexOf('export async function POST');
assert.ok(route.indexOf('gate(request', getAt) < route.indexOf('serveBook', getAt));
assert.ok(route.indexOf('gate(request', postAt) < route.indexOf('loadFleetBook', postAt));

console.log('brief114-roles.test.ts ok');
