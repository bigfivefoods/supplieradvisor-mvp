/**
 * Quarrygraph® — primary-sector OS for quarrying & aggregates.
 * Sites, reserves, production, plant, stockpiles, weighbridge, fleet,
 * labour rates, quality, permits, trade. Stored on profiles.metadata.quarrygraph.
 */

export const QUARRYGRAPH_MODULE_ID = 'quarrygraph' as const;
export const QUARRYGRAPH_META_KEY = 'quarrygraph';

export const MATERIAL_TYPES = [
  'Granite',
  'Dolerite',
  'Basalt',
  'Sandstone',
  'Limestone',
  'Quartzite',
  'Alluvial sand',
  'Crusher sand',
  'Grit',
  'Clay / spoil',
  'Mixed / other',
] as const;

/** Common SA road / construction aggregate grades */
export const PRODUCT_GRADES = [
  'G1',
  'G2',
  'G3',
  'G4',
  'G5',
  'G6',
  'G7',
  '19mm concrete stone',
  '13.2mm concrete stone',
  '9.5mm concrete stone',
  'Crusher sand',
  'Building sand',
  'Plaster sand',
  'Ballast',
  'Dump rock',
  'Fill / spoil',
  'Other',
] as const;

/**
 * Top-level quarry / operation (estate). A company can run many quarries;
 * each has pits/faces (sites), plant and fleet home base.
 */
export type QuarryOperation = {
  id: string;
  code: string;
  name: string;
  /** Trading / brand for this quarry */
  trading_name?: string;
  district?: string;
  province?: string;
  country?: string;
  manager?: string;
  phone?: string;
  email?: string;
  mining_right_ref?: string;
  water_use_licence?: string;
  emp_ref?: string;
  lat?: number | null;
  lng?: number | null;
  /** Target daily production tonnes */
  target_daily_t?: number | null;
  notes?: string;
  active?: boolean;
  created_at: string;
  updated_at: string;
};

export type QuarrySite = {
  id: string;
  code: string;
  name: string;
  /** Parent quarry operation (multi-quarry) */
  quarry_id?: string | null;
  /** Legacy free-text — prefer quarry_id */
  quarry_name?: string;
  material: string;
  /** Operating pit / face */
  face?: string;
  hectares?: number | null;
  /** Mining right / permit ref */
  mining_right_ref?: string;
  water_use_licence?: string;
  emp_ref?: string;
  district?: string;
  province?: string;
  lat?: number | null;
  lng?: number | null;
  notes?: string;
  active?: boolean;
  created_at: string;
  updated_at: string;
};

export const VEHICLE_TYPES = [
  'Excavator',
  'ADT',
  'Rigid dump truck',
  'Loader',
  'Dozer',
  'Drill',
  'Grader',
  'Water truck',
  'Service truck',
  'Crusher plant',
  'Screen plant',
  'Generator',
  'Other',
] as const;

export const VEHICLE_STATUSES = [
  'available',
  'working',
  'standby',
  'maintenance',
  'breakdown',
  'hired_out',
] as const;

export type AggregateProduct = {
  id: string;
  code: string;
  name: string;
  grade: string;
  material?: string;
  /** Typical density t/m³ for volume conversions */
  density_t_m3?: number | null;
  unit: 't' | 'm3';
  active?: boolean;
  notes?: string;
  created_at: string;
};

export type ReserveEstimate = {
  id: string;
  site_id: string;
  product_id?: string | null;
  season: string;
  /** Estimated recoverable tonnes */
  tonnes: number;
  /** Quality e.g. CS (crushing strength) or % pass */
  quality_metric?: number | null;
  quality_label?: string;
  status: 'draft' | 'surveyed' | 'approved' | 'depleted' | 'revised';
  revision?: number;
  notes?: string;
  updated_at: string;
};

export type ProductionPlanItem = {
  id: string;
  site_id: string;
  product_id?: string | null;
  season: string;
  sequence: number;
  planned_date?: string | null;
  planned_end_date?: string | null;
  days?: number | null;
  estimated_tonnes?: number | null;
  daily_allocation_t?: number | null;
  destination?: string;
  status: 'planned' | 'blasting' | 'loading' | 'done' | 'held';
  notes?: string;
  updated_at: string;
};

export type BlastLog = {
  id: string;
  site_id: string;
  date: string;
  blast_no?: string;
  holes?: number | null;
  explosives_kg?: number | null;
  estimated_broken_t?: number | null;
  measured_t?: number | null;
  product_id?: string | null;
  notes?: string;
  created_at: string;
};

export type PlantRun = {
  id: string;
  site_id?: string | null;
  date: string;
  plant_name: string;
  /** Hours the crusher / screen ran */
  hours?: number | null;
  feed_tonnes?: number | null;
  product_id?: string | null;
  output_tonnes?: number | null;
  downtime_min?: number | null;
  notes?: string;
  created_at: string;
};

export type Stockpile = {
  id: string;
  site_id?: string | null;
  product_id: string;
  name: string;
  /** Surveyed / book balance tonnes */
  tonnes: number;
  last_survey_at?: string | null;
  notes?: string;
  updated_at: string;
};

export type DispatchTicket = {
  id: string;
  date: string;
  ticket_no?: string;
  site_id?: string | null;
  product_id?: string | null;
  stockpile_id?: string | null;
  customer?: string;
  vehicle_reg?: string;
  /** Net mass from weighbridge */
  net_tonnes: number;
  destination?: string;
  order_ref?: string;
  docket_photo_url?: string;
  status: 'weighed' | 'dispatched' | 'delivered' | 'void';
  notes?: string;
  created_at: string;
};

export type QuarryVehicle = {
  id: string;
  code: string;
  name: string;
  type?: string;
  reg_no?: string;
  make?: string;
  model?: string;
  year?: number | null;
  /** owned | hired | contractor */
  ownership?: 'owned' | 'hired' | 'contractor' | string;
  status?: (typeof VEHICLE_STATUSES)[number] | string;
  /** Home quarry for multi-site fleets */
  quarry_id?: string | null;
  home_site_id?: string | null;
  fuel_capacity_l?: number | null;
  /** Book / meter readings */
  odometer_km?: number | null;
  engine_hours?: number | null;
  /** Target utilisation hours / day for metrics */
  target_hours_day?: number | null;
  /** Optional operating cost inputs */
  cost_per_hour_zar?: number | null;
  cost_per_km_zar?: number | null;
  fuel_burn_l_h?: number | null;
  operator?: string;
  last_service_at?: string | null;
  next_service_hours?: number | null;
  notes?: string;
  active?: boolean;
  created_at: string;
  updated_at?: string;
};

export type QuarryFleetLog = {
  id: string;
  site_id?: string | null;
  quarry_id?: string | null;
  vehicle_id?: string | null;
  date: string;
  vehicle: string;
  activity: string;
  hours?: number | null;
  /** Engine hours at end of shift */
  engine_hours_end?: number | null;
  idle_hours?: number | null;
  fuel_l?: number | null;
  tonnes_moved?: number | null;
  loads?: number | null;
  odometer_km?: number | null;
  /** Optional shift cost override */
  cost_zar?: number | null;
  operator?: string;
  notes?: string;
  created_at: string;
};

export type LabourRateUnit =
  | 'per_hour'
  | 'per_day'
  | 'per_person_hour'
  | 'per_person_day'
  | 'per_tonne'
  | 'per_task';

export type LabourEmploymentType =
  | 'permanent'
  | 'temporary'
  | 'contractor'
  | 'gang';

export type QuarryCrew = {
  id: string;
  code: string;
  name: string;
  employment_type: LabourEmploymentType;
  rate_zar: number;
  rate_unit: LabourRateUnit;
  active?: boolean;
  notes?: string;
  created_at: string;
};

export type QuarryLabourLog = {
  id: string;
  site_id?: string | null;
  crew_id?: string | null;
  date: string;
  crew_or_person: string;
  activity: string;
  employment_type?: LabourEmploymentType;
  headcount?: number | null;
  hours?: number | null;
  quantity?: number | null;
  rate_zar?: number | null;
  rate_unit?: LabourRateUnit | null;
  cost_zar?: number | null;
  notes?: string;
  created_at: string;
};

export type QualityTest = {
  id: string;
  site_id?: string | null;
  product_id?: string | null;
  date: string;
  sample_ref?: string;
  /** e.g. CS, ACV, PI, grading % */
  test_type: string;
  result?: number | null;
  unit?: string;
  pass_fail?: 'pass' | 'fail' | 'pending' | null;
  lab?: string;
  notes?: string;
  created_at: string;
};

export type CompliancePermit = {
  id: string;
  site_id?: string | null;
  type: string;
  ref_no: string;
  issued_at?: string | null;
  expires_at?: string | null;
  status: 'valid' | 'expiring' | 'expired' | 'pending' | 'suspended';
  notes?: string;
  created_at: string;
};

export type QuarrygraphStore = {
  /** Multi-quarry registry (operations / estates) */
  quarries: QuarryOperation[];
  sites: QuarrySite[];
  products: AggregateProduct[];
  reserves: ReserveEstimate[];
  production_plan: ProductionPlanItem[];
  blasts: BlastLog[];
  plant_runs: PlantRun[];
  stockpiles: Stockpile[];
  dispatches: DispatchTicket[];
  vehicles: QuarryVehicle[];
  fleet_logs: QuarryFleetLog[];
  crews: QuarryCrew[];
  labour_logs: QuarryLabourLog[];
  quality_tests: QualityTest[];
  permits: CompliancePermit[];
  updated_at?: string;
};

export function emptyQuarrygraphStore(): QuarrygraphStore {
  return {
    quarries: [],
    sites: [],
    products: [],
    reserves: [],
    production_plan: [],
    blasts: [],
    plant_runs: [],
    stockpiles: [],
    dispatches: [],
    vehicles: [],
    fleet_logs: [],
    crews: [],
    labour_logs: [],
    quality_tests: [],
    permits: [],
  };
}

export function quarryById(store: QuarrygraphStore, id?: string | null) {
  if (!id) return undefined;
  return store.quarries.find((q) => q.id === id);
}

export function resolveSiteQuarryId(
  store: QuarrygraphStore,
  siteId?: string | null
): string | null {
  if (!siteId) return null;
  const site = store.sites.find((s) => s.id === siteId);
  return site?.quarry_id || null;
}

export function readQuarrygraphFromMetadata(
  meta: Record<string, unknown> | null | undefined
): QuarrygraphStore {
  if (!meta || typeof meta !== 'object') return emptyQuarrygraphStore();
  const raw = meta[QUARRYGRAPH_META_KEY];
  if (!raw || typeof raw !== 'object') return emptyQuarrygraphStore();
  const s = raw as Partial<QuarrygraphStore>;
  const e = emptyQuarrygraphStore();
  for (const key of Object.keys(e) as Array<keyof QuarrygraphStore>) {
    if (key === 'updated_at') continue;
    const v = s[key];
    (e as Record<string, unknown>)[key] = Array.isArray(v) ? v : [];
  }
  e.updated_at = s.updated_at ? String(s.updated_at) : undefined;
  return e;
}

export function writeQuarrygraphToMetadata(
  meta: Record<string, unknown>,
  store: QuarrygraphStore
): Record<string, unknown> {
  return {
    ...meta,
    [QUARRYGRAPH_META_KEY]: {
      ...store,
      updated_at: new Date().toISOString(),
    },
  };
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function siteById(store: QuarrygraphStore, id: string) {
  return store.sites.find((s) => s.id === id);
}

export function productById(store: QuarrygraphStore, id: string) {
  return store.products.find((p) => p.id === id);
}

export function computeLabourCost(input: {
  rate_zar?: number | null;
  rate_unit?: LabourRateUnit | null;
  headcount?: number | null;
  hours?: number | null;
  quantity?: number | null;
}): number | null {
  const rate = Number(input.rate_zar);
  if (!(rate > 0) || !input.rate_unit) return null;
  const hc = Math.max(0, Number(input.headcount) || 0);
  const hrs = Math.max(0, Number(input.hours) || 0);
  const qty = Math.max(0, Number(input.quantity) || 0);
  let cost = 0;
  switch (input.rate_unit) {
    case 'per_person_hour':
      cost = rate * (hc || 1) * (hrs || 0);
      break;
    case 'per_person_day':
      cost = rate * (hc || 1) * (hrs > 0 ? hrs / 8 : 1);
      break;
    case 'per_hour':
      cost = rate * (hrs || 0);
      break;
    case 'per_day':
      cost = rate * (hrs > 0 ? hrs / 8 : 1);
      break;
    case 'per_tonne':
    case 'per_task':
      cost = rate * (qty || 0);
      break;
    default:
      return null;
  }
  return Math.round(cost * 100) / 100;
}

/**
 * Production planner: sequence + estimated tonnes + daily allocation → dates.
 */
export function projectProductionDates(
  items: ProductionPlanItem[],
  reserves: ReserveEstimate[],
  season: string,
  startDate: string,
  dailyAllocationT: number
): ProductionPlanItem[] {
  if (!(dailyAllocationT > 0)) return items;
  let cursor = new Date(startDate + 'T12:00:00');
  if (Number.isNaN(cursor.getTime())) cursor = new Date();

  const seasonItems = items
    .filter((h) => h.season === season)
    .sort((a, b) => a.sequence - b.sequence);

  const updated = [...items];
  for (const item of seasonItems) {
    const res = reserves.find(
      (r) =>
        r.site_id === item.site_id &&
        r.season === season &&
        r.status !== 'draft' &&
        r.status !== 'depleted'
    );
    const tonnes =
      Number(item.estimated_tonnes) || Number(res?.tonnes) || 0;
    const days = Math.max(1, Math.ceil(tonnes / dailyAllocationT));
    const planned = cursor.toISOString().slice(0, 10);
    const end = new Date(cursor);
    end.setDate(end.getDate() + days - 1);
    const idx = updated.findIndex((x) => x.id === item.id);
    if (idx >= 0) {
      updated[idx] = {
        ...updated[idx],
        planned_date: planned,
        planned_end_date: end.toISOString().slice(0, 10),
        days,
        estimated_tonnes: tonnes || updated[idx].estimated_tonnes,
        daily_allocation_t: dailyAllocationT,
        updated_at: new Date().toISOString(),
      };
    }
    cursor.setDate(cursor.getDate() + days);
  }
  return updated;
}

export function summariseQuarrygraph(store: QuarrygraphStore) {
  const quarries = (store.quarries || []).filter((q) => q.active !== false);
  const sites = store.sites.filter((s) => s.active !== false);
  const products = store.products.filter((p) => p.active !== false);
  const vehicles = store.vehicles.filter((v) => v.active !== false);
  const reserveT = store.reserves
    .filter((r) => r.status !== 'draft' && r.status !== 'depleted')
    .reduce((n, r) => n + (Number(r.tonnes) || 0), 0);
  const stockT = store.stockpiles.reduce(
    (n, s) => n + (Number(s.tonnes) || 0),
    0
  );
  const dispatchT = store.dispatches
    .filter((d) => d.status !== 'void')
    .reduce((n, d) => n + (Number(d.net_tonnes) || 0), 0);
  const plantOut = store.plant_runs.reduce(
    (n, r) => n + (Number(r.output_tonnes) || 0),
    0
  );
  const blastT = store.blasts.reduce(
    (n, b) => n + (Number(b.measured_t || b.estimated_broken_t) || 0),
    0
  );
  const fuel = store.fleet_logs.reduce(
    (n, l) => n + (Number(l.fuel_l) || 0),
    0
  );
  const hours = store.fleet_logs.reduce(
    (n, l) => n + (Number(l.hours) || 0),
    0
  );
  const idle = store.fleet_logs.reduce(
    (n, l) => n + (Number(l.idle_hours) || 0),
    0
  );
  const labourCost = store.labour_logs.reduce(
    (n, l) => n + (Number(l.cost_zar) || 0),
    0
  );
  const fleetCost = store.fleet_logs.reduce((n, l) => {
    if (l.cost_zar != null) return n + (Number(l.cost_zar) || 0);
    const v = store.vehicles.find((x) => x.id === l.vehicle_id);
    const h = Number(l.hours) || 0;
    return n + h * (Number(v?.cost_per_hour_zar) || 0);
  }, 0);
  const planOpen = store.production_plan.filter(
    (p) =>
      p.status === 'planned' ||
      p.status === 'blasting' ||
      p.status === 'loading'
  ).length;
  const permitsExpiring = store.permits.filter(
    (p) => p.status === 'expiring' || p.status === 'expired'
  ).length;
  const qaFail = store.quality_tests.filter((q) => q.pass_fail === 'fail')
    .length;
  const working = vehicles.filter(
    (v) => v.status === 'working' || v.status === 'available'
  ).length;
  const down = vehicles.filter(
    (v) => v.status === 'maintenance' || v.status === 'breakdown'
  ).length;
  const tonnesMoved = store.fleet_logs.reduce(
    (n, l) => n + (Number(l.tonnes_moved) || 0),
    0
  );

  return {
    quarryCount: quarries.length,
    siteCount: sites.length,
    productCount: products.length,
    reserveTonnes: Math.round(reserveT * 10) / 10,
    stockpileTonnes: Math.round(stockT * 10) / 10,
    dispatchedTonnes: Math.round(dispatchT * 10) / 10,
    plantOutputTonnes: Math.round(plantOut * 10) / 10,
    blastTonnes: Math.round(blastT * 10) / 10,
    productionOpen: planOpen,
    vehicleCount: vehicles.length,
    vehiclesWorking: working,
    vehiclesDown: down,
    fleetHours: Math.round(hours * 10) / 10,
    fleetIdleHours: Math.round(idle * 10) / 10,
    fuelTotalL: Math.round(fuel * 10) / 10,
    tonnesMovedFleet: Math.round(tonnesMoved * 10) / 10,
    tPerHour:
      hours > 0 ? Math.round((tonnesMoved / hours) * 100) / 100 : null,
    lPerTonne:
      tonnesMoved > 0 ? Math.round((fuel / tonnesMoved) * 100) / 100 : null,
    fleetCostZar: Math.round(fleetCost * 100) / 100,
    crewCount: store.crews.filter((c) => c.active !== false).length,
    labourCostZar: Math.round(labourCost * 100) / 100,
    costPerDispatchT:
      dispatchT > 0
        ? Math.round(((labourCost + fleetCost) / dispatchT) * 100) / 100
        : null,
    qualityTests: store.quality_tests.length,
    qualityFails: qaFail,
    permits: store.permits.length,
    permitsExpiring,
    dispatches: store.dispatches.length,
  };
}

export function productionByProduct(store: QuarrygraphStore): Array<{
  product: string;
  grade: string;
  plant_t: number;
  dispatch_t: number;
  stock_t: number;
}> {
  const map = new Map<
    string,
    { product: string; grade: string; plant_t: number; dispatch_t: number; stock_t: number }
  >();
  for (const p of store.products) {
    map.set(p.id, {
      product: p.name,
      grade: p.grade,
      plant_t: 0,
      dispatch_t: 0,
      stock_t: 0,
    });
  }
  for (const r of store.plant_runs) {
    if (!r.product_id) continue;
    const row = map.get(r.product_id);
    if (row) row.plant_t += Number(r.output_tonnes) || 0;
  }
  for (const d of store.dispatches) {
    if (!d.product_id || d.status === 'void') continue;
    const row = map.get(d.product_id);
    if (row) row.dispatch_t += Number(d.net_tonnes) || 0;
  }
  for (const s of store.stockpiles) {
    const row = map.get(s.product_id);
    if (row) row.stock_t += Number(s.tonnes) || 0;
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      plant_t: Math.round(r.plant_t * 10) / 10,
      dispatch_t: Math.round(r.dispatch_t * 10) / 10,
      stock_t: Math.round(r.stock_t * 10) / 10,
    }))
    .sort((a, b) => b.dispatch_t - a.dispatch_t);
}

export type VehicleMetricsRow = {
  vehicle_id: string | null;
  vehicle: string;
  code: string;
  type: string;
  status: string;
  ownership: string;
  quarry: string;
  logs: number;
  hours: number;
  idle_hours: number;
  fuel_l: number;
  tonnes_moved: number;
  loads: number;
  l_per_hour: number | null;
  t_per_hour: number | null;
  l_per_tonne: number | null;
  util_pct: number | null;
  cost_zar: number;
  cost_per_t: number | null;
  engine_hours: number | null;
  odometer_km: number | null;
};

/** Full vehicle KPI board from registry + logs */
export function vehicleMetrics(store: QuarrygraphStore): VehicleMetricsRow[] {
  const byId = new Map<
    string,
    {
      vehicle_id: string | null;
      vehicle: string;
      code: string;
      type: string;
      status: string;
      ownership: string;
      quarry: string;
      logs: number;
      hours: number;
      idle_hours: number;
      fuel_l: number;
      tonnes_moved: number;
      loads: number;
      cost_zar: number;
      engine_hours: number | null;
      odometer_km: number | null;
      target_hours_day: number;
    }
  >();

  for (const v of store.vehicles) {
    const q = quarryById(store, v.quarry_id);
    byId.set(v.id, {
      vehicle_id: v.id,
      vehicle: v.name,
      code: v.code,
      type: v.type || 'Other',
      status: v.status || 'available',
      ownership: v.ownership || 'owned',
      quarry: q?.code || q?.name || '—',
      logs: 0,
      hours: 0,
      idle_hours: 0,
      fuel_l: 0,
      tonnes_moved: 0,
      loads: 0,
      cost_zar: 0,
      engine_hours: v.engine_hours ?? null,
      odometer_km: v.odometer_km ?? null,
      target_hours_day: Number(v.target_hours_day) || 8,
    });
  }

  for (const log of store.fleet_logs) {
    const key = log.vehicle_id || log.vehicle;
    let row = log.vehicle_id ? byId.get(log.vehicle_id) : undefined;
    if (!row) {
      row = {
        vehicle_id: log.vehicle_id || null,
        vehicle: log.vehicle,
        code: '—',
        type: 'Other',
        status: '—',
        ownership: '—',
        quarry: '—',
        logs: 0,
        hours: 0,
        idle_hours: 0,
        fuel_l: 0,
        tonnes_moved: 0,
        loads: 0,
        cost_zar: 0,
        engine_hours: null,
        odometer_km: null,
        target_hours_day: 8,
      };
      byId.set(key, row);
    }
    const v = store.vehicles.find((x) => x.id === log.vehicle_id);
    const h = Number(log.hours) || 0;
    row.logs += 1;
    row.hours += h;
    row.idle_hours += Number(log.idle_hours) || 0;
    row.fuel_l += Number(log.fuel_l) || 0;
    row.tonnes_moved += Number(log.tonnes_moved) || 0;
    row.loads += Number(log.loads) || 0;
    if (log.cost_zar != null) row.cost_zar += Number(log.cost_zar) || 0;
    else row.cost_zar += h * (Number(v?.cost_per_hour_zar) || 0);
    if (log.engine_hours_end != null) row.engine_hours = Number(log.engine_hours_end);
    if (log.odometer_km != null) row.odometer_km = Number(log.odometer_km);
  }

  return [...byId.values()]
    .map((r) => {
      const days = Math.max(1, r.logs);
      const target = r.target_hours_day * days;
      return {
        vehicle_id: r.vehicle_id,
        vehicle: r.vehicle,
        code: r.code,
        type: r.type,
        status: r.status,
        ownership: r.ownership,
        quarry: r.quarry,
        logs: r.logs,
        hours: Math.round(r.hours * 10) / 10,
        idle_hours: Math.round(r.idle_hours * 10) / 10,
        fuel_l: Math.round(r.fuel_l * 10) / 10,
        tonnes_moved: Math.round(r.tonnes_moved * 10) / 10,
        loads: r.loads,
        l_per_hour:
          r.hours > 0 ? Math.round((r.fuel_l / r.hours) * 100) / 100 : null,
        t_per_hour:
          r.hours > 0
            ? Math.round((r.tonnes_moved / r.hours) * 100) / 100
            : null,
        l_per_tonne:
          r.tonnes_moved > 0
            ? Math.round((r.fuel_l / r.tonnes_moved) * 100) / 100
            : null,
        util_pct:
          target > 0
            ? Math.round((r.hours / target) * 1000) / 10
            : null,
        cost_zar: Math.round(r.cost_zar * 100) / 100,
        cost_per_t:
          r.tonnes_moved > 0
            ? Math.round((r.cost_zar / r.tonnes_moved) * 100) / 100
            : null,
        engine_hours: r.engine_hours,
        odometer_km: r.odometer_km,
      };
    })
    .sort((a, b) => b.hours - a.hours);
}

/** @deprecated use vehicleMetrics */
export function vehicleUtilisation(store: QuarrygraphStore) {
  return vehicleMetrics(store).map((r) => ({
    vehicle: r.vehicle,
    vehicle_id: r.vehicle_id,
    logs: r.logs,
    hours: r.hours,
    fuel_l: r.fuel_l,
    tonnes_moved: r.tonnes_moved,
    l_per_hour: r.l_per_hour,
  }));
}

/** Roll-up KPIs per quarry operation */
export function reportByQuarry(store: QuarrygraphStore) {
  const map = new Map<
    string,
    {
      quarry_id: string;
      code: string;
      name: string;
      sites: number;
      reserves_t: number;
      plant_t: number;
      dispatch_t: number;
      stock_t: number;
      blast_t: number;
      fuel_l: number;
      fleet_hours: number;
      labour_zar: number;
      vehicles: number;
    }
  >();

  for (const q of store.quarries || []) {
    map.set(q.id, {
      quarry_id: q.id,
      code: q.code,
      name: q.name,
      sites: 0,
      reserves_t: 0,
      plant_t: 0,
      dispatch_t: 0,
      stock_t: 0,
      blast_t: 0,
      fuel_l: 0,
      fleet_hours: 0,
      labour_zar: 0,
      vehicles: 0,
    });
  }
  // orphan bucket
  map.set('_none', {
    quarry_id: '',
    code: '—',
    name: 'Unassigned',
    sites: 0,
    reserves_t: 0,
    plant_t: 0,
    dispatch_t: 0,
    stock_t: 0,
    blast_t: 0,
    fuel_l: 0,
    fleet_hours: 0,
    labour_zar: 0,
    vehicles: 0,
  });

  const siteToQ = new Map<string, string>();
  for (const s of store.sites) {
    const qid = s.quarry_id || '_none';
    siteToQ.set(s.id, qid);
    const row = map.get(qid) || map.get('_none')!;
    if (s.active !== false) row.sites += 1;
  }

  for (const r of store.reserves) {
    if (r.status === 'draft' || r.status === 'depleted') continue;
    const qid = siteToQ.get(r.site_id) || '_none';
    const row = map.get(qid);
    if (row) row.reserves_t += Number(r.tonnes) || 0;
  }
  for (const p of store.plant_runs) {
    const qid = p.site_id
      ? siteToQ.get(p.site_id) || '_none'
      : '_none';
    const row = map.get(qid);
    if (row) row.plant_t += Number(p.output_tonnes) || 0;
  }
  for (const d of store.dispatches) {
    if (d.status === 'void') continue;
    const qid = d.site_id ? siteToQ.get(d.site_id) || '_none' : '_none';
    const row = map.get(qid);
    if (row) row.dispatch_t += Number(d.net_tonnes) || 0;
  }
  for (const s of store.stockpiles) {
    const qid = s.site_id ? siteToQ.get(s.site_id) || '_none' : '_none';
    const row = map.get(qid);
    if (row) row.stock_t += Number(s.tonnes) || 0;
  }
  for (const b of store.blasts) {
    const qid = siteToQ.get(b.site_id) || '_none';
    const row = map.get(qid);
    if (row)
      row.blast_t += Number(b.measured_t || b.estimated_broken_t) || 0;
  }
  for (const l of store.fleet_logs) {
    const qid =
      l.quarry_id ||
      (l.site_id ? siteToQ.get(l.site_id) : null) ||
      '_none';
    const row = map.get(qid);
    if (row) {
      row.fuel_l += Number(l.fuel_l) || 0;
      row.fleet_hours += Number(l.hours) || 0;
    }
  }
  for (const l of store.labour_logs) {
    const qid = l.site_id ? siteToQ.get(l.site_id) || '_none' : '_none';
    const row = map.get(qid);
    if (row) row.labour_zar += Number(l.cost_zar) || 0;
  }
  for (const v of store.vehicles) {
    const qid = v.quarry_id || '_none';
    const row = map.get(qid);
    if (row && v.active !== false) row.vehicles += 1;
  }

  return [...map.values()]
    .filter((r) => r.quarry_id || r.sites || r.dispatch_t || r.plant_t)
    .map((r) => ({
      ...r,
      reserves_t: Math.round(r.reserves_t * 10) / 10,
      plant_t: Math.round(r.plant_t * 10) / 10,
      dispatch_t: Math.round(r.dispatch_t * 10) / 10,
      stock_t: Math.round(r.stock_t * 10) / 10,
      blast_t: Math.round(r.blast_t * 10) / 10,
      fuel_l: Math.round(r.fuel_l * 10) / 10,
      fleet_hours: Math.round(r.fleet_hours * 10) / 10,
      labour_zar: Math.round(r.labour_zar * 100) / 100,
      cost_per_t:
        r.dispatch_t > 0
          ? Math.round((r.labour_zar / r.dispatch_t) * 100) / 100
          : null,
    }))
    .sort((a, b) => b.dispatch_t - a.dispatch_t);
}

/** Key management reports for the module */
export function buildKeyReports(store: QuarrygraphStore) {
  const summary = summariseQuarrygraph(store);
  return {
    summary,
    byQuarry: reportByQuarry(store),
    byProduct: productionByProduct(store),
    vehicleMetrics: vehicleMetrics(store),
    labourCost: labourCostSummary(store),
    /** Dispatch vs plant vs stock balance */
    productBalance: productionByProduct(store).map((p) => ({
      ...p,
      gap_plant_vs_dispatch: Math.round((p.plant_t - p.dispatch_t) * 10) / 10,
    })),
    /** Fleet type roll-up */
    fleetByType: (() => {
      const m = new Map<
        string,
        { type: string; vehicles: number; hours: number; fuel_l: number; tonnes: number }
      >();
      for (const v of vehicleMetrics(store)) {
        const row = m.get(v.type) || {
          type: v.type,
          vehicles: 0,
          hours: 0,
          fuel_l: 0,
          tonnes: 0,
        };
        row.vehicles += 1;
        row.hours += v.hours;
        row.fuel_l += v.fuel_l;
        row.tonnes += v.tonnes_moved;
        m.set(v.type, row);
      }
      return [...m.values()]
        .map((r) => ({
          ...r,
          hours: Math.round(r.hours * 10) / 10,
          fuel_l: Math.round(r.fuel_l * 10) / 10,
          tonnes: Math.round(r.tonnes * 10) / 10,
        }))
        .sort((a, b) => b.hours - a.hours);
    })(),
  };
}

export function labourCostSummary(store: QuarrygraphStore) {
  let totalCost = 0;
  let totalHours = 0;
  const byType = new Map<string, { type: string; cost: number; hours: number; logs: number }>();
  for (const log of store.labour_logs) {
    const cost = Number(log.cost_zar) || 0;
    const hours = Number(log.hours) || 0;
    totalCost += cost;
    totalHours += hours;
    const t = log.employment_type || 'gang';
    const row = byType.get(t) || { type: t, cost: 0, hours: 0, logs: 0 };
    row.cost += cost;
    row.hours += hours;
    row.logs += 1;
    byType.set(t, row);
  }
  return {
    totalCost: Math.round(totalCost * 100) / 100,
    totalHours: Math.round(totalHours * 10) / 10,
    byEmployment: [...byType.values()]
      .map((r) => ({
        ...r,
        cost: Math.round(r.cost * 100) / 100,
        hours: Math.round(r.hours * 10) / 10,
      }))
      .sort((a, b) => b.cost - a.cost),
  };
}
