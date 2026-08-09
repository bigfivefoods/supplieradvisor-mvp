/**
 * Fieldgraph® slice-and-dice report builders.
 * Filters store entities by period + dimensions (season, crop, farm, field…).
 */
import {
  labourCostSummary,
  vehicleUtilisation,
  type AgriField,
  type FieldgraphStore,
} from '@/lib/agri/fieldgraph';

export type FieldgraphReportId =
  | 'overview'
  | 'yield'
  | 'harvest'
  | 'fleet'
  | 'labour'
  | 'inputs'
  | 'regen';

export const FIELDGRAPH_REPORTS: Array<{
  id: FieldgraphReportId;
  label: string;
}> = [
  { id: 'overview', label: 'Overview' },
  { id: 'yield', label: 'Yield' },
  { id: 'harvest', label: 'Harvest' },
  { id: 'fleet', label: 'Fleet' },
  { id: 'labour', label: 'Labour' },
  { id: 'inputs', label: 'Inputs' },
  { id: 'regen', label: 'Regen' },
];

export type FieldgraphDiceFilters = {
  /** Inclusive YYYY-MM-DD from PeriodSlicer */
  from: string;
  to: string;
  /** Season keys e.g. "2026" — empty = all */
  seasons: string[];
  /** Crop names — empty = all */
  crops: string[];
  /** Farm names — empty = all */
  farms: string[];
  /** Mill groups — empty = all */
  millGroups: string[];
  /** Field ids — empty = all */
  fieldIds: string[];
  /** permanent | temporary | contractor | gang — empty = all */
  employmentTypes: string[];
};

export function emptyDiceFilters(
  from: string,
  to: string
): FieldgraphDiceFilters {
  return {
    from,
    to,
    seasons: [],
    crops: [],
    farms: [],
    millGroups: [],
    fieldIds: [],
    employmentTypes: [],
  };
}

function inDateRange(date: string | null | undefined, from: string, to: string) {
  if (!date) return false;
  const d = date.slice(0, 10);
  return d >= from && d <= to;
}

function fieldMatches(
  f: AgriField | undefined,
  filters: FieldgraphDiceFilters
): boolean {
  if (!f) return filters.fieldIds.length === 0 && filters.crops.length === 0;
  if (filters.fieldIds.length && !filters.fieldIds.includes(f.id)) return false;
  if (filters.crops.length && !filters.crops.includes(String(f.crop)))
    return false;
  if (filters.farms.length) {
    const farm = f.farm_name || '—';
    if (!filters.farms.includes(farm)) return false;
  }
  if (filters.millGroups.length) {
    const mg = f.mill_group || '—';
    if (!filters.millGroups.includes(mg)) return false;
  }
  return true;
}

function seasonOk(season: string, filters: FieldgraphDiceFilters) {
  if (!filters.seasons.length) return true;
  return filters.seasons.includes(season);
}

export function diceDimensionOptions(store: FieldgraphStore) {
  const seasons = new Set<string>();
  const crops = new Set<string>();
  const farms = new Set<string>();
  const millGroups = new Set<string>();
  for (const f of store.fields) {
    if (f.crop) crops.add(String(f.crop));
    farms.add(f.farm_name || '—');
    if (f.mill_group) millGroups.add(f.mill_group);
  }
  for (const e of store.estimates) seasons.add(e.season);
  for (const a of store.yield_actuals || []) seasons.add(a.season);
  for (const h of store.harvest_plan) seasons.add(h.season);
  const employmentTypes = [
    'permanent',
    'temporary',
    'contractor',
    'gang',
  ] as const;
  return {
    seasons: [...seasons].sort().reverse(),
    crops: [...crops].sort(),
    farms: [...farms].sort(),
    millGroups: [...millGroups].sort(),
    fields: store.fields
      .filter((f) => f.active !== false)
      .map((f) => ({ id: f.id, code: f.code, name: f.name, crop: f.crop })),
    employmentTypes: [...employmentTypes],
  };
}

export type FieldgraphReportBundle = {
  filters: FieldgraphDiceFilters;
  kpis: Record<string, number | string | null>;
  byCrop: Array<{
    crop: string;
    fields: number;
    hectares: number;
    estimate_t: number;
    actual_t: number;
  }>;
  byField: Array<{
    field_id: string;
    code: string;
    name: string;
    crop: string;
    hectares: number;
    estimate_t: number;
    actual_t: number;
    quality_est: number | null;
    apps: number;
    labour_cost: number;
    fuel_l: number;
  }>;
  bySeason: Array<{
    season: string;
    estimate_t: number;
    actual_t: number;
    fields: number;
  }>;
  harvest: Array<{
    sequence: number;
    field_code: string;
    crop: string;
    season: string;
    tonnes: number | null;
    planned_date: string | null;
    planned_end_date: string | null;
    days: number | null;
    destination: string;
    status: string;
  }>;
  fleetByVehicle: Array<{
    vehicle: string;
    hours: number;
    fuel_l: number;
    km: number;
    l_per_hour: number | null;
    l_per_km: number | null;
    cost_per_km: number | null;
    fuel_util_pct: number | null;
    cost_zar: number;
    logs: number;
  }>;
  fleetLogs: Array<{
    date: string;
    vehicle: string;
    field_code: string;
    activity: string;
    hours: number | null;
    fuel_l: number | null;
    km: number | null;
  }>;
  labourByType: Array<{
    type: string;
    cost: number;
    hours: number;
    logs: number;
  }>;
  labourByGang: Array<{
    gang: string;
    cost: number;
    hours: number;
    logs: number;
  }>;
  labourLogs: Array<{
    date: string;
    gang: string;
    type: string;
    field_code: string;
    activity: string;
    headcount: number | null;
    hours: number | null;
    rate_zar: number | null;
    cost_zar: number | null;
  }>;
  inputsByCategory: Array<{
    category: string;
    lines: number;
    quantity: number;
    cost_zar: number;
    n_kg: number;
    p_kg: number;
    k_kg: number;
  }>;
  applications: Array<{
    date: string;
    field_code: string;
    product: string;
    category: string;
    quantity: number;
    unit: string;
    cost_zar: number | null;
  }>;
  regen: Array<{
    date: string;
    field_code: string;
    soc: number | null;
    moisture: number | null;
    cover: number | null;
    water_mm: number | null;
  }>;
  regenAvg: {
    soc: number | null;
    moisture: number | null;
    cover: number | null;
    samples: number;
  };
};

/**
 * Build a full slice-and-dice report from the Fieldgraph store.
 */
export function buildFieldgraphReport(
  store: FieldgraphStore,
  filters: FieldgraphDiceFilters
): FieldgraphReportBundle {
  const fields = store.fields.filter(
    (f) => f.active !== false && fieldMatches(f, filters)
  );
  const fieldIds = new Set(fields.map((f) => f.id));
  const fieldMap = new Map(store.fields.map((f) => [f.id, f]));

  const estimates = store.estimates.filter((e) => {
    if (!seasonOk(e.season, filters)) return false;
    const f = fieldMap.get(e.field_id);
    return fieldMatches(f, filters);
  });

  const actuals = (store.yield_actuals || []).filter((a) => {
    if (!seasonOk(a.season, filters)) return false;
    const f = fieldMap.get(a.field_id);
    return fieldMatches(f, filters);
  });

  const harvest = store.harvest_plan
    .filter((h) => {
      if (!seasonOk(h.season, filters)) return false;
      const f = fieldMap.get(h.field_id);
      return fieldMatches(f, filters);
    })
    .sort((a, b) => a.sequence - b.sequence);

  const fleetLogs = store.fleet_logs.filter((l) => {
    if (!inDateRange(l.date, filters.from, filters.to)) return false;
    if (l.field_id) {
      const f = fieldMap.get(l.field_id);
      return fieldMatches(f, filters);
    }
    // unassigned field: only include if no field/crop filters
    return (
      !filters.fieldIds.length &&
      !filters.crops.length &&
      !filters.farms.length &&
      !filters.millGroups.length
    );
  });

  const labourLogs = store.labour_logs.filter((l) => {
    if (!inDateRange(l.date, filters.from, filters.to)) return false;
    if (
      filters.employmentTypes.length &&
      !filters.employmentTypes.includes(l.employment_type || 'gang')
    )
      return false;
    if (l.field_id) {
      const f = fieldMap.get(l.field_id);
      return fieldMatches(f, filters);
    }
    return (
      !filters.fieldIds.length &&
      !filters.crops.length &&
      !filters.farms.length &&
      !filters.millGroups.length
    );
  });

  const applications = store.applications.filter((a) => {
    if (!inDateRange(a.date, filters.from, filters.to)) return false;
    const f = fieldMap.get(a.field_id);
    return fieldMatches(f, filters);
  });

  const regenSamples = store.regen_samples.filter((r) => {
    if (!inDateRange(r.date, filters.from, filters.to)) return false;
    const f = fieldMap.get(r.field_id);
    return fieldMatches(f, filters);
  });

  // Sub-stores for reuse of existing rollups
  const fleetStore: FieldgraphStore = {
    ...store,
    fleet_logs: fleetLogs,
  };
  const labourStore: FieldgraphStore = {
    ...store,
    labour_logs: labourLogs,
  };

  const ha = fields.reduce((n, f) => n + (Number(f.hectares) || 0), 0);
  const estTonnes = estimates
    .filter((e) => e.status !== 'draft')
    .reduce((n, e) => n + (Number(e.tonnes) || 0), 0);
  const actTonnes = actuals.reduce((n, a) => n + (Number(a.tonnes) || 0), 0);
  const labour = labourCostSummary(labourStore);
  const fleetUtil = vehicleUtilisation(fleetStore);
  const fuel = fleetLogs.reduce((n, l) => n + (Number(l.fuel_l) || 0), 0);
  const fleetHours = fleetLogs.reduce((n, l) => n + (Number(l.hours) || 0), 0);
  const inputCost = applications.reduce(
    (n, a) => n + (Number(a.cost_zar) || 0),
    0
  );
  const harvestOpen = harvest.filter(
    (h) => h.status === 'planned' || h.status === 'cutting'
  ).length;

  const socVals = regenSamples
    .map((r) => r.soil_organic_carbon_pct)
    .filter((v): v is number => v != null);
  const moistVals = regenSamples
    .map((r) => r.moisture_pct)
    .filter((v): v is number => v != null);
  const coverVals = regenSamples
    .map((r) => r.cover_pct)
    .filter((v): v is number => v != null);
  const avg = (xs: number[]) =>
    xs.length
      ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100
      : null;

  // by crop
  const cropMap = new Map<
    string,
    {
      crop: string;
      fields: number;
      hectares: number;
      estimate_t: number;
      actual_t: number;
    }
  >();
  for (const f of fields) {
    const crop = String(f.crop || 'Other');
    const row = cropMap.get(crop) || {
      crop,
      fields: 0,
      hectares: 0,
      estimate_t: 0,
      actual_t: 0,
    };
    row.fields += 1;
    row.hectares += Number(f.hectares) || 0;
    cropMap.set(crop, row);
  }
  for (const e of estimates) {
    if (e.status === 'draft') continue;
    const f = fieldMap.get(e.field_id);
    const crop = String(f?.crop || 'Other');
    const row = cropMap.get(crop) || {
      crop,
      fields: 0,
      hectares: 0,
      estimate_t: 0,
      actual_t: 0,
    };
    row.estimate_t += Number(e.tonnes) || 0;
    cropMap.set(crop, row);
  }
  for (const a of actuals) {
    const f = fieldMap.get(a.field_id);
    const crop = String(f?.crop || 'Other');
    const row = cropMap.get(crop) || {
      crop,
      fields: 0,
      hectares: 0,
      estimate_t: 0,
      actual_t: 0,
    };
    row.actual_t += Number(a.tonnes) || 0;
    cropMap.set(crop, row);
  }

  // by season
  const seasonMap = new Map<
    string,
    { season: string; estimate_t: number; actual_t: number; fields: Set<string> }
  >();
  for (const e of estimates) {
    const row = seasonMap.get(e.season) || {
      season: e.season,
      estimate_t: 0,
      actual_t: 0,
      fields: new Set<string>(),
    };
    if (e.status !== 'draft') row.estimate_t += Number(e.tonnes) || 0;
    row.fields.add(e.field_id);
    seasonMap.set(e.season, row);
  }
  for (const a of actuals) {
    const row = seasonMap.get(a.season) || {
      season: a.season,
      estimate_t: 0,
      actual_t: 0,
      fields: new Set<string>(),
    };
    row.actual_t += Number(a.tonnes) || 0;
    row.fields.add(a.field_id);
    seasonMap.set(a.season, row);
  }

  // by field detail
  const labourCostByField = new Map<string, number>();
  for (const l of labourLogs) {
    if (!l.field_id) continue;
    labourCostByField.set(
      l.field_id,
      (labourCostByField.get(l.field_id) || 0) + (Number(l.cost_zar) || 0)
    );
  }
  const fuelByField = new Map<string, number>();
  for (const l of fleetLogs) {
    if (!l.field_id) continue;
    fuelByField.set(
      l.field_id,
      (fuelByField.get(l.field_id) || 0) + (Number(l.fuel_l) || 0)
    );
  }

  const byField = fields.map((f) => {
    const ests = estimates.filter((e) => e.field_id === f.id);
    const acts = actuals.filter((a) => a.field_id === f.id);
    const latestEst = [...ests].sort((a, b) =>
      b.season.localeCompare(a.season)
    )[0];
    return {
      field_id: f.id,
      code: f.code,
      name: f.name,
      crop: String(f.crop),
      hectares: f.hectares,
      estimate_t: Math.round(
        ests
          .filter((e) => e.status !== 'draft')
          .reduce((n, e) => n + (Number(e.tonnes) || 0), 0) * 10
      ) / 10,
      actual_t: Math.round(
        acts.reduce((n, a) => n + (Number(a.tonnes) || 0), 0) * 10
      ) / 10,
      quality_est: latestEst?.quality_pct ?? null,
      apps: applications.filter((a) => a.field_id === f.id).length,
      labour_cost:
        Math.round((labourCostByField.get(f.id) || 0) * 100) / 100,
      fuel_l: Math.round((fuelByField.get(f.id) || 0) * 10) / 10,
    };
  });

  // inputs by category
  const catMap = new Map<
    string,
    {
      category: string;
      lines: number;
      quantity: number;
      cost_zar: number;
      n_kg: number;
      p_kg: number;
      k_kg: number;
    }
  >();
  for (const a of applications) {
    const cat = a.category || 'other';
    const row = catMap.get(cat) || {
      category: cat,
      lines: 0,
      quantity: 0,
      cost_zar: 0,
      n_kg: 0,
      p_kg: 0,
      k_kg: 0,
    };
    row.lines += 1;
    row.quantity += Number(a.quantity) || 0;
    row.cost_zar += Number(a.cost_zar) || 0;
    row.n_kg += Number(a.n_kg_ha) || 0;
    row.p_kg += Number(a.p_kg_ha) || 0;
    row.k_kg += Number(a.k_kg_ha) || 0;
    catMap.set(cat, row);
  }

  const codeOf = (id?: string | null) => {
    if (!id) return '—';
    return fieldMap.get(id)?.code || id.slice(-6);
  };

  return {
    filters,
    kpis: {
      fields: fields.length,
      hectares: Math.round(ha * 10) / 10,
      crops: new Set(fields.map((f) => f.crop)).size,
      estimateTonnes: Math.round(estTonnes * 10) / 10,
      actualTonnes: Math.round(actTonnes * 10) / 10,
      harvestOpen,
      harvestRows: harvest.length,
      fleetLogs: fleetLogs.length,
      fleetHours: Math.round(fleetHours * 10) / 10,
      fuelL: Math.round(fuel * 10) / 10,
      labourLogs: labourLogs.length,
      labourCostZar: labour.totalCost,
      labourHours: labour.totalHours,
      applications: applications.length,
      inputCostZar: Math.round(inputCost * 100) / 100,
      regenSamples: regenSamples.length,
      avgSoc: avg(socVals),
      fieldIdsInSlice: fieldIds.size,
    },
    byCrop: [...cropMap.values()]
      .map((r) => ({
        ...r,
        hectares: Math.round(r.hectares * 10) / 10,
        estimate_t: Math.round(r.estimate_t * 10) / 10,
        actual_t: Math.round(r.actual_t * 10) / 10,
      }))
      .sort((a, b) => b.estimate_t - a.estimate_t),
    byField: byField.sort((a, b) => a.code.localeCompare(b.code)),
    bySeason: [...seasonMap.values()]
      .map((r) => ({
        season: r.season,
        estimate_t: Math.round(r.estimate_t * 10) / 10,
        actual_t: Math.round(r.actual_t * 10) / 10,
        fields: r.fields.size,
      }))
      .sort((a, b) => b.season.localeCompare(a.season)),
    harvest: harvest.map((h) => {
      const f = fieldMap.get(h.field_id);
      return {
        sequence: h.sequence,
        field_code: f?.code || h.field_id,
        crop: String(f?.crop || ''),
        season: h.season,
        tonnes: h.estimated_tonnes ?? null,
        planned_date: h.planned_date ?? null,
        planned_end_date: h.planned_end_date ?? null,
        days: h.days_to_cut ?? null,
        destination: h.destination || '—',
        status: h.status,
      };
    }),
    fleetByVehicle: fleetUtil.map((u) => ({
      vehicle: u.vehicle,
      hours: u.hours,
      fuel_l: u.fuel_l,
      km: u.km,
      l_per_hour: u.l_per_hour,
      l_per_km: u.l_per_km,
      cost_per_km: u.cost_per_km,
      fuel_util_pct: u.fuel_util_pct,
      cost_zar: u.cost_zar,
      logs: u.logs,
    })),
    fleetLogs: [...fleetLogs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 200)
      .map((l) => ({
        date: l.date,
        vehicle: l.vehicle,
        field_code: codeOf(l.field_id),
        activity: l.activity,
        hours: l.hours ?? null,
        fuel_l: l.fuel_l ?? null,
        km: l.km ?? null,
      })),
    labourByType: labour.byEmployment.map((r) => ({
      type: r.type,
      cost: r.cost,
      hours: r.hours,
      logs: r.logs,
    })),
    labourByGang: labour.byGang.map((r) => ({
      gang: r.gang,
      cost: r.cost,
      hours: r.hours,
      logs: r.logs,
    })),
    labourLogs: [...labourLogs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 200)
      .map((l) => ({
        date: l.date,
        gang: l.gang_or_person,
        type: l.employment_type || 'gang',
        field_code: codeOf(l.field_id),
        activity: l.activity,
        headcount: l.headcount ?? null,
        hours: l.hours ?? null,
        rate_zar: l.rate_zar ?? null,
        cost_zar: l.cost_zar ?? null,
      })),
    inputsByCategory: [...catMap.values()]
      .map((r) => ({
        ...r,
        quantity: Math.round(r.quantity * 10) / 10,
        cost_zar: Math.round(r.cost_zar * 100) / 100,
        n_kg: Math.round(r.n_kg * 10) / 10,
        p_kg: Math.round(r.p_kg * 10) / 10,
        k_kg: Math.round(r.k_kg * 10) / 10,
      }))
      .sort((a, b) => b.cost_zar - a.cost_zar),
    applications: [...applications]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 200)
      .map((a) => ({
        date: a.date,
        field_code: codeOf(a.field_id),
        product: a.product,
        category: a.category,
        quantity: a.quantity,
        unit: a.unit,
        cost_zar: a.cost_zar ?? null,
      })),
    regen: [...regenSamples]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 200)
      .map((r) => ({
        date: r.date,
        field_code: codeOf(r.field_id),
        soc: r.soil_organic_carbon_pct ?? null,
        moisture: r.moisture_pct ?? null,
        cover: r.cover_pct ?? null,
        water_mm: r.water_used_mm ?? null,
      })),
    regenAvg: {
      soc: avg(socVals),
      moisture: avg(moistVals),
      cover: avg(coverVals),
      samples: regenSamples.length,
    },
  };
}

export function reportToCsv(
  report: FieldgraphReportId,
  bundle: FieldgraphReportBundle
): string {
  const lines: string[] = [];
  const push = (row: Array<string | number | null | undefined>) =>
    lines.push(row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','));

  if (report === 'yield' || report === 'overview') {
    push(['field_code', 'name', 'crop', 'ha', 'estimate_t', 'actual_t', 'quality_est', 'labour_cost', 'fuel_l']);
    for (const r of bundle.byField) {
      push([
        r.code,
        r.name,
        r.crop,
        r.hectares,
        r.estimate_t,
        r.actual_t,
        r.quality_est,
        r.labour_cost,
        r.fuel_l,
      ]);
    }
  } else if (report === 'harvest') {
    push(['seq', 'field', 'crop', 'season', 'tonnes', 'start', 'end', 'days', 'destination', 'status']);
    for (const r of bundle.harvest) {
      push([
        r.sequence,
        r.field_code,
        r.crop,
        r.season,
        r.tonnes,
        r.planned_date,
        r.planned_end_date,
        r.days,
        r.destination,
        r.status,
      ]);
    }
  } else if (report === 'fleet') {
    push([
      'vehicle',
      'hours',
      'fuel_l',
      'km',
      'l_per_hour',
      'l_per_km',
      'cost_per_km',
      'fuel_util_pct',
      'cost_zar',
      'logs',
    ]);
    for (const r of bundle.fleetByVehicle) {
      push([
        r.vehicle,
        r.hours,
        r.fuel_l,
        r.km,
        r.l_per_hour,
        r.l_per_km,
        r.cost_per_km,
        r.fuel_util_pct,
        r.cost_zar,
        r.logs,
      ]);
    }
  } else if (report === 'labour') {
    push(['date', 'gang', 'type', 'field', 'activity', 'headcount', 'hours', 'rate', 'cost']);
    for (const r of bundle.labourLogs) {
      push([
        r.date,
        r.gang,
        r.type,
        r.field_code,
        r.activity,
        r.headcount,
        r.hours,
        r.rate_zar,
        r.cost_zar,
      ]);
    }
  } else if (report === 'inputs') {
    push(['date', 'field', 'product', 'category', 'qty', 'unit', 'cost']);
    for (const r of bundle.applications) {
      push([
        r.date,
        r.field_code,
        r.product,
        r.category,
        r.quantity,
        r.unit,
        r.cost_zar,
      ]);
    }
  } else if (report === 'regen') {
    push(['date', 'field', 'soc_pct', 'moisture_pct', 'cover_pct', 'water_mm']);
    for (const r of bundle.regen) {
      push([r.date, r.field_code, r.soc, r.moisture, r.cover, r.water_mm]);
    }
  } else {
    push(['metric', 'value']);
    for (const [k, v] of Object.entries(bundle.kpis)) {
      push([k, v]);
    }
  }
  return lines.join('\n');
}
