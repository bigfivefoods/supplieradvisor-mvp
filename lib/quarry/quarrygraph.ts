/**
 * QuarryAdvisor® — primary-sector OS for quarrying & aggregates.
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
 * Permanent quarry, temporary quarry, or project batching plant.
 * Temporary / batching are often project-by-project with finite dates.
 */
export const OPERATION_KINDS = [
  'permanent',
  'temporary',
  'batching_plant',
] as const;

export const OPERATION_STATUSES = [
  'active',
  'planned',
  'completed',
  'mothballed',
] as const;

/** Pit face under a quarry, temp borrow pit, batch plant pad, etc. */
export const SITE_TYPES = [
  'pit_face',
  'temporary_quarry',
  'batching_plant',
  'stockyard',
  'depot',
  'project_pad',
] as const;

export const ALLOCATION_RESOURCE_TYPES = [
  'vehicle',
  'crew',
  'plant',
] as const;

/**
 * Top-level quarry / operation (estate). A company can run many quarries;
 * each has pits/faces (sites), plant and fleet home base.
 * Also covers temporary quarries and mobile/project batching plants.
 */
export type QuarryOperation = {
  id: string;
  code: string;
  name: string;
  /** permanent | temporary | batching_plant */
  kind?: (typeof OPERATION_KINDS)[number] | string;
  status?: (typeof OPERATION_STATUSES)[number] | string;
  /** Trading / brand for this quarry */
  trading_name?: string;
  /** Project / contract this operation serves */
  project_code?: string;
  project_name?: string;
  client?: string;
  /** Planned / actual window (temp & project plants) */
  start_date?: string | null;
  end_date?: string | null;
  district?: string;
  province?: string;
  country?: string;
  /** Street / site address for maps & logistics */
  address?: string;
  manager?: string;
  phone?: string;
  email?: string;
  mining_right_ref?: string;
  water_use_licence?: string;
  emp_ref?: string;
  /** GPS — WGS84 for Google Maps / distance matrix */
  lat?: number | null;
  lng?: number | null;
  /** Target daily production / batch output tonnes */
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
  /** pit_face | temporary_quarry | batching_plant | … */
  site_type?: (typeof SITE_TYPES)[number] | string;
  /** True for borrow pits, project pads, temporary faces */
  is_temporary?: boolean;
  material: string;
  /** Operating pit / face */
  face?: string;
  hectares?: number | null;
  project_code?: string;
  project_name?: string;
  start_date?: string | null;
  end_date?: string | null;
  /** Mining right / permit ref */
  mining_right_ref?: string;
  water_use_licence?: string;
  emp_ref?: string;
  district?: string;
  province?: string;
  address?: string;
  /** GPS — WGS84 */
  lat?: number | null;
  lng?: number | null;
  notes?: string;
  active?: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Allocate fleet, crews or plant units to a quarry / site / project
 * for a period (mobile plant, temp quarry staffing, batching jobs).
 */
export type ResourceAllocation = {
  id: string;
  resource_type: (typeof ALLOCATION_RESOURCE_TYPES)[number] | string;
  /** vehicle_id, crew_id, or free-text plant unit id */
  resource_id: string;
  resource_label?: string;
  quarry_id?: string | null;
  site_id?: string | null;
  project_code?: string;
  role?: string;
  start_date: string;
  end_date?: string | null;
  notes?: string;
  created_at: string;
  updated_at?: string;
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
  /** Budgeted operating cost per km (haul units) */
  cost_per_km_zar?: number | null;
  /** Target fuel burn L/hour (book rate for fuel util %) */
  fuel_burn_l_h?: number | null;
  /** Diesel / fuel price R per litre for cost metrics */
  fuel_price_zar_l?: number | null;
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
  /** Distance covered this shift (preferred for R/km) */
  km?: number | null;
  odometer_km?: number | null;
  /** Fuel price override for this fill (R/L) */
  fuel_price_zar_l?: number | null;
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
  email?: string;
  phone?: string;
  /** Linked People / HR employee id (dual-write) */
  hr_employee_id?: number | null;
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
  /** Multi-quarry registry (permanent, temporary, batching plants) */
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
  /** Resource → location / project allocations */
  allocations: ResourceAllocation[];
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
    allocations: [],
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

export type LocationPoint = {
  id: string;
  source: 'quarry' | 'site';
  code: string;
  name: string;
  kind: string;
  project_code?: string;
  project_name?: string;
  address?: string;
  lat: number;
  lng: number;
  is_temporary: boolean;
  status?: string;
};

function hasCoords(
  lat?: number | null,
  lng?: number | null
): lat is number {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng))
  );
}

/** All geocoded quarries + sites for maps / distance matrix */
export function locationPoints(store: QuarrygraphStore): LocationPoint[] {
  const out: LocationPoint[] = [];
  for (const q of store.quarries || []) {
    if (q.active === false) continue;
    if (!hasCoords(q.lat, q.lng)) continue;
    const kind = String(q.kind || 'permanent');
    out.push({
      id: q.id,
      source: 'quarry',
      code: q.code,
      name: q.name,
      kind,
      project_code: q.project_code,
      project_name: q.project_name,
      address: q.address,
      lat: Number(q.lat),
      lng: Number(q.lng),
      is_temporary: kind === 'temporary' || kind === 'batching_plant',
      status: q.status,
    });
  }
  for (const s of store.sites || []) {
    if (s.active === false) continue;
    if (!hasCoords(s.lat, s.lng)) continue;
    const st = String(s.site_type || 'pit_face');
    out.push({
      id: s.id,
      source: 'site',
      code: s.code,
      name: s.name,
      kind: st,
      project_code: s.project_code,
      project_name: s.project_name,
      address: s.address,
      lat: Number(s.lat),
      lng: Number(s.lng),
      is_temporary: s.is_temporary === true || st === 'temporary_quarry' || st === 'batching_plant' || st === 'project_pad',
      status: undefined,
    });
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

/** Great-circle distance (km) — pure math, no API key */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rough road distance (haversine × factor) when Google Directions not called */
export function estimatedRoadKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  factor = 1.3
): number {
  return haversineKm(a, b) * factor;
}

/** Open pin in Google Maps */
export function mapsPlaceUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function mapsDirectionsUrl(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
}

export type DistancePair = {
  from_id: string;
  from_code: string;
  from_name: string;
  to_id: string;
  to_code: string;
  to_name: string;
  straight_km: number;
  road_km_est: number;
  maps_url: string;
};

/** Pairwise distances for all geocoded locations (straight + road estimate + Maps link) */
export function distanceMatrix(
  store: QuarrygraphStore,
  opts?: { maxPairs?: number }
): DistancePair[] {
  const pts = locationPoints(store);
  const maxPairs = opts?.maxPairs ?? 80;
  const pairs: DistancePair[] = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (pairs.length >= maxPairs) return pairs;
      const a = pts[i];
      const b = pts[j];
      const straight = haversineKm(a, b);
      pairs.push({
        from_id: a.id,
        from_code: a.code,
        from_name: a.name,
        to_id: b.id,
        to_code: b.code,
        to_name: b.name,
        straight_km: Math.round(straight * 10) / 10,
        road_km_est: Math.round(estimatedRoadKm(a, b) * 10) / 10,
        maps_url: mapsDirectionsUrl(a, b),
      });
    }
  }
  return pairs.sort((x, y) => x.straight_km - y.straight_km);
}

/** Active allocations on a date (default today) */
export function allocationsOnDate(
  store: QuarrygraphStore,
  date?: string
): ResourceAllocation[] {
  const d = date || new Date().toISOString().slice(0, 10);
  return (store.allocations || []).filter((a) => {
    if (a.start_date > d) return false;
    if (a.end_date && a.end_date < d) return false;
    return true;
  });
}

export function allocationsForLocation(
  store: QuarrygraphStore,
  opts: { quarryId?: string | null; siteId?: string | null }
): ResourceAllocation[] {
  return (store.allocations || []).filter((a) => {
    if (opts.siteId && a.site_id === opts.siteId) return true;
    if (opts.quarryId && a.quarry_id === opts.quarryId) return true;
    return false;
  });
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
  const permanentOps = quarries.filter(
    (q) => !q.kind || q.kind === 'permanent'
  );
  const temporaryOps = quarries.filter((q) => q.kind === 'temporary');
  const batchingPlants = quarries.filter((q) => q.kind === 'batching_plant');
  const tempSites = sites.filter(
    (s) =>
      s.is_temporary === true ||
      s.site_type === 'temporary_quarry' ||
      s.site_type === 'batching_plant' ||
      s.site_type === 'project_pad'
  );
  const geocoded = locationPoints(store);
  const openAllocations = allocationsOnDate(store);
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
  const fleetMetrics = vehicleMetrics(store);
  const fleetKm = fleetMetrics.reduce((n, r) => n + r.km, 0);
  const fleetFuelCost = fleetMetrics.reduce((n, r) => n + r.fuel_cost_zar, 0);
  const withKm = fleetMetrics.filter((r) => r.km > 0);
  const avgCostPerKm =
    withKm.length > 0
      ? Math.round(
          (withKm.reduce((n, r) => n + (r.cost_per_km || 0), 0) / withKm.length) *
            100
        ) / 100
      : fleetKm > 0 && fleetCost > 0
        ? Math.round((fleetCost / fleetKm) * 100) / 100
        : null;
  const avgLPerKm =
    fleetKm > 0 ? Math.round((fuel / fleetKm) * 1000) / 1000 : null;
  const avgLPerHour =
    hours > 0 ? Math.round((fuel / hours) * 100) / 100 : null;

  return {
    quarryCount: quarries.length,
    permanentQuarries: permanentOps.length,
    temporaryQuarries: temporaryOps.length,
    batchingPlants: batchingPlants.length,
    siteCount: sites.length,
    temporarySites: tempSites.length,
    locationsWithGps: geocoded.length,
    openAllocations: openAllocations.length,
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
    fleetKm: Math.round(fleetKm * 10) / 10,
    /** Key: fleet average fuel utilisation L/hour */
    lPerHour: avgLPerHour,
    /** Key: fleet average fuel utilisation L/km */
    lPerKm: avgLPerKm,
    /** Key: fleet average cost per kilometre (R/km) */
    costPerKm: avgCostPerKm,
    fuelCostZar: Math.round(fleetFuelCost * 100) / 100,
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
  /** Key metric: km travelled (shift km + odometer deltas) */
  km: number;
  tonnes_moved: number;
  loads: number;
  /** Key: fuel utilisation L per operating hour */
  l_per_hour: number | null;
  /** Key: fuel utilisation L per km */
  l_per_km: number | null;
  km_per_l: number | null;
  t_per_hour: number | null;
  l_per_tonne: number | null;
  util_pct: number | null;
  /** Actual L/h vs book fuel_burn_l_h (100% = on target) */
  fuel_util_pct: number | null;
  fuel_cost_zar: number;
  cost_zar: number;
  /** Key metric: total cost ÷ km */
  cost_per_km: number | null;
  /** Fuel-only cost ÷ km */
  fuel_cost_per_km: number | null;
  cost_per_t: number | null;
  engine_hours: number | null;
  odometer_km: number | null;
};

/** Resolve km for a log: explicit km, else positive odometer delta */
export function resolveLogKm(
  log: { km?: number | null; odometer_km?: number | null },
  prevOdometer: number | null
): { km: number; nextOdometer: number | null } {
  const odo =
    log.odometer_km != null && Number.isFinite(Number(log.odometer_km))
      ? Number(log.odometer_km)
      : null;
  if (log.km != null && Number(log.km) > 0) {
    return { km: Number(log.km), nextOdometer: odo ?? prevOdometer };
  }
  if (odo != null && prevOdometer != null) {
    const d = odo - prevOdometer;
    // Guard against resets / unit swaps
    if (d > 0 && d < 5000) return { km: d, nextOdometer: odo };
  }
  return { km: 0, nextOdometer: odo ?? prevOdometer };
}

/** Full vehicle KPI board — fuel util + R/km are first-class */
export function vehicleMetrics(store: QuarrygraphStore): VehicleMetricsRow[] {
  type Acc = {
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
    km: number;
    tonnes_moved: number;
    loads: number;
    cost_zar: number;
    fuel_cost_zar: number;
    engine_hours: number | null;
    odometer_km: number | null;
    target_hours_day: number;
    fuel_burn_l_h: number | null;
  };

  const byId = new Map<string, Acc>();
  const lastOdo = new Map<string, number | null>();

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
      km: 0,
      tonnes_moved: 0,
      loads: 0,
      cost_zar: 0,
      fuel_cost_zar: 0,
      engine_hours: v.engine_hours ?? null,
      odometer_km: v.odometer_km ?? null,
      target_hours_day: Number(v.target_hours_day) || 8,
      fuel_burn_l_h:
        v.fuel_burn_l_h != null ? Number(v.fuel_burn_l_h) : null,
    });
    lastOdo.set(v.id, v.odometer_km != null ? Number(v.odometer_km) : null);
  }

  const sortedLogs = [...store.fleet_logs].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return a.created_at.localeCompare(b.created_at);
  });

  for (const log of sortedLogs) {
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
        km: 0,
        tonnes_moved: 0,
        loads: 0,
        cost_zar: 0,
        fuel_cost_zar: 0,
        engine_hours: null,
        odometer_km: null,
        target_hours_day: 8,
        fuel_burn_l_h: null,
      };
      byId.set(key, row);
      lastOdo.set(key, null);
    }
    const v = store.vehicles.find((x) => x.id === log.vehicle_id);
    const h = Number(log.hours) || 0;
    const fuel = Number(log.fuel_l) || 0;
    const price =
      log.fuel_price_zar_l != null
        ? Number(log.fuel_price_zar_l)
        : Number(v?.fuel_price_zar_l) || 0;
    const fuelCost = fuel * price;
    const odoKey = log.vehicle_id || key;
    const prev = lastOdo.get(odoKey) ?? null;
    const { km, nextOdometer } = resolveLogKm(log, prev);
    lastOdo.set(odoKey, nextOdometer);

    row.logs += 1;
    row.hours += h;
    row.idle_hours += Number(log.idle_hours) || 0;
    row.fuel_l += fuel;
    row.km += km;
    row.tonnes_moved += Number(log.tonnes_moved) || 0;
    row.loads += Number(log.loads) || 0;
    row.fuel_cost_zar += fuelCost;

    if (log.cost_zar != null) {
      row.cost_zar += Number(log.cost_zar) || 0;
    } else {
      // Roll-up: hour rate + km rate + fuel (set only the rates you track)
      row.cost_zar +=
        h * (Number(v?.cost_per_hour_zar) || 0) +
        km * (Number(v?.cost_per_km_zar) || 0) +
        fuelCost;
    }
    if (log.engine_hours_end != null) row.engine_hours = Number(log.engine_hours_end);
    if (log.odometer_km != null) row.odometer_km = Number(log.odometer_km);
  }

  return [...byId.values()]
    .map((r) => {
      const days = Math.max(1, r.logs);
      const target = r.target_hours_day * days;
      const lph =
        r.hours > 0 ? Math.round((r.fuel_l / r.hours) * 100) / 100 : null;
      const lpk =
        r.km > 0 ? Math.round((r.fuel_l / r.km) * 1000) / 1000 : null;
      const cpk =
        r.km > 0 ? Math.round((r.cost_zar / r.km) * 100) / 100 : null;
      const fcpk =
        r.km > 0
          ? Math.round((r.fuel_cost_zar / r.km) * 100) / 100
          : null;
      const fuelUtil =
        lph != null && r.fuel_burn_l_h != null && r.fuel_burn_l_h > 0
          ? Math.round((lph / r.fuel_burn_l_h) * 1000) / 10
          : null;
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
        km: Math.round(r.km * 10) / 10,
        tonnes_moved: Math.round(r.tonnes_moved * 10) / 10,
        loads: r.loads,
        l_per_hour: lph,
        l_per_km: lpk,
        km_per_l:
          r.fuel_l > 0 && r.km > 0
            ? Math.round((r.km / r.fuel_l) * 100) / 100
            : null,
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
        fuel_util_pct: fuelUtil,
        fuel_cost_zar: Math.round(r.fuel_cost_zar * 100) / 100,
        cost_zar: Math.round(r.cost_zar * 100) / 100,
        cost_per_km: cpk,
        fuel_cost_per_km: fcpk,
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
    km: r.km,
    tonnes_moved: r.tonnes_moved,
    l_per_hour: r.l_per_hour,
    l_per_km: r.l_per_km,
    cost_per_km: r.cost_per_km,
    fuel_util_pct: r.fuel_util_pct,
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
    locations: locationPoints(store),
    distanceMatrix: distanceMatrix(store),
    allocations: store.allocations || [],
    openAllocations: allocationsOnDate(store),
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
