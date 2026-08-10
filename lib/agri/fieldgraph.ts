/**
 * CropAdvisor® (fieldgraph) — primary production OS for farms & grower networks.
 * Multi-crop field book, estimates, harvest plan, inputs, regen, farm-to-buyer trade.
 * Stored on profiles.metadata.fieldgraph (no migration required).
 */

export const FIELDGRAPH_MODULE_ID = 'fieldgraph' as const;
export const FIELDGRAPH_META_KEY = 'fieldgraph';

export const CROP_TYPES = [
  'Sugar cane',
  'Maize',
  'Wheat',
  'Soybeans',
  'Sunflower',
  'Sorghum',
  'Citrus',
  'Subtropical fruit',
  'Table grapes',
  'Wine grapes',
  'Vegetables',
  'Potatoes',
  'Nuts',
  'Cotton',
  'Livestock pasture',
  'Mixed / other',
] as const;

export type CropType = (typeof CROP_TYPES)[number] | string;

export type AgriField = {
  id: string;
  code: string;
  name: string;
  farm_name?: string;
  crop: CropType;
  variety?: string;
  hectares: number;
  /** Plant / ratoon year */
  season_year?: number;
  ratoon?: number;
  irrigation?: 'dryland' | 'irrigated' | 'partial' | 'unknown';
  soil_type?: string;
  /** Shared agronomic attributes used by estimates, harvest, inputs */
  plant_date?: string | null;
  row_spacing_m?: number | null;
  population_per_ha?: number | null;
  slope_pct?: number | null;
  drainage?: string;
  district?: string;
  mill_group?: string;
  lat?: number | null;
  lng?: number | null;
  notes?: string;
  active?: boolean;
  created_at: string;
  updated_at: string;
};

/** Actual yield/quality result for a season (for multi-season analysis) */
export type AgriYieldActual = {
  id: string;
  field_id: string;
  season: string;
  tonnes: number;
  quality_pct?: number | null;
  tonnes_per_ha?: number | null;
  harvested_at?: string | null;
  notes?: string;
  created_at: string;
};

export type EstimateRevision = {
  at: string;
  tonnes: number;
  quality_pct?: number | null;
  status: string;
  note?: string;
};

export type AgriEstimate = {
  id: string;
  field_id: string;
  season: string;
  /** Estimated tonnes */
  tonnes: number;
  /** Optional quality metric e.g. RV% for cane, moisture for grain */
  quality_pct?: number | null;
  tonnes_per_ha?: number | null;
  status: 'draft' | 'submitted' | 'revised' | 'final' | 'board';
  /** Mill Group Board / delivery board reference */
  board_ref?: string;
  revision?: number;
  revisions?: EstimateRevision[];
  notes?: string;
  updated_at: string;
};

export type AgriHarvestPlanItem = {
  id: string;
  field_id: string;
  season: string;
  sequence: number;
  planned_date?: string | null;
  /** Projected end of cut window */
  planned_end_date?: string | null;
  days_to_cut?: number | null;
  estimated_tonnes?: number | null;
  daily_allocation_t?: number | null;
  destination?: string;
  status: 'planned' | 'cutting' | 'delivered' | 'done';
  notes?: string;
  updated_at: string;
};

/** Vehicle registry — utilised by vehicle activity logs */
export type AgriVehicle = {
  id: string;
  code: string;
  name: string;
  type?: string;
  reg_no?: string;
  /** Last known odometer (km) */
  odometer_km?: number | null;
  /** Operating cost R per hour */
  cost_per_hour_zar?: number | null;
  /** Budgeted / hired cost R per km */
  cost_per_km_zar?: number | null;
  /** Book fuel burn L/hour (for fuel util %) */
  fuel_burn_l_h?: number | null;
  /** Diesel price R/L for fuel cost & R/km */
  fuel_price_zar_l?: number | null;
  active?: boolean;
  created_at: string;
};

export type AgriApplication = {
  id: string;
  field_id: string;
  date: string;
  product: string;
  category: 'fertiliser' | 'chemical' | 'seed' | 'other';
  quantity: number;
  unit: string;
  /** Nutrients kg/ha when fertiliser */
  n_kg_ha?: number | null;
  p_kg_ha?: number | null;
  k_kg_ha?: number | null;
  cost_zar?: number | null;
  notes?: string;
  created_at: string;
};

export type AgriFleetLog = {
  id: string;
  field_id?: string | null;
  vehicle_id?: string | null;
  date: string;
  vehicle: string;
  activity: string;
  hours?: number | null;
  fuel_l?: number | null;
  /** Distance this activity (preferred for cost/km) */
  km?: number | null;
  odometer_km?: number | null;
  fuel_price_zar_l?: number | null;
  /** Optional total cost override for the log */
  cost_zar?: number | null;
  notes?: string;
  created_at: string;
};

/** Rate basis for gangs / field labour */
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

/** Gang / crew register with default labour rate */
export type AgriGang = {
  id: string;
  code: string;
  name: string;
  employment_type: LabourEmploymentType;
  /** Default rate in ZAR */
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

export type AgriLabourLog = {
  id: string;
  field_id?: string | null;
  /** Link to gang register when used */
  gang_id?: string | null;
  date: string;
  gang_or_person: string;
  activity: string;
  employment_type?: LabourEmploymentType;
  headcount?: number | null;
  hours?: number | null;
  /** Units for tonne/task rates (e.g. tonnes cut) */
  quantity?: number | null;
  /** Snapshot rate applied on this log (ZAR) */
  rate_zar?: number | null;
  rate_unit?: LabourRateUnit | null;
  /** Computed cost for the log (ZAR) */
  cost_zar?: number | null;
  notes?: string;
  created_at: string;
};

export const LABOUR_RATE_UNITS: Array<{
  value: LabourRateUnit;
  label: string;
}> = [
  { value: 'per_person_hour', label: 'R / person-hour' },
  { value: 'per_person_day', label: 'R / person-day' },
  { value: 'per_hour', label: 'R / hour (crew)' },
  { value: 'per_day', label: 'R / day (crew)' },
  { value: 'per_tonne', label: 'R / tonne' },
  { value: 'per_task', label: 'R / task' },
];

export const LABOUR_EMPLOYMENT_TYPES: Array<{
  value: LabourEmploymentType;
  label: string;
}> = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'temporary', label: 'Temporary / seasonal' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'gang', label: 'Gang / crew' },
];

/**
 * Cost from rate unit, headcount, hours, and optional quantity (tonne/task).
 * - per_person_hour: rate × headcount × hours
 * - per_person_day: rate × headcount × days (hours/8, min 1 if headcount set)
 * - per_hour: rate × hours (whole crew)
 * - per_day: rate × days (hours/8)
 * - per_tonne / per_task: rate × quantity
 */
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
    case 'per_person_day': {
      const d = hrs > 0 ? hrs / 8 : 1;
      cost = rate * (hc || 1) * d;
      break;
    }
    case 'per_hour':
      cost = rate * (hrs || 0);
      break;
    case 'per_day': {
      const d = hrs > 0 ? hrs / 8 : 1;
      cost = rate * d;
      break;
    }
    case 'per_tonne':
    case 'per_task':
      cost = rate * (qty || 0);
      break;
    default:
      return null;
  }
  return Math.round(cost * 100) / 100;
}

/** Labour cost roll-up by gang and employment type */
export function labourCostSummary(store: FieldgraphStore): {
  totalCost: number;
  totalHours: number;
  totalHeadcountDays: number;
  byEmployment: Array<{ type: string; cost: number; logs: number; hours: number }>;
  byGang: Array<{
    gang: string;
    gang_id: string | null;
    cost: number;
    hours: number;
    logs: number;
    rate_zar: number | null;
  }>;
  byField: Array<{ field_id: string; cost: number; hours: number; logs: number }>;
} {
  const byEmp = new Map<
    string,
    { type: string; cost: number; logs: number; hours: number }
  >();
  const byGang = new Map<
    string,
    {
      gang: string;
      gang_id: string | null;
      cost: number;
      hours: number;
      logs: number;
      rate_zar: number | null;
    }
  >();
  const byField = new Map<
    string,
    { field_id: string; cost: number; hours: number; logs: number }
  >();

  let totalCost = 0;
  let totalHours = 0;
  let totalHeadcountDays = 0;

  for (const log of store.labour_logs || []) {
    const cost = Number(log.cost_zar) || 0;
    const hours = Number(log.hours) || 0;
    const hc = Number(log.headcount) || 0;
    totalCost += cost;
    totalHours += hours;
    if (hc && hours) totalHeadcountDays += hc * (hours / 8);
    else if (hc) totalHeadcountDays += hc;

    const et = log.employment_type || 'gang';
    const er = byEmp.get(et) || {
      type: et,
      cost: 0,
      logs: 0,
      hours: 0,
    };
    er.cost += cost;
    er.logs += 1;
    er.hours += hours;
    byEmp.set(et, er);

    const gKey = log.gang_id || log.gang_or_person || 'Unknown';
    const gr = byGang.get(gKey) || {
      gang: log.gang_or_person || gKey,
      gang_id: log.gang_id || null,
      cost: 0,
      hours: 0,
      logs: 0,
      rate_zar: log.rate_zar ?? null,
    };
    gr.cost += cost;
    gr.hours += hours;
    gr.logs += 1;
    byGang.set(gKey, gr);

    if (log.field_id) {
      const fr = byField.get(log.field_id) || {
        field_id: log.field_id,
        cost: 0,
        hours: 0,
        logs: 0,
      };
      fr.cost += cost;
      fr.hours += hours;
      fr.logs += 1;
      byField.set(log.field_id, fr);
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    totalCost: round(totalCost),
    totalHours: round(totalHours),
    totalHeadcountDays: round(totalHeadcountDays),
    byEmployment: [...byEmp.values()]
      .map((r) => ({
        ...r,
        cost: round(r.cost),
        hours: round(r.hours),
      }))
      .sort((a, b) => b.cost - a.cost),
    byGang: [...byGang.values()]
      .map((r) => ({
        ...r,
        cost: round(r.cost),
        hours: round(r.hours),
      }))
      .sort((a, b) => b.cost - a.cost),
    byField: [...byField.values()]
      .map((r) => ({
        ...r,
        cost: round(r.cost),
        hours: round(r.hours),
      }))
      .sort((a, b) => b.cost - a.cost),
  };
}

export type AgriRegenSample = {
  id: string;
  field_id: string;
  date: string;
  soil_organic_carbon_pct?: number | null;
  moisture_pct?: number | null;
  cover_pct?: number | null;
  water_used_mm?: number | null;
  biodiversity_notes?: string;
  created_at: string;
};

export type FieldgraphStore = {
  fields: AgriField[];
  estimates: AgriEstimate[];
  /** Actual delivered yields for cross-season graphs */
  yield_actuals: AgriYieldActual[];
  harvest_plan: AgriHarvestPlanItem[];
  applications: AgriApplication[];
  vehicles: AgriVehicle[];
  fleet_logs: AgriFleetLog[];
  /** Gang / crew register with rates */
  gangs: AgriGang[];
  labour_logs: AgriLabourLog[];
  regen_samples: AgriRegenSample[];
  updated_at?: string;
};

export function emptyFieldgraphStore(): FieldgraphStore {
  return {
    fields: [],
    estimates: [],
    yield_actuals: [],
    harvest_plan: [],
    applications: [],
    vehicles: [],
    fleet_logs: [],
    gangs: [],
    labour_logs: [],
    regen_samples: [],
  };
}

export function readFieldgraphFromMetadata(
  meta: Record<string, unknown> | null | undefined
): FieldgraphStore {
  if (!meta || typeof meta !== 'object') return emptyFieldgraphStore();
  const raw = meta[FIELDGRAPH_META_KEY];
  if (!raw || typeof raw !== 'object') return emptyFieldgraphStore();
  const s = raw as Partial<FieldgraphStore>;
  return {
    fields: Array.isArray(s.fields) ? (s.fields as AgriField[]) : [],
    estimates: Array.isArray(s.estimates) ? (s.estimates as AgriEstimate[]) : [],
    yield_actuals: Array.isArray(s.yield_actuals)
      ? (s.yield_actuals as AgriYieldActual[])
      : [],
    harvest_plan: Array.isArray(s.harvest_plan)
      ? (s.harvest_plan as AgriHarvestPlanItem[])
      : [],
    applications: Array.isArray(s.applications)
      ? (s.applications as AgriApplication[])
      : [],
    vehicles: Array.isArray(s.vehicles) ? (s.vehicles as AgriVehicle[]) : [],
    fleet_logs: Array.isArray(s.fleet_logs)
      ? (s.fleet_logs as AgriFleetLog[])
      : [],
    gangs: Array.isArray(s.gangs) ? (s.gangs as AgriGang[]) : [],
    labour_logs: Array.isArray(s.labour_logs)
      ? (s.labour_logs as AgriLabourLog[])
      : [],
    regen_samples: Array.isArray(s.regen_samples)
      ? (s.regen_samples as AgriRegenSample[])
      : [],
    updated_at: s.updated_at ? String(s.updated_at) : undefined,
  };
}

export function writeFieldgraphToMetadata(
  meta: Record<string, unknown>,
  store: FieldgraphStore
): Record<string, unknown> {
  return {
    ...meta,
    [FIELDGRAPH_META_KEY]: {
      ...store,
      updated_at: new Date().toISOString(),
    },
  };
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function fieldById(store: FieldgraphStore, id: string): AgriField | undefined {
  return store.fields.find((f) => f.id === id);
}

export function summariseFieldgraph(store: FieldgraphStore) {
  const activeFields = store.fields.filter((f) => f.active !== false);
  const ha = activeFields.reduce((n, f) => n + (Number(f.hectares) || 0), 0);
  const crops = new Set(activeFields.map((f) => f.crop).filter(Boolean));
  const estTonnes = store.estimates
    .filter((e) => e.status !== 'draft')
    .reduce((n, e) => n + (Number(e.tonnes) || 0), 0);
  const plannedCuts = store.harvest_plan.filter(
    (h) => h.status === 'planned' || h.status === 'cutting'
  ).length;
  const appsYtd = store.applications.length;
  const regenSamples = store.regen_samples.length;
  const avgSoc =
    store.regen_samples.filter((r) => r.soil_organic_carbon_pct != null).length > 0
      ? store.regen_samples.reduce(
          (n, r) => n + (Number(r.soil_organic_carbon_pct) || 0),
          0
        ) /
        store.regen_samples.filter((r) => r.soil_organic_carbon_pct != null).length
      : null;

  const fuelTotal = store.fleet_logs.reduce(
    (n, l) => n + (Number(l.fuel_l) || 0),
    0
  );
  const hoursTotal = store.fleet_logs.reduce(
    (n, l) => n + (Number(l.hours) || 0),
    0
  );
  const boardEstimates = store.estimates.filter(
    (e) => e.status === 'board' || e.status === 'submitted'
  ).length;
  const fleetUtil = vehicleUtilisation(store);
  const fleetKm = fleetUtil.reduce((n, r) => n + r.km, 0);
  const fleetCost = fleetUtil.reduce((n, r) => n + r.cost_zar, 0);
  const withKm = fleetUtil.filter((r) => r.km > 0);
  const costPerKm =
    withKm.length > 0
      ? Math.round(
          (withKm.reduce((n, r) => n + (r.cost_per_km || 0), 0) /
            withKm.length) *
            100
        ) / 100
      : fleetKm > 0 && fleetCost > 0
        ? Math.round((fleetCost / fleetKm) * 100) / 100
        : null;

  return {
    fieldCount: activeFields.length,
    hectares: Math.round(ha * 10) / 10,
    cropCount: crops.size,
    crops: [...crops],
    estimateTonnes: Math.round(estTonnes * 10) / 10,
    boardEstimates,
    harvestOpen: plannedCuts,
    applications: appsYtd,
    regenSamples,
    avgSoilOrganicCarbon: avgSoc != null ? Math.round(avgSoc * 100) / 100 : null,
    vehicleCount: (store.vehicles || []).filter((v) => v.active !== false).length,
    fleetLogs: store.fleet_logs.length,
    fuelTotalL: Math.round(fuelTotal * 10) / 10,
    fleetHours: Math.round(hoursTotal * 10) / 10,
    fleetKm: Math.round(fleetKm * 10) / 10,
    /** Key: fleet fuel utilisation L/hour */
    lPerHour:
      hoursTotal > 0
        ? Math.round((fuelTotal / hoursTotal) * 100) / 100
        : null,
    /** Key: fleet fuel utilisation L/km */
    lPerKm:
      fleetKm > 0 ? Math.round((fuelTotal / fleetKm) * 1000) / 1000 : null,
    /** Key: average cost per kilometre */
    costPerKm,
    fleetCostZar: Math.round(fleetCost * 100) / 100,
    gangCount: (store.gangs || []).filter((g) => g.active !== false).length,
    labourLogs: store.labour_logs.length,
    labourCostZar: labourCostSummary(store).totalCost,
    yieldActuals: (store.yield_actuals || []).length,
  };
}

/** Yield & quality by season for charts (estimate + actual when present) */
export function yieldQualityBySeason(store: FieldgraphStore): Array<{
  season: string;
  estimate_t: number;
  actual_t: number;
  avg_quality_est: number | null;
  avg_quality_act: number | null;
  field_count: number;
}> {
  const seasons = new Set<string>();
  for (const e of store.estimates) seasons.add(e.season);
  for (const a of store.yield_actuals || []) seasons.add(a.season);
  return [...seasons]
    .sort()
    .map((season) => {
      const ests = store.estimates.filter((e) => e.season === season);
      const acts = (store.yield_actuals || []).filter((a) => a.season === season);
      const qEst = ests.filter((e) => e.quality_pct != null);
      const qAct = acts.filter((a) => a.quality_pct != null);
      const fields = new Set([
        ...ests.map((e) => e.field_id),
        ...acts.map((a) => a.field_id),
      ]);
      return {
        season,
        estimate_t: Math.round(
          ests.reduce((n, e) => n + (Number(e.tonnes) || 0), 0) * 10
        ) / 10,
        actual_t: Math.round(
          acts.reduce((n, a) => n + (Number(a.tonnes) || 0), 0) * 10
        ) / 10,
        avg_quality_est: qEst.length
          ? Math.round(
              (qEst.reduce((n, e) => n + (Number(e.quality_pct) || 0), 0) /
                qEst.length) *
                10
            ) / 10
          : null,
        avg_quality_act: qAct.length
          ? Math.round(
              (qAct.reduce((n, a) => n + (Number(a.quality_pct) || 0), 0) /
                qAct.length) *
                10
            ) / 10
          : null,
        field_count: fields.size,
      };
    });
}

/** Per-field multi-season yield rows for analysis */
export function fieldYieldSeries(
  store: FieldgraphStore,
  fieldId: string
): Array<{
  season: string;
  estimate_t: number | null;
  actual_t: number | null;
  quality_est: number | null;
  quality_act: number | null;
  t_per_ha_est: number | null;
  t_per_ha_act: number | null;
}> {
  const field = fieldById(store, fieldId);
  const ha = field?.hectares || 0;
  const seasons = new Set<string>();
  for (const e of store.estimates.filter((x) => x.field_id === fieldId))
    seasons.add(e.season);
  for (const a of (store.yield_actuals || []).filter((x) => x.field_id === fieldId))
    seasons.add(a.season);
  return [...seasons].sort().map((season) => {
    const est = store.estimates.find(
      (e) => e.field_id === fieldId && e.season === season
    );
    const act = (store.yield_actuals || []).find(
      (a) => a.field_id === fieldId && a.season === season
    );
    const et = est != null ? Number(est.tonnes) : null;
    const at = act != null ? Number(act.tonnes) : null;
    return {
      season,
      estimate_t: et,
      actual_t: at,
      quality_est: est?.quality_pct ?? null,
      quality_act: act?.quality_pct ?? null,
      t_per_ha_est: et != null && ha > 0 ? Math.round((et / ha) * 100) / 100 : null,
      t_per_ha_act: at != null && ha > 0 ? Math.round((at / ha) * 100) / 100 : null,
    };
  });
}

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
    if (d > 0 && d < 5000) return { km: d, nextOdometer: odo };
  }
  return { km: 0, nextOdometer: odo ?? prevOdometer };
}

/**
 * Vehicle utilisation + key fuel / cost metrics per vehicle.
 * Keys: fuel util (L/h, L/km), cost per km (R/km).
 */
export function vehicleUtilisation(store: FieldgraphStore): Array<{
  vehicle: string;
  vehicle_id: string | null;
  code: string;
  logs: number;
  hours: number;
  fuel_l: number;
  km: number;
  /** Key: fuel utilisation L/hour */
  l_per_hour: number | null;
  /** Key: fuel utilisation L/km */
  l_per_km: number | null;
  km_per_l: number | null;
  fuel_util_pct: number | null;
  fuel_cost_zar: number;
  cost_zar: number;
  /** Key: total cost per km */
  cost_per_km: number | null;
  fuel_cost_per_km: number | null;
  activities: Record<string, number>;
  fields: string[];
}> {
  type Acc = {
    vehicle: string;
    vehicle_id: string | null;
    code: string;
    logs: number;
    hours: number;
    fuel_l: number;
    km: number;
    fuel_cost_zar: number;
    cost_zar: number;
    fuel_burn_l_h: number | null;
    activities: Record<string, number>;
    fields: Set<string>;
  };

  const byKey = new Map<string, Acc>();
  const lastOdo = new Map<string, number | null>();

  for (const v of store.vehicles || []) {
    byKey.set(v.id, {
      vehicle: v.name,
      vehicle_id: v.id,
      code: v.code,
      logs: 0,
      hours: 0,
      fuel_l: 0,
      km: 0,
      fuel_cost_zar: 0,
      cost_zar: 0,
      fuel_burn_l_h:
        v.fuel_burn_l_h != null ? Number(v.fuel_burn_l_h) : null,
      activities: {},
      fields: new Set(),
    });
    lastOdo.set(
      v.id,
      v.odometer_km != null ? Number(v.odometer_km) : null
    );
  }

  const sorted = [...store.fleet_logs].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return a.created_at.localeCompare(b.created_at);
  });

  for (const log of sorted) {
    const key = log.vehicle_id || log.vehicle;
    let row = log.vehicle_id ? byKey.get(log.vehicle_id) : undefined;
    if (!row) {
      row = {
        vehicle: log.vehicle,
        vehicle_id: log.vehicle_id || null,
        code: '—',
        logs: 0,
        hours: 0,
        fuel_l: 0,
        km: 0,
        fuel_cost_zar: 0,
        cost_zar: 0,
        fuel_burn_l_h: null,
        activities: {},
        fields: new Set(),
      };
      byKey.set(key, row);
      lastOdo.set(key, null);
    }
    const v = (store.vehicles || []).find((x) => x.id === log.vehicle_id);
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
    row.fuel_l += fuel;
    row.km += km;
    row.fuel_cost_zar += fuelCost;
    if (log.cost_zar != null) {
      row.cost_zar += Number(log.cost_zar) || 0;
    } else {
      row.cost_zar +=
        h * (Number(v?.cost_per_hour_zar) || 0) +
        km * (Number(v?.cost_per_km_zar) || 0) +
        fuelCost;
    }
    const act = log.activity || 'Other';
    row.activities[act] = (row.activities[act] || 0) + 1;
    if (log.field_id) row.fields.add(log.field_id);
  }

  return [...byKey.values()]
    .map((r) => {
      const lph =
        r.hours > 0 ? Math.round((r.fuel_l / r.hours) * 100) / 100 : null;
      const lpk =
        r.km > 0 ? Math.round((r.fuel_l / r.km) * 1000) / 1000 : null;
      return {
        vehicle: r.vehicle,
        vehicle_id: r.vehicle_id,
        code: r.code,
        logs: r.logs,
        hours: Math.round(r.hours * 10) / 10,
        fuel_l: Math.round(r.fuel_l * 10) / 10,
        km: Math.round(r.km * 10) / 10,
        l_per_hour: lph,
        l_per_km: lpk,
        km_per_l:
          r.fuel_l > 0 && r.km > 0
            ? Math.round((r.km / r.fuel_l) * 100) / 100
            : null,
        fuel_util_pct:
          lph != null && r.fuel_burn_l_h != null && r.fuel_burn_l_h > 0
            ? Math.round((lph / r.fuel_burn_l_h) * 1000) / 10
            : null,
        fuel_cost_zar: Math.round(r.fuel_cost_zar * 100) / 100,
        cost_zar: Math.round(r.cost_zar * 100) / 100,
        cost_per_km:
          r.km > 0 ? Math.round((r.cost_zar / r.km) * 100) / 100 : null,
        fuel_cost_per_km:
          r.km > 0
            ? Math.round((r.fuel_cost_zar / r.km) * 100) / 100
            : null,
        activities: r.activities,
        fields: [...r.fields],
      };
    })
    .sort((a, b) => b.hours - a.hours);
}

/**
 * Harvest planner: user cutting sequence + field estimates + daily allocation
 * → expected cut start/end dates for each field in the season.
 */
export function projectHarvestDates(
  items: AgriHarvestPlanItem[],
  _fields: AgriField[],
  estimates: AgriEstimate[],
  season: string,
  startDate: string,
  dailyAllocationT: number
): AgriHarvestPlanItem[] {
  if (!(dailyAllocationT > 0)) return items;
  let cursor = new Date(startDate + 'T12:00:00');
  if (Number.isNaN(cursor.getTime())) cursor = new Date();

  const seasonItems = items
    .filter((h) => h.season === season)
    .sort((a, b) => a.sequence - b.sequence);

  const updated = [...items];
  for (const item of seasonItems) {
    const est = estimates.find(
      (e) =>
        e.field_id === item.field_id &&
        e.season === season &&
        e.status !== 'draft'
    );
    const tonnes =
      Number(item.estimated_tonnes) ||
      Number(est?.tonnes) ||
      0;
    const days = Math.max(1, Math.ceil(tonnes / dailyAllocationT));
    const planned = cursor.toISOString().slice(0, 10);
    const end = new Date(cursor);
    end.setDate(end.getDate() + days - 1);
    const plannedEnd = end.toISOString().slice(0, 10);
    const idx = updated.findIndex((x) => x.id === item.id);
    if (idx >= 0) {
      updated[idx] = {
        ...updated[idx],
        planned_date: planned,
        planned_end_date: plannedEnd,
        days_to_cut: days,
        estimated_tonnes: tonnes || updated[idx].estimated_tonnes,
        daily_allocation_t: dailyAllocationT,
        updated_at: new Date().toISOString(),
      };
    }
    cursor.setDate(cursor.getDate() + days);
  }
  return updated;
}

/** Mill Group Board–style estimate export rows */
export function millBoardEstimateRows(
  store: FieldgraphStore,
  season: string
): Array<{
  field_code: string;
  field_name: string;
  crop: string;
  hectares: number;
  tonnes: number;
  t_per_ha: number | null;
  quality_pct: number | null;
  status: string;
  board_ref: string;
  revision: number;
  mill_group: string;
}> {
  return store.estimates
    .filter((e) => e.season === season)
    .map((e) => {
      const f = fieldById(store, e.field_id);
      return {
        field_code: f?.code || e.field_id,
        field_name: f?.name || '',
        crop: f?.crop || '',
        hectares: f?.hectares || 0,
        tonnes: e.tonnes,
        t_per_ha: e.tonnes_per_ha ?? null,
        quality_pct: e.quality_pct ?? null,
        status: e.status,
        board_ref: e.board_ref || '',
        revision: e.revision || 1,
        mill_group: f?.mill_group || '',
      };
    })
    .sort((a, b) => a.field_code.localeCompare(b.field_code));
}
