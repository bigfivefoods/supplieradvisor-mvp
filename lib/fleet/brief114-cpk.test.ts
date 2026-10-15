/**
 * FleetAdvisor® cost per kilometre. The sample vehicle must match the published figures.
 * Run: npx --yes tsx lib/fleet/brief114-cpk.test.ts
 */
import assert from 'node:assert/strict';
import { filterFixes, freshness, pathKm } from './positions';
import {
  allocateCustomerCost,
  computeFleetCpk,
  driverVariance,
  estimateTripCost,
  laneCpk,
  ledgerCategoryAllowed,
  requiredRate,
  resolveDistance,
  trailingPerKm,
  type FleetCpkInput,
  type VehicleCpk,
} from './cpk';
import {
  SAMPLE_01_DISPLAY,
  formatLitresPer100,
  formatPerKm,
  marginLabel,
  money,
  sample01Input,
  signedPerKm,
} from './cpk-fixtures';

function finiteTree(value: unknown, path = 'root') {
  if (value == null) return;
  if (typeof value === 'number') {
    assert.equal(Number.isFinite(value), true, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => finiteTree(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      assert.notEqual(child, undefined, path + key);
      finiteTree(child, `${path}.${key}`);
    }
  }
}

const row = computeFleetCpk(sample01Input())[0];
assert.equal(row.status, 'ok');
assert.equal(row.distance_source, 'odometer');
assert.equal(row.interpolated, false);
assert.equal(row.total_km, 8000);
assert.equal(row.completeness, 'complete');
assert.equal(money(row.running_cents), SAMPLE_01_DISPLAY.l1);
assert.equal(money(row.standing_cents), SAMPLE_01_DISPLAY.l2);
assert.equal(money(row.capital_cents), SAMPLE_01_DISPLAY.l3);
assert.equal(money(row.overhead_cents), SAMPLE_01_DISPLAY.l4);
assert.equal(money(row.total_cents), SAMPLE_01_DISPLAY.total);
assert.equal(formatPerKm(row.running_per_km), SAMPLE_01_DISPLAY.running);
assert.equal(formatPerKm(row.standing_per_km), SAMPLE_01_DISPLAY.standing);
assert.equal(formatPerKm(row.capital_per_km), SAMPLE_01_DISPLAY.capital);
assert.equal(formatPerKm(row.overhead_per_km), SAMPLE_01_DISPLAY.overhead);
assert.equal(formatPerKm(row.fully_loaded_per_km), SAMPLE_01_DISPLAY.fully);
assert.equal(signedPerKm(row.variance_per_km), SAMPLE_01_DISPLAY.variance);
assert.equal(formatPerKm(row.target_per_km), SAMPLE_01_DISPLAY.target);
assert.equal(row.variance_status, 'over');
assert.equal(formatPerKm(row.breakeven_per_loaded_km), SAMPLE_01_DISPLAY.breakeven);
assert.equal(formatPerKm(requiredRate(row.breakeven_per_loaded_km, 0.1)), SAMPLE_01_DISPLAY.required);
assert.equal(money(row.profit_cents), SAMPLE_01_DISPLAY.profit);
assert.equal(formatPerKm(row.profit_per_km), SAMPLE_01_DISPLAY.profitPerKm);
assert.equal(marginLabel(row.margin), SAMPLE_01_DISPLAY.margin);
assert.equal(formatLitresPer100(row.litres_per_100km), SAMPLE_01_DISPLAY.fuel);
assert.equal(row.utilisation?.trip_days, SAMPLE_01_DISPLAY.tripDays);
assert.equal(row.utilisation?.available_days, SAMPLE_01_DISPLAY.availableDays);
assert.equal(row.utilisation?.idle_days, SAMPLE_01_DISPLAY.idleDays);
assert.equal(row.utilisation?.workshop_days, SAMPLE_01_DISPLAY.workshopDays);
assert.equal(money(row.layer_lines?.running.fuel ?? null), 'R52 000.00');
assert.equal(money(row.layer_lines?.running.toll ?? null), 'R6 400.00');
assert.equal(money(row.layer_lines?.running.maintenance ?? null), 'R4 800.00');
assert.equal(money(row.layer_lines?.running.tyres ?? null), 'R3 200.00');
finiteTree(row);

const planned = resolveDistance({
  period: { from: '2024-06-01', to: '2024-07-01' },
  plannedKm: 5000,
});
assert.equal(planned.source, 'none');
assert.equal(planned.km, null);

const tripsFirst = resolveDistance({
  period: { from: '2024-06-01', to: '2024-07-01' },
  tripDeltas: [{ km: 100, loaded_km: 80 }],
  readings: [
    { reading_km: 0, read_at: '2024-06-01' },
    { reading_km: 9000, read_at: '2024-07-01' },
  ],
});
assert.equal(tripsFirst.source, 'trips');
assert.equal(tripsFirst.km, 100);

const interpolated = resolveDistance({
  period: { from: '2024-06-01', to: '2024-07-01' },
  readings: [
    { reading_km: 0, read_at: '2024-05-01' },
    { reading_km: 6100, read_at: '2024-07-01' },
  ],
});
assert.equal(interpolated.source, 'odometer');
assert.equal(interpolated.interpolated, true);

const decreasing = resolveDistance({
  period: { from: '2024-06-01', to: '2024-07-01' },
  readings: [
    { reading_km: 5000, read_at: '2024-06-01' },
    { reading_km: 1000, read_at: '2024-06-15' },
    { reading_km: 1800, read_at: '2024-07-01' },
  ],
});
assert.ok(decreasing.warnings.some((warning) => /Decreasing/.test(warning)));
assert.equal(decreasing.km, 800);

const short = computeFleetCpk({
  ...sample01Input(),
  minKm: 100,
  vehicles: [
    {
      id: 'short',
      kind: 'van',
      ownership: 'owned',
      readings: [
        { reading_km: 10, read_at: '2024-06-01' },
        { reading_km: 40, read_at: '2024-06-20' },
      ],
    },
  ],
})[0];
assert.equal(short.status, 'not_enough_distance');
assert.equal(short.message, 'Not enough distance');

const none = computeFleetCpk({
  period: { from: '2024-06-01', to: '2024-07-01' },
  vehicles: [{ id: 'bare', kind: 'rigid', ownership: 'owned', planned_km: 400 }],
  entries: [],
  profiles: [],
  pools: [],
  targets: [],
})[0];
assert.equal(none.status, 'not_enough_data');
assert.match(none.next_step || '', /two odometer readings/);

assert.equal(ledgerCategoryAllowed('depreciation'), false);
assert.equal(ledgerCategoryAllowed('driver'), false);
const doubled = computeFleetCpk({
  ...sample01Input(),
  entries: [
    ...sample01Input().entries,
    { vehicle_id: 'sample-01', category: 'driver', occurred_on: '2024-06-03', amount_cents: 9_999_999 },
    { vehicle_id: 'sample-01', category: 'depreciation', occurred_on: '2024-06-03', amount_cents: 9_999_999 },
  ],
})[0];
assert.equal(money(doubled.running_cents), SAMPLE_01_DISPLAY.l1);

const leap = computeFleetCpk({
  period: { from: '2024-12-31', to: '2025-01-02' },
  vehicles: [
    {
      id: 'leap',
      kind: 'rigid',
      ownership: 'owned',
      readings: [
        { reading_km: 0, read_at: '2024-12-31' },
        { reading_km: 200, read_at: '2025-01-02' },
      ],
    },
  ],
  profiles: [
    {
      vehicle_id: 'leap',
      effective_from: '2024-01-01',
      finance_monthly_cents: 366_000,
      in_service_on: '2024-01-01',
      depreciation_method: 'time',
      life_months: 12,
      purchase_price_cents: 365_000,
      residual_cents: 0,
    },
  ],
  entries: [{ vehicle_id: 'leap', category: 'toll', occurred_on: '2024-12-31', amount_cents: 100 }],
  pools: [],
  targets: [],
})[0];
assert.ok((leap.standing_cents || 0) > 0);
assert.equal(leap.missing.includes('no overhead pool'), true);
assert.equal(leap.completeness, 'partial');

const distanceCap = computeFleetCpk({
  period: { from: '2024-06-01', to: '2024-07-01' },
  vehicles: [
    {
      id: 'cap',
      kind: 'rigid',
      ownership: 'owned',
      readings: [
        { reading_km: 0, read_at: '2024-06-01' },
        { reading_km: 5000, read_at: '2024-07-01' },
      ],
    },
  ],
  profiles: [
    {
      vehicle_id: 'cap',
      effective_from: '2024-06-01',
      depreciation_method: 'distance',
      life_km: 1000,
      purchase_price_cents: 100_000,
      residual_cents: 20_000,
      in_service_on: '2024-06-01',
    },
  ],
  entries: [{ vehicle_id: 'cap', category: 'toll', occurred_on: '2024-06-02', amount_cents: 1 }],
  pools: [{ period_month: '2024-06-01', amount_cents: 0, basis: 'km' }],
  targets: [],
})[0];
assert.equal(distanceCap.capital_cents, 80_000);

const ledgerTyres = computeFleetCpk({
  ...sample01Input(),
  profiles: [{ ...sample01Input().profiles[0], tyre_mode: 'ledger' }],
  entries: [
    ...sample01Input().entries,
    { vehicle_id: 'sample-01', category: 'tyres', occurred_on: '2024-06-08', amount_cents: 111_00 },
  ],
})[0];
assert.equal(ledgerTyres.layer_lines?.running.tyres, 111_00);

const vat = computeFleetCpk({
  period: { from: '2024-06-01', to: '2024-07-01' },
  vehicles: [
    {
      id: 'vat',
      kind: 'van',
      ownership: 'owned',
      readings: [
        { reading_km: 0, read_at: '2024-06-01' },
        { reading_km: 1000, read_at: '2024-07-01' },
      ],
    },
  ],
  entries: [
    {
      vehicle_id: 'vat',
      category: 'toll',
      occurred_on: '2024-06-04',
      amount_cents: 1000,
      vat_cents: 150,
      vat_claimable: false,
    },
    {
      vehicle_id: 'vat',
      category: 'fuel',
      occurred_on: '2024-06-05',
      amount_cents: 2000,
      vat_cents: 300,
      vat_claimable: true,
    },
  ],
  profiles: [],
  pools: [{ period_month: '2024-06-01', amount_cents: 0, basis: 'equal_vehicle_days' }],
  targets: [],
})[0];
assert.equal(vat.layer_lines?.running.toll, 1150);
assert.equal(vat.layer_lines?.running.fuel, 2000);
assert.ok(vat.missing.includes('no cost profile'));

const subs = computeFleetCpk({
  period: { from: '2024-06-01', to: '2024-07-01' },
  includeSubcontractors: false,
  vehicles: [
    {
      id: 'own',
      kind: 'rigid',
      ownership: 'owned',
      revenue_cents: 100,
      readings: [
        { reading_km: 0, read_at: '2024-06-01' },
        { reading_km: 1000, read_at: '2024-07-01' },
      ],
    },
    {
      id: 'sub',
      kind: 'rigid',
      ownership: 'subcontractor',
      revenue_cents: 100,
      readings: [
        { reading_km: 0, read_at: '2024-06-01' },
        { reading_km: 1000, read_at: '2024-07-01' },
      ],
    },
  ],
  entries: [
    { vehicle_id: 'own', category: 'toll', occurred_on: '2024-06-02', amount_cents: 1 },
    { vehicle_id: 'sub', category: 'toll', occurred_on: '2024-06-02', amount_cents: 1 },
  ],
  profiles: [],
  pools: [{ period_month: '2024-06-01', amount_cents: 10_000, basis: 'equal_vehicle_days' }],
  targets: [],
}) ;
assert.equal(subs.find((item) => item.vehicle_id === 'own')?.overhead_cents, 10_000);
assert.equal(subs.find((item) => item.vehicle_id === 'sub')?.overhead_cents, 0);

const peersInput: FleetCpkInput = {
  period: { from: '2024-06-01', to: '2024-07-01' },
  vehicles: [1, 2, 3, 4].map((n) => ({
    id: `p${n}`,
    kind: 'tipper',
    ownership: 'owned' as const,
    readings: [
      { reading_km: 0, read_at: '2024-06-01' },
      { reading_km: 1000, read_at: '2024-07-01' },
    ],
  })),
  entries: [1, 2, 3, 4].map((n) => ({
    vehicle_id: `p${n}`,
    category: 'toll',
    occurred_on: '2024-06-02',
    amount_cents: n * 100_000,
  })),
  profiles: [],
  pools: [{ period_month: '2024-06-01', amount_cents: 0, basis: 'km' }],
  targets: [
    { scope_kind: 'fleet', scope_ref: '', layer: 'fully_loaded', target_cents_per_km: 1000, effective_from: '2024-01-01' },
  ],
};
const peers = computeFleetCpk(peersInput);
assert.equal(peers[0].peer.hidden, false);
assert.equal(peers[0].variance_status === 'over' || peers[0].variance_status === 'under' || peers[0].variance_status === 'on_target', true);
const few = computeFleetCpk({ ...peersInput, vehicles: peersInput.vehicles.slice(0, 3), entries: peersInput.entries.slice(0, 3) });
assert.equal(few[0].peer.hidden, true);

const badFuel = computeFleetCpk({
  period: { from: '2024-06-01', to: '2024-07-01' },
  vehicles: [
    {
      id: 'fuel',
      kind: 'van',
      ownership: 'owned',
      readings: [
        { reading_km: 0, read_at: '2024-06-01' },
        { reading_km: 500, read_at: '2024-07-01' },
      ],
    },
  ],
  entries: [
    { vehicle_id: 'fuel', category: 'fuel', occurred_on: '2024-06-02', amount_cents: 1, full_tank: true, odometer_km: 100, litres: 10 },
    { vehicle_id: 'fuel', category: 'fuel', occurred_on: '2024-06-03', amount_cents: 1, full_tank: true, odometer_km: 90, litres: 10 },
    { vehicle_id: 'fuel', category: 'toll', occurred_on: '2024-06-04', amount_cents: 1 },
  ],
  profiles: [],
  pools: [{ period_month: '2024-06-01', amount_cents: 0, basis: 'km' }],
  targets: [],
})[0];
assert.equal(badFuel.litres_per_100km, null);
assert.ok(badFuel.fuel_warnings.length > 0);

const noLoaded = computeFleetCpk({
  ...sample01Input(),
  vehicles: [{ ...sample01Input().vehicles[0], loaded_km: null }],
})[0];
assert.equal(noLoaded.breakeven_per_loaded_km, null);

const trip = estimateTripCost({
  directCents: 1000,
  maintenancePerKm: 2,
  tyrePerKm: 1,
  standingPerDay: 50,
  capitalPerDay: 20,
  overheadPerDay: 10,
  tripKm: 100,
  durationHours: 30,
  assumeEmptyReturn: true,
  returnKm: 80,
});
assert.equal(trip.days, 3);
assert.equal(trip.costCents, 1000 + 3 * 100 + 3 * 80 + 80 * 3);
assert.equal(laneCpk([{ km: 10, costCents: 1000 }, { km: 10, costCents: 1000 }], 3).hidden, true);
assert.equal(laneCpk([{ km: 10, costCents: 1000 }, { km: 10, costCents: 1000 }, { km: 10, costCents: 1000 }], 3).hidden, false);
const split = allocateCustomerCost(
  [
    { id: 'a', loaded_km: 30 },
    { id: 'b', loaded_km: 70 },
  ],
  1000,
  100
);
assert.equal(split[0].rule, 'loaded km');
assert.equal(split[0].costCents, 300);
assert.equal(driverVariance(2, 1.5), 0.5);
assert.equal(trailingPerKm(500, 0), null);
assert.equal(requiredRate(null, 0.1), null);
assert.equal(requiredRate(10, 1), null);

for (const messy of [0, Number.NaN, Number.POSITIVE_INFINITY]) {
  const messyRow: VehicleCpk = computeFleetCpk({
    period: { from: '2024-06-01', to: '2024-06-01' },
    minKm: messy === 0 ? 0 : 100,
    vehicles: [{ id: 'z', kind: 'other', ownership: 'owned', revenue_cents: messy, loaded_km: messy, planned_km: messy }],
    entries: [],
    profiles: [],
    pools: [],
    targets: [],
  })[0];
  finiteTree(messyRow);
  assert.equal(JSON.stringify(messyRow).includes('NaN'), false);
  assert.equal(JSON.stringify(messyRow).includes('Infinity'), false);
}

const filtered = filterFixes([
  { at: '2024-06-01T10:00:00.000Z', lat: -26.1, lng: 28.0, accuracy_m: 10 },
  { at: '2024-06-01T10:05:00.000Z', lat: -26.2, lng: 28.0, accuracy_m: 250 },
  { at: '2024-06-01T10:06:00.000Z', lat: 91, lng: 0 },
]);
assert.equal(filtered.kept.length, 1);
assert.ok(filtered.warnings.length >= 2);
assert.equal(freshness(60_000), 'fresh');
assert.equal(freshness(10 * 60_000), 'stale');
assert.equal(freshness(2 * 60 * 60_000), 'offline');
assert.equal(pathKm([{ at: '2024-06-01T10:00:00.000Z', lat: 0, lng: 0 }, { at: '2024-06-01T12:00:00.000Z', lat: 0.01, lng: 0 }]), 0);

const partialPool = computeFleetCpk({
  period: { from: '2024-06-01', to: '2024-06-16' },
  vehicles: [
    {
      id: 'part',
      kind: 'rigid',
      ownership: 'owned',
      readings: [
        { reading_km: 0, read_at: '2024-06-01' },
        { reading_km: 1000, read_at: '2024-06-16' },
      ],
    },
  ],
  entries: [{ vehicle_id: 'part', category: 'toll', occurred_on: '2024-06-02', amount_cents: 100 }],
  profiles: [
    {
      vehicle_id: 'part',
      effective_from: '2024-06-01',
      finance_monthly_cents: 0,
      depreciation_method: 'time',
      life_months: 60,
      purchase_price_cents: 1,
      residual_cents: 0,
      in_service_on: '2024-06-01',
    },
  ],
  pools: [{ period_month: '2024-06-01', amount_cents: 1_000_000, basis: 'equal_vehicle_days' }],
  targets: [],
})[0];
assert.equal(partialPool.overhead_cents, 500_000);

const trailing = computeFleetCpk({
  period: { from: '2024-05-15', to: '2024-06-15' },
  vehicles: [
    {
      id: 'trail',
      kind: 'rigid',
      ownership: 'owned',
      readings: [
        { reading_km: 0, read_at: '2024-05-15' },
        { reading_km: 2000, read_at: '2024-06-15' },
      ],
    },
  ],
  entries: [{ vehicle_id: 'trail', category: 'toll', occurred_on: '2024-05-20', amount_cents: 100 }],
  profiles: [
    {
      vehicle_id: 'trail',
      effective_from: '2024-01-01',
      finance_monthly_cents: 0,
      depreciation_method: 'time',
      life_months: 60,
      purchase_price_cents: 1,
      residual_cents: 0,
      in_service_on: '2024-01-01',
    },
  ],
  pools: [
    { period_month: '2024-05-01', amount_cents: 1_000_000, basis: 'equal_vehicle_days' },
    { period_month: '2024-06-01', amount_cents: 1_000_000, basis: 'equal_vehicle_days' },
  ],
  targets: [],
})[0];
const mayShare = (1_000_000 * 17) / 31;
const juneShare = (1_000_000 * 14) / 30;
assert.ok(Math.abs((trailing.overhead_cents || 0) - (mayShare + juneShare)) < 1);
assert.notEqual(trailing.overhead_cents, 2_000_000);

const shared = computeFleetCpk({
  period: { from: '2024-06-01', to: '2024-07-01' },
  vehicles: [
    {
      id: 'with-km',
      kind: 'rigid',
      ownership: 'owned',
      readings: [
        { reading_km: 0, read_at: '2024-06-01' },
        { reading_km: 1000, read_at: '2024-07-01' },
      ],
    },
    { id: 'no-odo', kind: 'rigid', ownership: 'owned' },
  ],
  entries: [{ vehicle_id: 'with-km', category: 'toll', occurred_on: '2024-06-02', amount_cents: 100 }],
  profiles: [],
  pools: [{ period_month: '2024-06-01', amount_cents: 1_000_000, basis: 'equal_vehicle_days' }],
  targets: [],
});
assert.equal(shared.find((item) => item.vehicle_id === 'with-km')?.overhead_cents, 500_000);
assert.equal(shared.find((item) => item.vehicle_id === 'no-odo')?.overhead_cents, 500_000);
assert.equal(shared[0].overhead_unallocated_cents, 0);

const kmBasis = computeFleetCpk({
  period: { from: '2024-06-01', to: '2024-07-01' },
  vehicles: [
    {
      id: 'moved',
      kind: 'rigid',
      ownership: 'owned',
      readings: [
        { reading_km: 0, read_at: '2024-06-01' },
        { reading_km: 1000, read_at: '2024-07-01' },
      ],
    },
    { id: 'still', kind: 'van', ownership: 'owned' },
  ],
  entries: [{ vehicle_id: 'moved', category: 'toll', occurred_on: '2024-06-02', amount_cents: 100 }],
  profiles: [],
  pools: [{ period_month: '2024-06-01', amount_cents: 900_000, basis: 'km' }],
  targets: [],
});
assert.equal(kmBasis.find((item) => item.vehicle_id === 'moved')?.overhead_cents, 900_000);
assert.equal(kmBasis.find((item) => item.vehicle_id === 'still')?.overhead_cents, null);
assert.equal(kmBasis[0].overhead_unallocated_cents, 0);

const nobodyMoved = computeFleetCpk({
  period: { from: '2024-06-01', to: '2024-07-01' },
  vehicles: [{ id: 'parked', kind: 'rigid', ownership: 'owned' }],
  entries: [],
  profiles: [],
  pools: [{ period_month: '2024-06-01', amount_cents: 400_000, basis: 'km' }],
  targets: [],
})[0];
assert.equal(nobodyMoved.overhead_cents, null);
assert.equal(nobodyMoved.overhead_unallocated_cents, 400_000);

const midProfile = computeFleetCpk({
  period: { from: '2024-06-01', to: '2024-07-01' },
  vehicles: [
    {
      id: 'mid',
      kind: 'rigid',
      ownership: 'owned',
      readings: [
        { reading_km: 0, read_at: '2024-06-01' },
        { reading_km: 3000, read_at: '2024-07-01' },
      ],
    },
  ],
  entries: [{ vehicle_id: 'mid', category: 'toll', occurred_on: '2024-06-20', amount_cents: 100 }],
  profiles: [
    {
      vehicle_id: 'mid',
      effective_from: '2024-06-16',
      finance_monthly_cents: 1_830_000,
      depreciation_method: 'time',
      life_months: 60,
      purchase_price_cents: 73_000_000,
      residual_cents: 0,
      in_service_on: '2024-06-16',
    },
  ],
  pools: [{ period_month: '2024-06-01', amount_cents: 0, basis: 'equal_vehicle_days' }],
  targets: [],
})[0];
const midDaily = (1_830_000 * 12) / 366;
assert.ok(Math.abs((midProfile.layer_lines?.standing.finance || 0) - midDaily * 15) < 1);
assert.ok((midProfile.capital_cents || 0) > 0);
assert.notEqual(midProfile.standing_cents, 0);

const financeChange = computeFleetCpk({
  period: { from: '2024-06-01', to: '2024-07-01' },
  vehicles: [
    {
      id: 'fin',
      kind: 'rigid',
      ownership: 'owned',
      readings: [
        { reading_km: 0, read_at: '2024-06-01' },
        { reading_km: 2000, read_at: '2024-07-01' },
      ],
    },
  ],
  entries: [{ vehicle_id: 'fin', category: 'toll', occurred_on: '2024-06-04', amount_cents: 100 }],
  profiles: [
    {
      vehicle_id: 'fin',
      effective_from: '2024-06-01',
      effective_to: '2024-06-16',
      finance_monthly_cents: 1_000_000,
      depreciation_method: 'time',
      life_months: 60,
      purchase_price_cents: 100_000,
      residual_cents: 0,
      in_service_on: '2024-06-01',
    },
    {
      vehicle_id: 'fin',
      effective_from: '2024-06-16',
      finance_monthly_cents: 2_000_000,
      depreciation_method: 'time',
      life_months: 60,
      purchase_price_cents: 100_000,
      residual_cents: 0,
      in_service_on: '2024-06-01',
    },
  ],
  pools: [{ period_month: '2024-06-01', amount_cents: 0, basis: 'km' }],
  targets: [],
})[0];
const expectedFinance = 15 * ((1_000_000 * 12) / 366) + 15 * ((2_000_000 * 12) / 366);
const ignoredFinance = 30 * ((1_000_000 * 12) / 366);
assert.ok(Math.abs((financeChange.layer_lines?.standing.finance || 0) - expectedFinance) < 1);
assert.ok(Math.abs((financeChange.layer_lines?.standing.finance || 0) - ignoredFinance) > 1000);

const zeroCost = computeFleetCpk({
  period: { from: '2024-06-01', to: '2024-07-01' },
  vehicles: [
    {
      id: 'empty-cost',
      kind: 'rigid',
      ownership: 'owned',
      readings: [
        { reading_km: 0, read_at: '2024-06-01' },
        { reading_km: 1500, read_at: '2024-07-01' },
      ],
    },
  ],
  entries: [],
  profiles: [],
  pools: [],
  targets: [],
})[0];
assert.equal(zeroCost.status, 'not_enough_data');
assert.equal(zeroCost.message, 'Not enough data');
assert.equal(zeroCost.fully_loaded_per_km, null);
assert.equal(zeroCost.completeness, 'none');

console.log('brief114-cpk.test.ts ok');
console.log(
  [
    money(row.running_cents),
    money(row.standing_cents),
    money(row.capital_cents),
    money(row.overhead_cents),
    money(row.total_cents),
    formatPerKm(row.fully_loaded_per_km),
    signedPerKm(row.variance_per_km),
    formatPerKm(row.breakeven_per_loaded_km),
    formatPerKm(requiredRate(row.breakeven_per_loaded_km, 0.1)),
    money(row.profit_cents),
    formatPerKm(row.profit_per_km),
    marginLabel(row.margin),
    formatLitresPer100(row.litres_per_100km),
    `${row.utilisation?.trip_days}/${row.utilisation?.available_days}`,
  ].join(' · ')
);
