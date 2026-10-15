/**
 * FleetAdvisor® cost per kilometre. Pure: settings and today are injected.
 * Money stays in cents (fractions allowed) until the caller formats it.
 */

export type DistanceSource = 'trips' | 'odometer' | 'gps' | 'none';
export type Completeness = 'complete' | 'partial' | 'none';
export type VarianceStatus = 'on_target' | 'over' | 'under' | 'no_target';

export type CpkReading = { reading_km: number; read_at: string };
export type CpkTripDelta = { km: number; loaded_km?: number | null };
export type CpkFix = { at: string; lat: number; lng: number; accuracy_m?: number | null; speed_kmh?: number | null };
export type CpkEntry = {
  vehicle_id: string;
  category: string;
  occurred_on: string;
  amount_cents: number;
  vat_cents?: number;
  vat_claimable?: boolean;
  litres?: number | null;
  odometer_km?: number | null;
  full_tank?: boolean;
  id?: string;
  reverses_id?: string | null;
};
export type CpkProfile = {
  vehicle_id: string;
  effective_from: string;
  effective_to?: string | null;
  purchase_price_cents?: number | null;
  residual_cents?: number | null;
  depreciation_method?: 'time' | 'distance';
  life_months?: number | null;
  life_km?: number | null;
  in_service_on?: string | null;
  disposed_on?: string | null;
  finance_monthly_cents?: number;
  insurance_annual_cents?: number;
  licences_annual_cents?: number;
  tracker_monthly_cents?: number;
  other_standing_monthly_cents?: number;
  driver_cost_monthly_cents?: number;
  tyre_mode?: 'accrual' | 'ledger';
  tyre_set_cost_cents?: number | null;
  tyre_life_km?: number | null;
};
export type CpkPool = { period_month: string; amount_cents: number; basis: 'equal_vehicle_days' | 'km' | 'revenue' };
export type CpkTarget = {
  scope_kind: 'fleet' | 'vehicle_class' | 'vehicle' | 'lane';
  scope_ref: string;
  layer: 'fully_loaded' | 'operating';
  target_cents_per_km: number;
  effective_from: string;
};
export type CpkStatusEvent = { vehicle_id: string; status: string; from_at: string };
export type CpkVehicleInput = {
  id: string;
  kind: string;
  ownership: 'owned' | 'leased' | 'subcontractor';
  revenue_cents?: number | null;
  loaded_km?: number | null;
  planned_km?: number | null;
  trip_deltas?: CpkTripDelta[];
  trip_days?: string[];
  readings?: CpkReading[];
  fixes?: CpkFix[];
};

export type CpkPeriod = { from: string; to: string };

export type VehicleCpk = {
  vehicle_id: string;
  status: 'ok' | 'not_enough_distance' | 'not_enough_data';
  message: string | null;
  next_step: string | null;
  completeness: Completeness;
  missing: string[];
  distance_source: DistanceSource;
  interpolated: boolean;
  total_km: number | null;
  loaded_km: number | null;
  running_cents: number | null;
  standing_cents: number | null;
  capital_cents: number | null;
  overhead_cents: number | null;
  overhead_unallocated_cents: number | null;
  total_cents: number | null;
  running_per_km: number | null;
  standing_per_km: number | null;
  capital_per_km: number | null;
  overhead_per_km: number | null;
  fully_loaded_per_km: number | null;
  operating_per_km: number | null;
  target_per_km: number | null;
  variance_per_km: number | null;
  variance_status: VarianceStatus;
  litres_per_100km: number | null;
  fuel_warnings: string[];
  distance_warnings: string[];
  lumpy: boolean;
  utilisation: {
    trip_days: number;
    available_days: number;
    idle_days: number;
    workshop_days: number;
  } | null;
  breakeven_per_loaded_km: number | null;
  profit_cents: number | null;
  profit_per_km: number | null;
  margin: number | null;
  peer: { hidden: true } | { hidden: false; delta_per_km: number };
  layer_lines: {
    running: { fuel: number; toll: number; maintenance: number; tyres: number; other: number };
    standing: { driver: number; finance: number; insurance: number; licences: number; tracker: number; other: number };
  } | null;
};

const STANDING_LEDGER = new Set([
  'driver',
  'finance',
  'insurance',
  'licences_permits',
  'tracker',
  'other_standing',
  'depreciation',
]);

export function ledgerCategoryAllowed(category: string): boolean {
  return !STANDING_LEDGER.has(category);
}

export function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function eachDay(from: string, toExclusive: string): string[] {
  const out: string[] = [];
  if (!from || !toExclusive || from >= toExclusive) return out;
  for (let day = from.slice(0, 10); day < toExclusive.slice(0, 10); day = addDays(day, 1)) {
    out.push(day);
    if (out.length > 4000) break;
  }
  return out;
}

function dayCount(from: string, toExclusive: string): number {
  return eachDay(from, toExclusive).length;
}

function finite(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

function netCents(entry: CpkEntry): number {
  const amount = Number(entry.amount_cents) || 0;
  const vat = Number(entry.vat_cents) || 0;
  return amount + (entry.vat_claimable ? 0 : vat);
}

export function resolveDistance(input: {
  period: CpkPeriod;
  tripDeltas?: CpkTripDelta[];
  readings?: CpkReading[];
  fixes?: CpkFix[];
  plannedKm?: number | null;
}): {
  source: DistanceSource;
  km: number | null;
  interpolated: boolean;
  warnings: string[];
  loadedKmFromTrips: number | null;
} {
  void input.plannedKm;
  const warnings: string[] = [];
  const trips = input.tripDeltas || [];
  if (trips.length) {
    let km = 0;
    let loaded = 0;
    let sawLoaded = false;
    for (const trip of trips) {
      if (!Number.isFinite(trip.km) || trip.km <= 0) continue;
      km += trip.km;
      if (trip.loaded_km != null && Number.isFinite(trip.loaded_km)) {
        loaded += trip.loaded_km;
        sawLoaded = true;
      }
    }
    if (km > 0) {
      return {
        source: 'trips',
        km,
        interpolated: false,
        warnings,
        loadedKmFromTrips: sawLoaded ? loaded : null,
      };
    }
  }

  const readings = [...(input.readings || [])]
    .filter((row) => Number.isFinite(row.reading_km) && row.read_at)
    .sort((a, b) => a.read_at.localeCompare(b.read_at) || a.reading_km - b.reading_km);
  if (readings.length >= 2) {
    let km = 0;
    let interpolated = false;
    let used = false;
    const from = input.period.from.slice(0, 10);
    const to = input.period.to.slice(0, 10);
    for (let i = 0; i < readings.length - 1; i += 1) {
      const left = readings[i];
      const right = readings[i + 1];
      const leftDay = left.read_at.slice(0, 10);
      const rightDay = right.read_at.slice(0, 10);
      if (right.reading_km < left.reading_km) {
        warnings.push(`Decreasing odometer ${left.reading_km} then ${right.reading_km} was left out`);
        continue;
      }
      if (right.reading_km === left.reading_km) continue;
      const span = Math.max(1, dayCount(leftDay, rightDay) || 1);
      const overlapStart = leftDay > from ? leftDay : from;
      const overlapEnd = rightDay < to ? rightDay : to;
      const overlap = dayCount(overlapStart, overlapEnd);
      if (overlap <= 0) continue;
      const delta = right.reading_km - left.reading_km;
      km += (delta * overlap) / span;
      used = true;
      if (leftDay < from || rightDay > to) interpolated = true;
    }
    if (used && km > 0) {
      return { source: 'odometer', km, interpolated, warnings, loadedKmFromTrips: null };
    }
  }

  const gps = gpsKm(input.fixes || [], input.period);
  if (gps.km > 0) {
    return {
      source: 'gps',
      km: gps.km,
      interpolated: false,
      warnings: gps.warnings,
      loadedKmFromTrips: null,
    };
  }
  return { source: 'none', km: null, interpolated: false, warnings, loadedKmFromTrips: null };
}

function gpsKm(fixes: CpkFix[], period: CpkPeriod): { km: number; warnings: string[] } {
  const warnings: string[] = [];
  const rows = fixes
    .filter((fix) => fix.at.slice(0, 10) >= period.from.slice(0, 10) && fix.at.slice(0, 10) < period.to.slice(0, 10))
    .filter((fix) => Number.isFinite(fix.lat) && Number.isFinite(fix.lng))
    .sort((a, b) => a.at.localeCompare(b.at));
  const kept: CpkFix[] = [];
  for (const fix of rows) {
    if (fix.accuracy_m != null && fix.accuracy_m > 100) {
      warnings.push('A fix was left out because accuracy was over 100 m');
      continue;
    }
    if (fix.speed_kmh != null && fix.speed_kmh > 140) {
      warnings.push('A fix was left out because speed was over 140 km/h');
      continue;
    }
    const prev = kept[kept.length - 1];
    if (prev) {
      const gap = new Date(fix.at).getTime() - new Date(prev.at).getTime();
      if (Number.isFinite(gap) && gap > 0 && gap <= 15 * 60 * 1000) {
        const hop = haversineKm(prev.lat, prev.lng, fix.lat, fix.lng);
        const hours = gap / 3_600_000;
        if (hours > 0 && hop / hours > 140) {
          warnings.push('A fix was left out because speed was over 140 km/h');
          continue;
        }
      }
    }
    kept.push(fix);
  }
  let km = 0;
  for (let i = 1; i < kept.length; i += 1) {
    const gap = new Date(kept[i].at).getTime() - new Date(kept[i - 1].at).getTime();
    if (!Number.isFinite(gap) || gap <= 0 || gap > 15 * 60 * 1000) continue;
    km += haversineKm(kept[i - 1].lat, kept[i - 1].lng, kept[i].lat, kept[i].lng);
  }
  return { km, warnings };
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

function profileFor(profiles: CpkProfile[], vehicleId: string, day: string): CpkProfile | null {
  const rows = profiles
    .filter((row) => row.vehicle_id === vehicleId && row.effective_from.slice(0, 10) <= day)
    .filter((row) => !row.effective_to || row.effective_to.slice(0, 10) > day)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  return rows[0] || null;
}

function inFleet(profile: CpkProfile | null, day: string): boolean {
  if (!profile) return false;
  const start = (profile.in_service_on || profile.effective_from).slice(0, 10);
  if (day < start) return false;
  if (profile.disposed_on && day >= profile.disposed_on.slice(0, 10)) return false;
  return true;
}

function standingFor(profile: CpkProfile, from: string, to: string): NonNullable<VehicleCpk['layer_lines']> {
  const standing = { driver: 0, finance: 0, insurance: 0, licences: 0, tracker: 0, other: 0 };
  for (const day of eachDay(from, to)) {
    if (!inFleet(profile, day)) continue;
    const yearDays = daysInYear(Number(day.slice(0, 4)));
    standing.driver += ((profile.driver_cost_monthly_cents || 0) * 12) / yearDays;
    standing.finance += ((profile.finance_monthly_cents || 0) * 12) / yearDays;
    standing.insurance += (profile.insurance_annual_cents || 0) / yearDays;
    standing.licences += (profile.licences_annual_cents || 0) / yearDays;
    standing.tracker += ((profile.tracker_monthly_cents || 0) * 12) / yearDays;
    standing.other += ((profile.other_standing_monthly_cents || 0) * 12) / yearDays;
  }
  return {
    running: { fuel: 0, toll: 0, maintenance: 0, tyres: 0, other: 0 },
    standing,
  };
}

function capitalFor(profile: CpkProfile, from: string, to: string, km: number): number {
  const purchase = profile.purchase_price_cents;
  const residual = profile.residual_cents ?? 0;
  if (purchase == null || !Number.isFinite(purchase)) return 0;
  const base = purchase - residual;
  if (base <= 0) return 0;
  const serviceFrom = (profile.in_service_on || profile.effective_from).slice(0, 10);
  const serviceTo = profile.disposed_on ? profile.disposed_on.slice(0, 10) : '9999-12-31';
  const windowFrom = from > serviceFrom ? from : serviceFrom;
  const windowTo = to < serviceTo ? to : serviceTo;
  if (windowFrom >= windowTo) return 0;
  if (profile.depreciation_method === 'distance') {
    const life = profile.life_km || 0;
    if (life <= 0) return 0;
    const rate = base / life;
    const period = rate * Math.max(0, km);
    return Math.min(period, base);
  }
  const lifeMonths = profile.life_months || 0;
  if (lifeMonths <= 0) return 0;
  const daily = (base * 12) / (lifeMonths * 365);
  const before = dayCount(serviceFrom, windowFrom);
  const during = dayCount(windowFrom, windowTo);
  const usedBefore = daily * before;
  const room = Math.max(0, base - usedBefore);
  return Math.min(daily * during, room);
}

function tyreAccrual(profile: CpkProfile | null, km: number, modeDefault: 'accrual' | 'ledger'): number {
  if (!profile) return 0;
  const mode = profile.tyre_mode || modeDefault;
  if (mode !== 'accrual') return 0;
  const cost = profile.tyre_set_cost_cents;
  const life = profile.tyre_life_km;
  if (cost == null || life == null || life <= 0) return 0;
  return (cost / life) * km;
}

export function fuelEfficiency(entries: CpkEntry[]): { litresPer100: number | null; warnings: string[] } {
  const warnings: string[] = [];
  const reversed = new Set(entries.map((row) => row.reverses_id).filter((value): value is string => Boolean(value)));
  const live = entries.filter((row) => !row.reverses_id && !(row.id && reversed.has(row.id)));
  const fills = live
    .filter((row) => row.category === 'fuel' && row.full_tank && row.odometer_km != null)
    .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on) || (a.odometer_km || 0) - (b.odometer_km || 0));
  const valid = fills.filter((row, index) => {
    if (index === 0) return true;
    if (row.litres == null || !Number.isFinite(row.litres) || row.litres <= 0) {
      warnings.push('A full-tank fill was left out because litres were missing');
      return false;
    }
    const prev = fills[index - 1];
    if ((row.odometer_km || 0) <= (prev.odometer_km || 0)) {
      warnings.push('A full-tank fill was left out because the odometer did not increase');
      return false;
    }
    return true;
  });
  if (valid.length < 2) return { litresPer100: null, warnings };
  const first = valid[0];
  const last = valid[valid.length - 1];
  const km = (last.odometer_km || 0) - (first.odometer_km || 0);
  if (km <= 0) return { litresPer100: null, warnings };
  const litres = valid.slice(1).reduce((sum, row) => sum + (row.litres || 0), 0);
  if (litres <= 0) return { litresPer100: null, warnings };
  return { litresPer100: (litres / km) * 100, warnings };
}

function statusOn(events: CpkStatusEvent[], vehicleId: string, day: string): string {
  const rows = events
    .filter((row) => row.vehicle_id === vehicleId && row.from_at.slice(0, 10) <= day)
    .sort((a, b) => a.from_at.localeCompare(b.from_at));
  return rows.length ? rows[rows.length - 1].status : 'active';
}

function utilisationFor(
  vehicle: CpkVehicleInput,
  profile: CpkProfile | null,
  events: CpkStatusEvent[],
  period: CpkPeriod
): VehicleCpk['utilisation'] {
  let available = 0;
  let workshop = 0;
  let trip = 0;
  const tripSet = new Set(vehicle.trip_days || []);
  for (const day of eachDay(period.from, period.to)) {
    if (!inFleet(profile, day) && profile) continue;
    if (!profile && !vehicle.trip_days) continue;
    const status = statusOn(events, vehicle.id, day);
    if (status === 'workshop' || status === 'off_road') {
      workshop += status === 'workshop' ? 1 : 0;
      if (status === 'off_road') workshop += 0;
      continue;
    }
    if (status === 'sold') continue;
    available += 1;
    if (tripSet.has(day)) trip += 1;
  }
  const idle = Math.max(0, available - trip);
  return { trip_days: trip, available_days: available, idle_days: idle, workshop_days: workshop };
}

function pickTarget(targets: CpkTarget[], vehicle: CpkVehicleInput, period: CpkPeriod, layer: 'fully_loaded' | 'operating'): number | null {
  const day = addDays(period.to, -1);
  const rank = (kind: string) => (kind === 'vehicle' ? 3 : kind === 'vehicle_class' ? 2 : 1);
  const rows = targets
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.layer === layer && row.effective_from.slice(0, 10) <= day)
    .filter(({ row }) => {
      if (row.scope_kind === 'vehicle') return row.scope_ref === vehicle.id;
      if (row.scope_kind === 'vehicle_class') return row.scope_ref === vehicle.kind;
      if (row.scope_kind === 'fleet') return true;
      return false;
    })
    .sort((a, b) => rank(b.row.scope_kind) - rank(a.row.scope_kind) || b.row.effective_from.localeCompare(a.row.effective_from) || b.index - a.index);
  const hit = rows[0]?.row;
  if (!hit || !Number.isFinite(hit.target_cents_per_km)) return null;
  return hit.target_cents_per_km / 100;
}

function varianceOf(actual: number | null, target: number | null): { delta: number | null; status: VarianceStatus } {
  if (target == null || actual == null) return { delta: null, status: 'no_target' };
  const delta = actual - target;
  if (Math.abs(delta) < 0.005) return { delta: 0, status: 'on_target' };
  return { delta, status: delta > 0 ? 'over' : 'under' };
}

function emptyVehicle(id: string, message: string, next: string | null, status: VehicleCpk['status']): VehicleCpk {
  return {
    vehicle_id: id,
    status,
    message,
    next_step: next,
    completeness: 'none',
    missing: [],
    distance_source: 'none',
    interpolated: false,
    total_km: null,
    loaded_km: null,
    running_cents: null,
    standing_cents: null,
    capital_cents: null,
    overhead_cents: null,
    overhead_unallocated_cents: null,
    total_cents: null,
    running_per_km: null,
    standing_per_km: null,
    capital_per_km: null,
    overhead_per_km: null,
    fully_loaded_per_km: null,
    operating_per_km: null,
    target_per_km: null,
    variance_per_km: null,
    variance_status: 'no_target',
    litres_per_100km: null,
    fuel_warnings: [],
    distance_warnings: [],
    lumpy: false,
    utilisation: null,
    breakeven_per_loaded_km: null,
    profit_cents: null,
    profit_per_km: null,
    margin: null,
    peer: { hidden: true },
    layer_lines: null,
  };
}

export type FleetCpkInput = {
  period: CpkPeriod;
  today?: string;
  minKm?: number;
  finesInCpk?: boolean;
  tyreModeDefault?: 'accrual' | 'ledger';
  includeSubcontractors?: boolean;
  vehicles: CpkVehicleInput[];
  entries: CpkEntry[];
  profiles: CpkProfile[];
  pools: CpkPool[];
  targets: CpkTarget[];
  statusEvents?: CpkStatusEvent[];
};

export function computeFleetCpk(input: FleetCpkInput): VehicleCpk[] {
  const minKm = input.minKm ?? 100;
  const fines = input.finesInCpk === true;
  const tyreDefault = input.tyreModeDefault || 'accrual';
  const events = input.statusEvents || [];
  const drafts = input.vehicles.map((vehicle) => {
    const distance = resolveDistance({
      period: input.period,
      tripDeltas: vehicle.trip_deltas,
      readings: vehicle.readings,
      fixes: vehicle.fixes,
      plannedKm: vehicle.planned_km,
    });
    const profile = profileFor(input.profiles, vehicle.id, input.period.from);
    const entries = input.entries.filter((row) => row.vehicle_id === vehicle.id && ledgerCategoryAllowed(row.category));
    const inPeriod = entries.filter((row) => {
      const day = row.occurred_on.slice(0, 10);
      return day >= input.period.from.slice(0, 10) && day < input.period.to.slice(0, 10);
    });
    if (distance.km == null) {
      const row = emptyVehicle(
        vehicle.id,
        'Not enough data',
        'Add two odometer readings at least 7 days apart',
        'not_enough_data'
      );
      row.distance_warnings = distance.warnings;
      row.distance_source = 'none';
      return row;
    }
    if (distance.km < minKm) {
      const row = emptyVehicle(vehicle.id, 'Not enough distance', 'Add more odometer readings', 'not_enough_distance');
      row.total_km = distance.km;
      row.distance_source = distance.source;
      row.interpolated = distance.interpolated;
      row.distance_warnings = distance.warnings;
      return row;
    }
    const km = distance.km;
    const lines = {
      fuel: 0,
      toll: 0,
      maintenance: 0,
      tyres: 0,
      other: 0,
    };
    for (const entry of inPeriod) {
      if (entry.category === 'fine' && !fines) continue;
      const dayProfile = profileFor(input.profiles, vehicle.id, entry.occurred_on);
      const mode = dayProfile?.tyre_mode || tyreDefault;
      if (entry.category === 'tyres' && mode === 'accrual') continue;
      const net = netCents(entry);
      if (entry.category === 'fuel') lines.fuel += net;
      else if (entry.category === 'toll') lines.toll += net;
      else if (entry.category === 'maintenance') lines.maintenance += net;
      else if (entry.category === 'tyres') lines.tyres += net;
      else if (entry.category === 'border' || entry.category === 'other_running' || entry.category === 'other' || entry.category === 'fine') {
        lines.other += net;
      }
    }
    const segments = profileSegments(input.profiles, vehicle.id, input.period.from, input.period.to);
    const activeDays = segments.reduce((sum, segment) => sum + (segment.profile ? dayCount(segment.from, segment.to) : 0), 0);
    let accruedTyres = 0;
    for (const segment of segments) {
      if (!segment.profile) continue;
      const share = activeDays > 0 ? (km * dayCount(segment.from, segment.to)) / activeDays : 0;
      accruedTyres += tyreAccrual(segment.profile, share, tyreDefault);
    }
    lines.tyres += accruedTyres;
    const running = lines.fuel + lines.toll + lines.maintenance + lines.tyres + lines.other;
    const standingLines = { driver: 0, finance: 0, insurance: 0, licences: 0, tracker: 0, other: 0 };
    let capital = 0;
    let sawProfile = false;
    let missingDepreciation = false;
    for (const segment of segments) {
      if (!segment.profile) continue;
      sawProfile = true;
      const part = standingFor(segment.profile, segment.from, segment.to).standing;
      standingLines.driver += part.driver;
      standingLines.finance += part.finance;
      standingLines.insurance += part.insurance;
      standingLines.licences += part.licences;
      standingLines.tracker += part.tracker;
      standingLines.other += part.other;
      const share = activeDays > 0 ? (km * dayCount(segment.from, segment.to)) / activeDays : 0;
      capital += capitalFor(segment.profile, segment.from, segment.to, segment.profile.depreciation_method === 'distance' ? share : km);
      if (segment.profile.purchase_price_cents == null || !(segment.profile.life_months || segment.profile.life_km)) missingDepreciation = true;
    }
    const standing =
      standingLines.driver +
      standingLines.finance +
      standingLines.insurance +
      standingLines.licences +
      standingLines.tracker +
      standingLines.other;
    const missing: string[] = [];
    if (!sawProfile) missing.push('no cost profile');
    else if (missingDepreciation) missing.push('no depreciation inputs');
    const hasRunningInput = inPeriod.some((row) => row.category !== 'fine' && row.category !== 'tyres') || accruedTyres > 0 || lines.tyres > 0;
    if (!hasRunningInput) missing.push('no running entries');
    const fuel = fuelEfficiency(entries);
    const loaded = finite(vehicle.loaded_km) ?? distance.loadedKmFromTrips;
    const target = pickTarget(input.targets, vehicle, input.period, 'fully_loaded');
    const periodDays = dayCount(input.period.from, input.period.to);
    const row: VehicleCpk = {
      vehicle_id: vehicle.id,
      status: 'ok',
      message: null,
      next_step: missing[0] ? `Add ${missing[0].replace(/^no /, '')}` : null,
      completeness: 'partial',
      missing,
      distance_source: distance.source,
      interpolated: distance.interpolated,
      total_km: km,
      loaded_km: loaded,
      running_cents: running,
      standing_cents: standing,
      capital_cents: capital,
      overhead_cents: 0,
      overhead_unallocated_cents: null,
      total_cents: running + standing + capital,
      running_per_km: running / km / 100,
      standing_per_km: standing / km / 100,
      capital_per_km: capital / km / 100,
      overhead_per_km: 0,
      fully_loaded_per_km: (running + standing + capital) / km / 100,
      operating_per_km: (running + standing) / km / 100,
      target_per_km: target,
      variance_per_km: null,
      variance_status: 'no_target',
      litres_per_100km: fuel.litresPer100,
      fuel_warnings: fuel.warnings,
      distance_warnings: distance.warnings,
      lumpy: periodDays < 60 && lines.maintenance > 0,
      utilisation: utilisationFor(vehicle, profile, events, input.period),
      breakeven_per_loaded_km: loaded && loaded > 0 ? (running + standing + capital) / loaded / 100 : null,
      profit_cents: vehicle.revenue_cents != null ? vehicle.revenue_cents - (running + standing + capital) : null,
      profit_per_km: null,
      margin: null,
      peer: { hidden: true },
      layer_lines: { running: lines, standing: standingLines },
    };
    if (row.profit_cents != null && km > 0) row.profit_per_km = row.profit_cents / km / 100;
    if (row.profit_cents != null && vehicle.revenue_cents) row.margin = row.profit_cents / vehicle.revenue_cents;
    const variance = varianceOf(row.fully_loaded_per_km, target);
    row.variance_per_km = variance.delta;
    row.variance_status = variance.status;
    return row;
  });

  allocateOverhead(drafts, input);
  for (const row of drafts) {
    if (row.status !== 'ok' || row.total_km == null || row.running_cents == null) continue;
    const overhead = row.overhead_cents || 0;
    row.total_cents = (row.running_cents || 0) + (row.standing_cents || 0) + (row.capital_cents || 0) + overhead;
    row.overhead_per_km = overhead / row.total_km / 100;
    row.fully_loaded_per_km = (row.total_cents || 0) / row.total_km / 100;
    row.operating_per_km = ((row.running_cents || 0) + (row.standing_cents || 0)) / row.total_km / 100;
    const variance = varianceOf(row.fully_loaded_per_km, row.target_per_km);
    row.variance_per_km = variance.delta;
    row.variance_status = variance.status;
    const vehicle = input.vehicles.find((item) => item.id === row.vehicle_id);
    if (row.loaded_km && row.loaded_km > 0 && row.total_cents != null) {
      row.breakeven_per_loaded_km = row.total_cents / row.loaded_km / 100;
    } else {
      row.breakeven_per_loaded_km = null;
    }
    if (vehicle?.revenue_cents != null && row.total_cents != null) {
      row.profit_cents = vehicle.revenue_cents - row.total_cents;
      row.profit_per_km = row.profit_cents / row.total_km / 100;
      row.margin = vehicle.revenue_cents > 0 ? row.profit_cents / vehicle.revenue_cents : null;
    }
    if (!row.missing.length) row.completeness = 'complete';
    const bare =
      (row.running_cents || 0) === 0 &&
      (row.standing_cents || 0) === 0 &&
      (row.capital_cents || 0) === 0 &&
      (row.overhead_cents || 0) === 0;
    if (bare) {
      row.status = 'not_enough_data';
      row.message = 'Not enough data';
      row.next_step = 'Add a cost profile and a running cost';
      row.completeness = 'none';
      row.fully_loaded_per_km = null;
      row.operating_per_km = null;
      row.running_per_km = null;
      row.standing_per_km = null;
      row.capital_per_km = null;
      row.overhead_per_km = null;
      row.variance_per_km = null;
      row.variance_status = 'no_target';
    }
  }
  applyPeers(drafts, input.vehicles);
  return drafts.map(sanitizeVehicle);
}

function profileSegments(
  profiles: CpkProfile[],
  vehicleId: string,
  from: string,
  to: string
): Array<{ profile: CpkProfile | null; from: string; to: string }> {
  const days = eachDay(from, to);
  if (!days.length) return [];
  const keyFor = (day: string) => {
    const profile = profileFor(profiles, vehicleId, day);
    if (!profile || !inFleet(profile, day)) return '';
    return `${profile.effective_from}|${profile.purchase_price_cents}|${profile.finance_monthly_cents}|${profile.driver_cost_monthly_cents}|${profile.depreciation_method}|${profile.tyre_mode}`;
  };
  const out: Array<{ profile: CpkProfile | null; from: string; to: string }> = [];
  let current = keyFor(days[0]);
  let start = days[0];
  for (let index = 1; index < days.length; index += 1) {
    const key = keyFor(days[index]);
    if (key === current) continue;
    out.push({ profile: current ? profileFor(profiles, vehicleId, start) : null, from: start, to: days[index] });
    current = key;
    start = days[index];
  }
  out.push({ profile: current ? profileFor(profiles, vehicleId, start) : null, from: start, to });
  return out;
}

function vehicleActiveOn(vehicle: CpkVehicleInput, profiles: CpkProfile[], events: CpkStatusEvent[], day: string): boolean {
  if (statusOn(events, vehicle.id, day) === 'sold') return false;
  const profile = profileFor(profiles, vehicle.id, day);
  if (profile) return inFleet(profile, day);
  return true;
}

function allocateOverhead(rows: VehicleCpk[], input: FleetCpkInput) {
  let unallocated = 0;
  const covered = new Set<string>();
  const pools = input.pools.filter((pool) => {
    const monthFrom = `${pool.period_month.slice(0, 7)}-01`;
    const monthTo = nextMonth(monthFrom);
    return monthTo > input.period.from.slice(0, 10) && monthFrom < input.period.to.slice(0, 10);
  });
  for (const pool of pools) {
    const monthFrom = `${pool.period_month.slice(0, 7)}-01`;
    const monthTo = nextMonth(monthFrom);
    const sliceFrom = monthFrom > input.period.from.slice(0, 10) ? monthFrom : input.period.from.slice(0, 10);
    const sliceTo = monthTo < input.period.to.slice(0, 10) ? monthTo : input.period.to.slice(0, 10);
    const monthDays = dayCount(monthFrom, monthTo);
    const sliceDays = dayCount(sliceFrom, sliceTo);
    if (monthDays <= 0 || sliceDays <= 0) continue;
    const amount = (pool.amount_cents * sliceDays) / monthDays;
    const events = input.statusEvents || [];
    const weights = input.vehicles.map((vehicle) => {
      if (vehicle.ownership === 'subcontractor' && !input.includeSubcontractors) return 0;
      const row = rows.find((item) => item.vehicle_id === vehicle.id);
      if (pool.basis === 'km') return row?.total_km || 0;
      if (pool.basis === 'revenue') return Math.max(0, vehicle.revenue_cents || 0);
      return eachDay(sliceFrom, sliceTo).filter((day) => vehicleActiveOn(vehicle, input.profiles, events, day)).length;
    });
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight <= 0) {
      unallocated += amount;
      continue;
    }
    let assigned = 0;
    input.vehicles.forEach((vehicle, index) => {
      const row = rows.find((item) => item.vehicle_id === vehicle.id);
      if (!row || weights[index] <= 0) return;
      covered.add(vehicle.id);
      const share = (amount * weights[index]) / totalWeight;
      row.overhead_cents = (row.overhead_cents || 0) + share;
      assigned += share;
    });
    unallocated += amount - assigned;
  }
  for (const row of rows) {
    row.overhead_unallocated_cents = unallocated;
    if (row.status !== 'ok') continue;
    if (!covered.has(row.vehicle_id) && pools.length === 0) row.missing = [...row.missing, 'no overhead pool'];
    else if (!covered.has(row.vehicle_id) && pools.length > 0 && (row.overhead_cents || 0) === 0) {
      row.missing = [...row.missing, 'no overhead pool'];
    }
  }
}

function nextMonth(from: string): string {
  const [y, m] = from.slice(0, 7).split('-').map(Number);
  if (m === 12) return `${y + 1}-01-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

function applyPeers(rows: VehicleCpk[], vehicles: CpkVehicleInput[]) {
  for (const row of rows) {
    if (row.fully_loaded_per_km == null) {
      row.peer = { hidden: true };
      continue;
    }
    const kind = vehicles.find((vehicle) => vehicle.id === row.vehicle_id)?.kind;
    const peers = rows.filter((other) => {
      if (other.vehicle_id === row.vehicle_id || other.fully_loaded_per_km == null) return false;
      return vehicles.find((vehicle) => vehicle.id === other.vehicle_id)?.kind === kind;
    });
    if (peers.length < 3) {
      row.peer = { hidden: true };
      continue;
    }
    const avg = peers.reduce((sum, peer) => sum + (peer.fully_loaded_per_km || 0), 0) / peers.length;
    row.peer = { hidden: false, delta_per_km: row.fully_loaded_per_km - avg };
  }
}

function sanitizeVehicle(row: VehicleCpk): VehicleCpk {
  const num = (value: number | null): number | null => (value != null && Number.isFinite(value) ? value : null);
  return {
    ...row,
    total_km: num(row.total_km),
    loaded_km: num(row.loaded_km),
    running_cents: num(row.running_cents),
    standing_cents: num(row.standing_cents),
    capital_cents: num(row.capital_cents),
    overhead_cents: num(row.overhead_cents),
    overhead_unallocated_cents: num(row.overhead_unallocated_cents),
    total_cents: num(row.total_cents),
    running_per_km: num(row.running_per_km),
    standing_per_km: num(row.standing_per_km),
    capital_per_km: num(row.capital_per_km),
    overhead_per_km: num(row.overhead_per_km),
    fully_loaded_per_km: num(row.fully_loaded_per_km),
    operating_per_km: num(row.operating_per_km),
    target_per_km: num(row.target_per_km),
    variance_per_km: num(row.variance_per_km),
    litres_per_100km: num(row.litres_per_100km),
    breakeven_per_loaded_km: num(row.breakeven_per_loaded_km),
    profit_cents: num(row.profit_cents),
    profit_per_km: num(row.profit_per_km),
    margin: num(row.margin),
    peer: row.peer.hidden ? { hidden: true } : { hidden: false, delta_per_km: num(row.peer.delta_per_km) || 0 },
  };
}

export function requiredRate(breakevenPerKm: number | null, margin: number): number | null {
  if (breakevenPerKm == null || !Number.isFinite(breakevenPerKm) || margin >= 1 || margin < 0) return null;
  const rate = breakevenPerKm / (1 - margin);
  return Number.isFinite(rate) ? rate : null;
}

export function estimateTripCost(input: {
  directCents: number;
  maintenancePerKm: number;
  tyrePerKm: number;
  standingPerDay: number;
  capitalPerDay: number;
  overheadPerDay: number;
  tripKm: number;
  durationHours: number;
  assumeEmptyReturn?: boolean;
  returnKm?: number;
}): { costCents: number; days: number } {
  const days = Math.max(1, Math.ceil((input.durationHours || 0) / 24));
  const running = (input.maintenancePerKm + input.tyrePerKm) * Math.max(0, input.tripKm);
  const daily = input.standingPerDay + input.capitalPerDay + input.overheadPerDay;
  let cost = input.directCents + running + daily * days;
  let usedDays = days;
  if (input.assumeEmptyReturn) {
    cost += (input.maintenancePerKm + input.tyrePerKm) * Math.max(0, input.returnKm || input.tripKm);
    cost += daily;
    usedDays += 1;
  }
  return { costCents: Number.isFinite(cost) ? cost : 0, days: usedDays };
}

export function laneCpk(trips: Array<{ km: number; costCents: number }>, minTrips: number): { cpk: number | null; hidden: boolean } {
  if (trips.length < minTrips) return { cpk: null, hidden: true };
  const km = trips.reduce((sum, trip) => sum + trip.km, 0);
  const cost = trips.reduce((sum, trip) => sum + trip.costCents, 0);
  if (km <= 0) return { cpk: null, hidden: true };
  return { cpk: cost / km / 100, hidden: false };
}

export function allocateCustomerCost(
  jobs: Array<{ id: string; loaded_km?: number | null; mass_kg?: number | null }>,
  tripCostCents: number,
  tripKm: number
): Array<{ id: string; costCents: number; km: number; rule: string }> {
  const loaded = jobs.every((job) => (job.loaded_km || 0) > 0);
  const mass = jobs.every((job) => (job.mass_kg || 0) > 0);
  const rule = loaded ? 'loaded km' : mass ? 'mass' : 'equal';
  const weights = jobs.map((job) => {
    if (loaded) return job.loaded_km || 0;
    if (mass) return (job.mass_kg || 0) * tripKm;
    return 1;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0) || jobs.length || 1;
  return jobs.map((job, index) => ({
    id: job.id,
    costCents: (tripCostCents * (weights[index] || 0)) / total,
    km: (tripKm * (weights[index] || 0)) / total,
    rule,
  }));
}

export function driverVariance(driverPerKm: number | null, baselinePerKm: number | null): number | null {
  if (driverPerKm == null || baselinePerKm == null) return null;
  if (!Number.isFinite(driverPerKm) || !Number.isFinite(baselinePerKm)) return null;
  return driverPerKm - baselinePerKm;
}

export function trailingPerKm(cents: number, km: number): number | null {
  if (!Number.isFinite(cents) || !Number.isFinite(km) || km <= 0) return null;
  return cents / km;
}
