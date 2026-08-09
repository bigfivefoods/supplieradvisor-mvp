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
  lat?: number | null;
  lng?: number | null;
  notes?: string;
  active?: boolean;
  created_at: string;
  updated_at: string;
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
  status: 'draft' | 'submitted' | 'revised' | 'final';
  notes?: string;
  updated_at: string;
};

export type AgriHarvestPlanItem = {
  id: string;
  field_id: string;
  season: string;
  sequence: number;
  planned_date?: string | null;
  daily_allocation_t?: number | null;
  destination?: string;
  status: 'planned' | 'cutting' | 'delivered' | 'done';
  notes?: string;
  updated_at: string;
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
  date: string;
  vehicle: string;
  activity: string;
  hours?: number | null;
  fuel_l?: number | null;
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
  harvest_plan: AgriHarvestPlanItem[];
  applications: AgriApplication[];
  fleet_logs: AgriFleetLog[];
  labour_logs: AgriLabourLog[];
  regen_samples: AgriRegenSample[];
  updated_at?: string;
};

export function emptyFieldgraphStore(): FieldgraphStore {
  return {
    fields: [],
    estimates: [],
    harvest_plan: [],
    applications: [],
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
    harvest_plan: Array.isArray(s.harvest_plan)
      ? (s.harvest_plan as AgriHarvestPlanItem[])
      : [],
    applications: Array.isArray(s.applications)
      ? (s.applications as AgriApplication[])
      : [],
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

  return {
    fieldCount: activeFields.length,
    hectares: Math.round(ha * 10) / 10,
    cropCount: crops.size,
    crops: [...crops],
    estimateTonnes: Math.round(estTonnes * 10) / 10,
    harvestOpen: plannedCuts,
    applications: appsYtd,
    regenSamples,
    avgSoilOrganicCarbon: avgSoc != null ? Math.round(avgSoc * 100) / 100 : null,
    fleetLogs: store.fleet_logs.length,
    labourLogs: store.labour_logs.length,
  };
}

/** Simple harvest date projection: sequence order with daily allocation */
export function projectHarvestDates(
  items: AgriHarvestPlanItem[],
  fields: AgriField[],
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
      (e) => e.field_id === item.field_id && e.season === season
    );
    const tonnes = Number(est?.tonnes) || 0;
    const days = Math.max(1, Math.ceil(tonnes / dailyAllocationT));
    const planned = cursor.toISOString().slice(0, 10);
    const idx = updated.findIndex((x) => x.id === item.id);
    if (idx >= 0) {
      updated[idx] = {
        ...updated[idx],
        planned_date: planned,
        daily_allocation_t: dailyAllocationT,
        updated_at: new Date().toISOString(),
      };
    }
    cursor.setDate(cursor.getDate() + days);
  }
  return updated;
}
