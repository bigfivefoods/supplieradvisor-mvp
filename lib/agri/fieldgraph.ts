/**
 * Fieldgraph® — primary production OS for farms & grower networks.
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
  odometer_km?: number | null;
  notes?: string;
  created_at: string;
};

export type AgriLabourLog = {
  id: string;
  field_id?: string | null;
  date: string;
  gang_or_person: string;
  activity: string;
  headcount?: number | null;
  hours?: number | null;
  notes?: string;
  created_at: string;
};

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
    labourLogs: store.labour_logs.length,
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

/** Vehicle utilisation report */
export function vehicleUtilisation(store: FieldgraphStore): Array<{
  vehicle: string;
  vehicle_id: string | null;
  logs: number;
  hours: number;
  fuel_l: number;
  l_per_hour: number | null;
  activities: Record<string, number>;
  fields: string[];
}> {
  const byKey = new Map<
    string,
    {
      vehicle: string;
      vehicle_id: string | null;
      logs: number;
      hours: number;
      fuel_l: number;
      activities: Record<string, number>;
      fields: Set<string>;
    }
  >();
  for (const log of store.fleet_logs) {
    const key = log.vehicle_id || log.vehicle;
    let row = byKey.get(key);
    if (!row) {
      row = {
        vehicle: log.vehicle,
        vehicle_id: log.vehicle_id || null,
        logs: 0,
        hours: 0,
        fuel_l: 0,
        activities: {},
        fields: new Set(),
      };
      byKey.set(key, row);
    }
    row.logs += 1;
    row.hours += Number(log.hours) || 0;
    row.fuel_l += Number(log.fuel_l) || 0;
    const act = log.activity || 'Other';
    row.activities[act] = (row.activities[act] || 0) + 1;
    if (log.field_id) row.fields.add(log.field_id);
  }
  return [...byKey.values()]
    .map((r) => ({
      vehicle: r.vehicle,
      vehicle_id: r.vehicle_id,
      logs: r.logs,
      hours: Math.round(r.hours * 10) / 10,
      fuel_l: Math.round(r.fuel_l * 10) / 10,
      l_per_hour:
        r.hours > 0 ? Math.round((r.fuel_l / r.hours) * 100) / 100 : null,
      activities: r.activities,
      fields: [...r.fields],
    }))
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
