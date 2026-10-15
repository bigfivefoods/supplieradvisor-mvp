/**
 * FleetAdvisor® worked example. Inputs are fictional. Expected display strings
 * are the published figures; the engine must reproduce them.
 */
import type { FleetCpkInput } from './cpk';
import { addDays } from './cpk';
import { formatLitresPer100, formatPerKm, formatRandFromCents, roundHalfAway } from './format';

export const SAMPLE_PERIOD = { from: '2024-06-01', to: '2024-07-01' };

function tripDays(): string[] {
  const days: string[] = [];
  for (let day = SAMPLE_PERIOD.from; day < SAMPLE_PERIOD.to; day = addDays(day, 1)) {
    if (day >= '2024-06-10' && day <= '2024-06-11') continue;
    if (day >= '2024-06-25') continue;
    days.push(day);
  }
  return days;
}

export function sample01Input(): FleetCpkInput {
  return {
    period: SAMPLE_PERIOD,
    today: '2024-07-01',
    minKm: 100,
    finesInCpk: false,
    tyreModeDefault: 'accrual',
    includeSubcontractors: false,
    vehicles: [
      {
        id: 'sample-01',
        kind: 'rigid',
        ownership: 'owned',
        revenue_cents: 14_000_000,
        loaded_km: 6000,
        planned_km: 99999,
        trip_days: tripDays(),
        readings: [
          { reading_km: 10000, read_at: '2024-06-01' },
          { reading_km: 18000, read_at: '2024-07-01' },
        ],
      },
    ],
    profiles: [
      {
        vehicle_id: 'sample-01',
        effective_from: '2024-06-01',
        effective_to: null,
        purchase_price_cents: 73_000_000,
        residual_cents: 0,
        depreciation_method: 'time',
        life_months: 60,
        life_km: null,
        in_service_on: '2024-06-01',
        disposed_on: null,
        finance_monthly_cents: 1_830_000,
        insurance_annual_cents: 3_904_000,
        licences_annual_cents: 610_000,
        tracker_monthly_cents: 30_500,
        other_standing_monthly_cents: 0,
        driver_cost_monthly_cents: 2_236_667,
        tyre_mode: 'accrual',
        tyre_set_cost_cents: 3_200_000,
        tyre_life_km: 80_000,
      },
    ],
    entries: [
      {
        vehicle_id: 'sample-01',
        category: 'fuel',
        occurred_on: '2024-06-02',
        amount_cents: 0,
        vat_cents: 0,
        vat_claimable: true,
        litres: 0,
        odometer_km: 10000,
        full_tank: true,
      },
      {
        vehicle_id: 'sample-01',
        category: 'fuel',
        occurred_on: '2024-06-20',
        amount_cents: 5_200_000,
        vat_cents: 0,
        vat_claimable: true,
        litres: 2800,
        odometer_km: 18000,
        full_tank: true,
      },
      {
        vehicle_id: 'sample-01',
        category: 'toll',
        occurred_on: '2024-06-18',
        amount_cents: 640_000,
        vat_claimable: true,
      },
      {
        vehicle_id: 'sample-01',
        category: 'maintenance',
        occurred_on: '2024-06-12',
        amount_cents: 480_000,
        vat_claimable: true,
      },
    ],
    pools: [{ period_month: '2024-06-01', amount_cents: 520_000, basis: 'equal_vehicle_days' }],
    targets: [
      {
        scope_kind: 'fleet',
        scope_ref: '',
        layer: 'fully_loaded',
        target_cents_per_km: 1550,
        effective_from: '2024-01-01',
      },
    ],
    statusEvents: [
      { vehicle_id: 'sample-01', status: 'active', from_at: '2024-06-01' },
      { vehicle_id: 'sample-01', status: 'workshop', from_at: '2024-06-10' },
      { vehicle_id: 'sample-01', status: 'active', from_at: '2024-06-12' },
    ],
  };
}

export const SAMPLE_01_DISPLAY = {
  l1: 'R66 400.00',
  l2: 'R44 000.00',
  l3: 'R12 000.00',
  l4: 'R5 200.00',
  total: 'R127 600.00',
  running: 'R8.30',
  standing: 'R5.50',
  capital: 'R1.50',
  overhead: 'R0.65',
  fully: 'R15.95',
  variance: '+R0.45',
  target: 'R15.50',
  breakeven: 'R21.27',
  required: 'R23.63',
  profit: 'R12 400.00',
  profitPerKm: 'R1.55',
  margin: '8.9%',
  fuel: '35.0 L/100 km',
  tripDays: 22,
  availableDays: 28,
  idleDays: 6,
  workshopDays: 2,
};

export function signedPerKm(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatPerKm(value)}`;
}

export function marginLabel(margin: number | null): string {
  if (margin == null || !Number.isFinite(margin)) return '—';
  return `${roundHalfAway(margin * 100, 1).toFixed(1)}%`;
}

export function money(cents: number | null): string {
  return formatRandFromCents(cents);
}

export { formatLitresPer100, formatPerKm };
