import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  computeLabourCost,
  emptyFieldgraphStore,
  labourCostSummary,
  millBoardEstimateRows,
  newId,
  projectHarvestDates,
  readFieldgraphFromMetadata,
  summariseFieldgraph,
  vehicleUtilisation,
  writeFieldgraphToMetadata,
  yieldQualityBySeason,
  type AgriApplication,
  type AgriEstimate,
  type AgriField,
  type AgriFleetLog,
  type AgriGang,
  type AgriHarvestPlanItem,
  type AgriLabourLog,
  type AgriRegenSample,
  type AgriVehicle,
  type AgriYieldActual,
  type FieldgraphStore,
  type LabourEmploymentType,
  type LabourRateUnit,
} from '@/lib/agri/fieldgraph';

export const runtime = 'nodejs';

type Entity =
  | 'fields'
  | 'estimates'
  | 'yield_actuals'
  | 'harvest_plan'
  | 'applications'
  | 'vehicles'
  | 'fleet_logs'
  | 'gangs'
  | 'labour_logs'
  | 'regen_samples';

function analysisPayload(store: FieldgraphStore, season: string) {
  return {
    yieldBySeason: yieldQualityBySeason(store),
    vehicleUtilisation: vehicleUtilisation(store),
    millBoard: millBoardEstimateRows(store, season),
    labourCost: labourCostSummary(store),
  };
}

async function loadStore(companyId: number): Promise<{
  meta: Record<string, unknown>;
  store: FieldgraphStore;
}> {
  const supabase = getSupabaseServer();
  const { data: prof } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', companyId)
    .maybeSingle();
  const meta =
    prof?.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};
  return { meta, store: readFieldgraphFromMetadata(meta) };
}

async function saveStore(
  companyId: number,
  meta: Record<string, unknown>,
  store: FieldgraphStore
) {
  const supabase = getSupabaseServer();
  const nextMeta = writeFieldgraphToMetadata(meta, store);
  const { error } = await supabase
    .from('profiles')
    .update({
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId);
  if (error) throw new Error(error.message);
  return nextMeta;
}

/**
 * GET  /api/agri/fieldgraph?companyId=
 * POST /api/agri/fieldgraph  { companyId, entity, action, record?, id?, ... }
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const { store } = await loadStore(companyId);
    const season =
      request.nextUrl.searchParams.get('season') ||
      String(new Date().getFullYear());
    return NextResponse.json({
      success: true,
      store,
      summary: summariseFieldgraph(store),
      analysis: analysisPayload(store, season),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const action = String(body.action || 'upsert');
    const entity = String(body.entity || '') as Entity;
    const { meta, store } = await loadStore(companyId);
    const now = new Date().toISOString();

    if (action === 'seed_demo') {
      const demo = seedDemo(now);
      await saveStore(companyId, meta, demo);
      const y = String(new Date().getFullYear());
      return NextResponse.json({
        success: true,
        store: demo,
        summary: summariseFieldgraph(demo),
        analysis: analysisPayload(demo, y),
        message: 'Demo farm loaded',
      });
    }

    if (action === 'project_harvest') {
      const season = String(body.season || new Date().getFullYear());
      const startDate = String(body.startDate || now.slice(0, 10));
      const daily = Number(body.dailyAllocationT) || 120;
      store.harvest_plan = projectHarvestDates(
        store.harvest_plan,
        store.fields,
        store.estimates,
        season,
        startDate,
        daily
      );
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFieldgraph(store),
        analysis: analysisPayload(store, season),
        message: 'Harvest dates projected',
      });
    }

    if (action === 'delete') {
      const id = String(body.id || '');
      if (!id || !entity) {
        return NextResponse.json(
          { error: 'entity and id required' },
          { status: 400 }
        );
      }
      const key = entity as keyof FieldgraphStore;
      const list = store[key];
      if (Array.isArray(list)) {
        (store as Record<string, unknown>)[key] = list.filter(
          (row: { id?: string }) => row.id !== id
        );
      }
      await saveStore(companyId, meta, store);
      const delSeason = String(new Date().getFullYear());
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFieldgraph(store),
        analysis: analysisPayload(store, delSeason),
      });
    }

    // upsert
    if (!entity) {
      return NextResponse.json({ error: 'entity required' }, { status: 400 });
    }
    const rec = (body.record || body) as Record<string, unknown>;

    if (entity === 'fields') {
      const id = String(rec.id || newId('fld'));
      const existing = store.fields.findIndex((f) => f.id === id);
      const row: AgriField = {
        id,
        code: String(rec.code || `F-${store.fields.length + 1}`),
        name: String(rec.name || 'Field'),
        farm_name: rec.farm_name != null ? String(rec.farm_name) : undefined,
        crop: String(rec.crop || 'Mixed / other'),
        variety: rec.variety != null ? String(rec.variety) : undefined,
        hectares: Number(rec.hectares) || 0,
        season_year: rec.season_year != null ? Number(rec.season_year) : undefined,
        ratoon: rec.ratoon != null ? Number(rec.ratoon) : undefined,
        irrigation: (rec.irrigation as AgriField['irrigation']) || 'unknown',
        soil_type: rec.soil_type != null ? String(rec.soil_type) : undefined,
        plant_date: rec.plant_date != null ? String(rec.plant_date) : null,
        row_spacing_m:
          rec.row_spacing_m != null ? Number(rec.row_spacing_m) : null,
        population_per_ha:
          rec.population_per_ha != null
            ? Number(rec.population_per_ha)
            : null,
        slope_pct: rec.slope_pct != null ? Number(rec.slope_pct) : null,
        drainage: rec.drainage != null ? String(rec.drainage) : undefined,
        district: rec.district != null ? String(rec.district) : undefined,
        mill_group: rec.mill_group != null ? String(rec.mill_group) : undefined,
        lat: rec.lat != null ? Number(rec.lat) : null,
        lng: rec.lng != null ? Number(rec.lng) : null,
        notes: rec.notes != null ? String(rec.notes) : undefined,
        active: rec.active !== false,
        created_at:
          existing >= 0 ? store.fields[existing].created_at : now,
        updated_at: now,
      };
      if (existing >= 0) store.fields[existing] = row;
      else store.fields.push(row);
    } else if (entity === 'estimates') {
      const id = String(rec.id || newId('est'));
      const fieldId = String(rec.field_id || '');
      const field = store.fields.find((f) => f.id === fieldId);
      const tonnes = Number(rec.tonnes) || 0;
      const ha = field?.hectares || 0;
      const existing = store.estimates.findIndex((e) => e.id === id);
      const prev = existing >= 0 ? store.estimates[existing] : null;
      const quality =
        rec.quality_pct != null ? Number(rec.quality_pct) : null;
      const status = (rec.status as AgriEstimate['status']) || 'draft';
      const revisions = [...(prev?.revisions || [])];
      if (
        prev &&
        (prev.tonnes !== tonnes ||
          prev.quality_pct !== quality ||
          prev.status !== status)
      ) {
        revisions.push({
          at: now,
          tonnes: prev.tonnes,
          quality_pct: prev.quality_pct,
          status: prev.status,
          note: 'Auto snapshot before update',
        });
      }
      const row: AgriEstimate = {
        id,
        field_id: fieldId,
        season: String(rec.season || new Date().getFullYear()),
        tonnes,
        quality_pct: quality,
        tonnes_per_ha: ha > 0 ? Math.round((tonnes / ha) * 100) / 100 : null,
        status,
        board_ref:
          rec.board_ref != null
            ? String(rec.board_ref)
            : prev?.board_ref,
        revision: (prev?.revision || 0) + (prev ? 1 : 0) || 1,
        revisions: revisions.slice(-20),
        notes: rec.notes != null ? String(rec.notes) : undefined,
        updated_at: now,
      };
      if (existing >= 0) store.estimates[existing] = row;
      else store.estimates.push(row);
    } else if (entity === 'yield_actuals') {
      if (!store.yield_actuals) store.yield_actuals = [];
      const id = String(rec.id || newId('yld'));
      const fieldId = String(rec.field_id || '');
      const field = store.fields.find((f) => f.id === fieldId);
      const tonnes = Number(rec.tonnes) || 0;
      const ha = field?.hectares || 0;
      const existing = store.yield_actuals.findIndex((y) => y.id === id);
      const row: AgriYieldActual = {
        id,
        field_id: fieldId,
        season: String(rec.season || new Date().getFullYear()),
        tonnes,
        quality_pct:
          rec.quality_pct != null ? Number(rec.quality_pct) : null,
        tonnes_per_ha: ha > 0 ? Math.round((tonnes / ha) * 100) / 100 : null,
        harvested_at:
          rec.harvested_at != null ? String(rec.harvested_at) : null,
        notes: rec.notes != null ? String(rec.notes) : undefined,
        created_at:
          existing >= 0 ? store.yield_actuals[existing].created_at : now,
      };
      if (existing >= 0) store.yield_actuals[existing] = row;
      else store.yield_actuals.push(row);
    } else if (entity === 'harvest_plan') {
      const id = String(rec.id || newId('hvt'));
      const existing = store.harvest_plan.findIndex((h) => h.id === id);
      const fieldId = String(rec.field_id || '');
      const season = String(rec.season || new Date().getFullYear());
      const est = store.estimates.find(
        (e) => e.field_id === fieldId && e.season === season && e.status !== 'draft'
      );
      const row: AgriHarvestPlanItem = {
        id,
        field_id: fieldId,
        season,
        sequence: Number(rec.sequence) || store.harvest_plan.length + 1,
        planned_date:
          rec.planned_date != null ? String(rec.planned_date) : null,
        planned_end_date:
          rec.planned_end_date != null
            ? String(rec.planned_end_date)
            : existing >= 0
              ? store.harvest_plan[existing].planned_end_date
              : null,
        days_to_cut:
          rec.days_to_cut != null
            ? Number(rec.days_to_cut)
            : existing >= 0
              ? store.harvest_plan[existing].days_to_cut
              : null,
        estimated_tonnes:
          rec.estimated_tonnes != null
            ? Number(rec.estimated_tonnes)
            : est?.tonnes ?? null,
        daily_allocation_t:
          rec.daily_allocation_t != null
            ? Number(rec.daily_allocation_t)
            : null,
        destination:
          rec.destination != null ? String(rec.destination) : undefined,
        status: (rec.status as AgriHarvestPlanItem['status']) || 'planned',
        notes: rec.notes != null ? String(rec.notes) : undefined,
        updated_at: now,
      };
      if (existing >= 0) store.harvest_plan[existing] = row;
      else store.harvest_plan.push(row);
    } else if (entity === 'vehicles') {
      if (!store.vehicles) store.vehicles = [];
      const id = String(rec.id || newId('veh'));
      const existing = store.vehicles.findIndex((v) => v.id === id);
      const prev = existing >= 0 ? store.vehicles[existing] : null;
      const row: AgriVehicle = {
        id,
        code: String(rec.code || `V-${store.vehicles.length + 1}`),
        name: String(rec.name || 'Vehicle'),
        type: rec.type != null ? String(rec.type) : undefined,
        reg_no: rec.reg_no != null ? String(rec.reg_no) : undefined,
        odometer_km:
          rec.odometer_km != null
            ? Number(rec.odometer_km)
            : prev?.odometer_km ?? null,
        cost_per_hour_zar:
          rec.cost_per_hour_zar != null
            ? Number(rec.cost_per_hour_zar)
            : prev?.cost_per_hour_zar ?? null,
        cost_per_km_zar:
          rec.cost_per_km_zar != null
            ? Number(rec.cost_per_km_zar)
            : prev?.cost_per_km_zar ?? null,
        fuel_burn_l_h:
          rec.fuel_burn_l_h != null
            ? Number(rec.fuel_burn_l_h)
            : prev?.fuel_burn_l_h ?? null,
        fuel_price_zar_l:
          rec.fuel_price_zar_l != null
            ? Number(rec.fuel_price_zar_l)
            : prev?.fuel_price_zar_l ?? null,
        active: rec.active !== false,
        created_at: prev?.created_at || now,
      };
      if (existing >= 0) store.vehicles[existing] = row;
      else store.vehicles.push(row);
    } else if (entity === 'applications') {
      const id = String(rec.id || newId('app'));
      const existing = store.applications.findIndex((a) => a.id === id);
      const row: AgriApplication = {
        id,
        field_id: String(rec.field_id || ''),
        date: String(rec.date || now.slice(0, 10)),
        product: String(rec.product || 'Input'),
        category: (rec.category as AgriApplication['category']) || 'other',
        quantity: Number(rec.quantity) || 0,
        unit: String(rec.unit || 'kg'),
        n_kg_ha: rec.n_kg_ha != null ? Number(rec.n_kg_ha) : null,
        p_kg_ha: rec.p_kg_ha != null ? Number(rec.p_kg_ha) : null,
        k_kg_ha: rec.k_kg_ha != null ? Number(rec.k_kg_ha) : null,
        cost_zar: rec.cost_zar != null ? Number(rec.cost_zar) : null,
        notes: rec.notes != null ? String(rec.notes) : undefined,
        created_at:
          existing >= 0 ? store.applications[existing].created_at : now,
      };
      if (existing >= 0) store.applications[existing] = row;
      else store.applications.push(row);
    } else if (entity === 'fleet_logs') {
      const id = String(rec.id || newId('flt'));
      const existing = store.fleet_logs.findIndex((f) => f.id === id);
      const vehicleId =
        rec.vehicle_id != null ? String(rec.vehicle_id) : null;
      const veh = vehicleId
        ? (store.vehicles || []).find((v) => v.id === vehicleId)
        : null;
      const hours = rec.hours != null ? Number(rec.hours) : null;
      const km = rec.km != null ? Number(rec.km) : null;
      const fuel_l = rec.fuel_l != null ? Number(rec.fuel_l) : null;
      const fuel_price_zar_l =
        rec.fuel_price_zar_l != null
          ? Number(rec.fuel_price_zar_l)
          : veh?.fuel_price_zar_l != null
            ? Number(veh.fuel_price_zar_l)
            : null;
      let cost_zar =
        rec.cost_zar != null && rec.cost_zar !== ''
          ? Number(rec.cost_zar)
          : null;
      if (cost_zar == null) {
        const computed =
          (hours || 0) * (Number(veh?.cost_per_hour_zar) || 0) +
          (km || 0) * (Number(veh?.cost_per_km_zar) || 0) +
          (fuel_l || 0) * (fuel_price_zar_l || 0);
        if (computed > 0) cost_zar = Math.round(computed * 100) / 100;
      }
      const row: AgriFleetLog = {
        id,
        field_id: rec.field_id != null ? String(rec.field_id) : null,
        vehicle_id: vehicleId,
        date: String(rec.date || now.slice(0, 10)),
        vehicle: String(
          rec.vehicle || veh?.name || veh?.code || 'Vehicle'
        ),
        activity: String(rec.activity || 'Work'),
        hours,
        fuel_l,
        km,
        odometer_km:
          rec.odometer_km != null ? Number(rec.odometer_km) : null,
        fuel_price_zar_l,
        cost_zar,
        notes: rec.notes != null ? String(rec.notes) : undefined,
        created_at:
          existing >= 0 ? store.fleet_logs[existing].created_at : now,
      };
      // Roll odometer onto registry
      if (vehicleId && row.odometer_km != null) {
        const vi = (store.vehicles || []).findIndex((v) => v.id === vehicleId);
        if (vi >= 0) {
          store.vehicles[vi] = {
            ...store.vehicles[vi],
            odometer_km: row.odometer_km,
          };
        }
      }
      if (existing >= 0) store.fleet_logs[existing] = row;
      else store.fleet_logs.push(row);
    } else if (entity === 'gangs') {
      if (!store.gangs) store.gangs = [];
      const id = String(rec.id || newId('gng'));
      const existing = store.gangs.findIndex((g) => g.id === id);
      const prev = existing >= 0 ? store.gangs[existing] : null;
      const row: AgriGang = {
        id,
        code: String(rec.code || prev?.code || `G-${store.gangs.length + 1}`),
        name: String(rec.name || prev?.name || 'Gang'),
        employment_type:
          (rec.employment_type as LabourEmploymentType) ||
          prev?.employment_type ||
          'gang',
        rate_zar:
          rec.rate_zar !== undefined
            ? Number(rec.rate_zar) || 0
            : prev?.rate_zar || 0,
        rate_unit:
          (rec.rate_unit as LabourRateUnit) ||
          prev?.rate_unit ||
          'per_person_day',
        email:
          rec.email !== undefined
            ? rec.email
              ? String(rec.email)
              : undefined
            : prev?.email,
        phone:
          rec.phone !== undefined
            ? rec.phone
              ? String(rec.phone)
              : undefined
            : prev?.phone,
        hr_employee_id:
          rec.hr_employee_id !== undefined
            ? rec.hr_employee_id
              ? Number(rec.hr_employee_id)
              : null
            : prev?.hr_employee_id ?? null,
        active: rec.active !== false,
        notes:
          rec.notes !== undefined
            ? rec.notes
              ? String(rec.notes)
              : undefined
            : prev?.notes,
        created_at: prev?.created_at || now,
      };
      if (existing >= 0) store.gangs[existing] = row;
      else store.gangs.push(row);
    } else if (entity === 'labour_logs') {
      const id = String(rec.id || newId('lab'));
      const existing = store.labour_logs.findIndex((l) => l.id === id);
      const gangId =
        rec.gang_id != null && String(rec.gang_id)
          ? String(rec.gang_id)
          : null;
      const gang = gangId
        ? (store.gangs || []).find((g) => g.id === gangId)
        : null;
      const headcount =
        rec.headcount != null ? Number(rec.headcount) : null;
      const hours = rec.hours != null ? Number(rec.hours) : null;
      const quantity =
        rec.quantity != null ? Number(rec.quantity) : null;
      const rate_zar =
        rec.rate_zar != null && rec.rate_zar !== ''
          ? Number(rec.rate_zar)
          : gang?.rate_zar ?? null;
      const rate_unit =
        (rec.rate_unit as LabourRateUnit | null | undefined) ||
        gang?.rate_unit ||
        null;
      const employment_type =
        (rec.employment_type as LabourEmploymentType | undefined) ||
        gang?.employment_type ||
        'gang';
      const cost_zar =
        rec.cost_zar != null && rec.cost_zar !== ''
          ? Number(rec.cost_zar)
          : computeLabourCost({
              rate_zar,
              rate_unit,
              headcount,
              hours,
              quantity,
            });
      const row: AgriLabourLog = {
        id,
        field_id: rec.field_id != null ? String(rec.field_id) : null,
        gang_id: gangId,
        date: String(rec.date || now.slice(0, 10)),
        gang_or_person: String(
          rec.gang_or_person || gang?.name || gang?.code || 'Gang'
        ),
        activity: String(rec.activity || 'Work'),
        employment_type,
        headcount,
        hours,
        quantity,
        rate_zar,
        rate_unit,
        cost_zar,
        notes: rec.notes != null ? String(rec.notes) : undefined,
        created_at:
          existing >= 0 ? store.labour_logs[existing].created_at : now,
      };
      if (existing >= 0) store.labour_logs[existing] = row;
      else store.labour_logs.push(row);
    } else if (entity === 'regen_samples') {
      const id = String(rec.id || newId('rgn'));
      const existing = store.regen_samples.findIndex((r) => r.id === id);
      const row: AgriRegenSample = {
        id,
        field_id: String(rec.field_id || ''),
        date: String(rec.date || now.slice(0, 10)),
        soil_organic_carbon_pct:
          rec.soil_organic_carbon_pct != null
            ? Number(rec.soil_organic_carbon_pct)
            : null,
        moisture_pct:
          rec.moisture_pct != null ? Number(rec.moisture_pct) : null,
        cover_pct: rec.cover_pct != null ? Number(rec.cover_pct) : null,
        water_used_mm:
          rec.water_used_mm != null ? Number(rec.water_used_mm) : null,
        biodiversity_notes:
          rec.biodiversity_notes != null
            ? String(rec.biodiversity_notes)
            : undefined,
        created_at:
          existing >= 0 ? store.regen_samples[existing].created_at : now,
      };
      if (existing >= 0) store.regen_samples[existing] = row;
      else store.regen_samples.push(row);
    } else {
      return NextResponse.json({ error: 'Unknown entity' }, { status: 400 });
    }

    // Dual-write permanent gangs only → People directory
    let peopleSync: {
      employeeId: number | null;
      created?: boolean;
      error?: string;
    } | null = null;
    if (entity === 'gangs') {
      const gangId = String(
        rec.id || store.gangs?.[store.gangs.length - 1]?.id || ''
      );
      const gang = (store.gangs || []).find((g) => g.id === gangId);
      if (gang) {
        const { syncStoreStaffPersonToHr } = await import(
          '@/lib/hr/sync-service-person'
        );
        peopleSync = await syncStoreStaffPersonToHr({
          companyId,
          source: 'fieldgraph_gang',
          person: gang,
        });
      }
    }

    await saveStore(companyId, meta, store);
    const analysisSeason = String(
      (rec as { season?: string }).season || new Date().getFullYear()
    );
    return NextResponse.json({
      success: true,
      store,
      summary: summariseFieldgraph(store),
      analysis: analysisPayload(store, analysisSeason),
      people_sync: peopleSync,
      message:
        entity === 'gangs' && peopleSync?.employeeId
          ? peopleSync.created
            ? 'Permanent gang saved and added to People directory'
            : 'Permanent gang saved and People record updated'
          : entity === 'gangs' && peopleSync && !peopleSync.employeeId
            ? peopleSync.error ||
              'Gang saved — only permanent labour is dual-written to People'
            : undefined,
    });
  } catch (e: unknown) {
    console.error('[fieldgraph]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function seedDemo(now: string): FieldgraphStore {
  const y = new Date().getFullYear();
  const f1 = newId('fld');
  const f2 = newId('fld');
  const f3 = newId('fld');
  const v1 = newId('veh');
  const v2 = newId('veh');
  const g1 = newId('gng');
  const g2 = newId('gng');
  return {
    fields: [
      {
        id: f1,
        code: 'A12',
        name: 'River block',
        farm_name: 'Greenline Estate',
        crop: 'Sugar cane',
        variety: 'NCo376',
        hectares: 28.4,
        season_year: y - 1,
        ratoon: 2,
        irrigation: 'irrigated',
        soil_type: 'Hutton',
        plant_date: `${y - 1}-09-15`,
        row_spacing_m: 1.4,
        mill_group: 'North Coast MGB',
        district: 'KZN North Coast',
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: f2,
        code: 'B04',
        name: 'Hill maize',
        farm_name: 'Greenline Estate',
        crop: 'Maize',
        variety: 'PAN 6Q-745',
        hectares: 42,
        season_year: y,
        irrigation: 'dryland',
        soil_type: 'Clovelly',
        plant_date: `${y}-10-20`,
        population_per_ha: 55000,
        district: 'Midlands',
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: f3,
        code: 'C01',
        name: 'Valley citrus',
        farm_name: 'Greenline Estate',
        crop: 'Citrus',
        variety: 'Valencia',
        hectares: 12.5,
        season_year: y - 4,
        irrigation: 'irrigated',
        soil_type: 'Oakleaf',
        mill_group: 'Fresh pack',
        active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    estimates: [
      {
        id: newId('est'),
        field_id: f1,
        season: String(y - 1),
        tonnes: 2720,
        quality_pct: 12.1,
        tonnes_per_ha: 95.8,
        status: 'final',
        board_ref: `MGB-${y - 1}-A12`,
        revision: 2,
        revisions: [
          {
            at: `${y - 1}-06-01T10:00:00.000Z`,
            tonnes: 2600,
            quality_pct: 11.8,
            status: 'submitted',
            note: 'First board',
          },
        ],
        updated_at: now,
      },
      {
        id: newId('est'),
        field_id: f1,
        season: String(y),
        tonnes: 2840,
        quality_pct: 12.4,
        tonnes_per_ha: 100,
        status: 'board',
        board_ref: `MGB-${y}-A12`,
        revision: 1,
        updated_at: now,
      },
      {
        id: newId('est'),
        field_id: f2,
        season: String(y),
        tonnes: 336,
        quality_pct: 12.5,
        tonnes_per_ha: 8,
        status: 'draft',
        revision: 1,
        updated_at: now,
      },
    ],
    yield_actuals: [
      {
        id: newId('yld'),
        field_id: f1,
        season: String(y - 1),
        tonnes: 2688,
        quality_pct: 12.0,
        tonnes_per_ha: 94.6,
        harvested_at: `${y - 1}-08-20`,
        created_at: now,
      },
      {
        id: newId('yld'),
        field_id: f2,
        season: String(y - 1),
        tonnes: 310,
        quality_pct: 13.0,
        tonnes_per_ha: 7.4,
        harvested_at: `${y - 1}-05-12`,
        created_at: now,
      },
    ],
    harvest_plan: [
      {
        id: newId('hvt'),
        field_id: f1,
        season: String(y),
        sequence: 1,
        planned_date: null,
        estimated_tonnes: 2840,
        destination: 'Mill / North Coast',
        status: 'planned',
        updated_at: now,
      },
      {
        id: newId('hvt'),
        field_id: f2,
        season: String(y),
        sequence: 2,
        planned_date: null,
        estimated_tonnes: 336,
        destination: 'Silo / trader',
        status: 'planned',
        updated_at: now,
      },
    ],
    applications: [
      {
        id: newId('app'),
        field_id: f1,
        date: now.slice(0, 10),
        product: 'LAN 28%',
        category: 'fertiliser',
        quantity: 400,
        unit: 'kg',
        n_kg_ha: 56,
        p_kg_ha: 0,
        k_kg_ha: 0,
        cost_zar: 4800,
        created_at: now,
      },
    ],
    vehicles: [
      {
        id: v1,
        code: 'T02',
        name: 'Tractor 02',
        type: 'Tractor',
        reg_no: 'NP 123-456',
        cost_per_hour_zar: 420,
        fuel_burn_l_h: 12,
        fuel_price_zar_l: 24.5,
        active: true,
        created_at: now,
      },
      {
        id: v2,
        code: 'H01',
        name: 'Hauler 01',
        type: 'Truck',
        reg_no: 'NP 987-654',
        odometer_km: 124500,
        cost_per_hour_zar: 380,
        cost_per_km_zar: 8.5,
        fuel_burn_l_h: 18,
        fuel_price_zar_l: 24.5,
        active: true,
        created_at: now,
      },
    ],
    fleet_logs: [
      {
        id: newId('flt'),
        field_id: f1,
        vehicle_id: v1,
        date: now.slice(0, 10),
        vehicle: 'Tractor 02',
        activity: 'Rip / ridge',
        hours: 6.5,
        fuel_l: 48,
        km: 22,
        fuel_price_zar_l: 24.5,
        created_at: now,
      },
      {
        id: newId('flt'),
        field_id: f1,
        vehicle_id: v2,
        date: now.slice(0, 10),
        vehicle: 'Hauler 01',
        activity: 'Cane haul',
        hours: 4,
        fuel_l: 62,
        km: 48,
        odometer_km: 124548,
        fuel_price_zar_l: 24.5,
        created_at: now,
      },
      {
        id: newId('flt'),
        field_id: f2,
        vehicle_id: v1,
        date: now.slice(0, 10),
        vehicle: 'Tractor 02',
        activity: 'Planting',
        hours: 8,
        fuel_l: 55,
        km: 18,
        fuel_price_zar_l: 24.5,
        created_at: now,
      },
    ],
    gangs: [
      {
        id: g1,
        code: 'GA',
        name: 'Cutting gang A',
        employment_type: 'temporary',
        rate_zar: 280,
        rate_unit: 'per_person_day',
        active: true,
        notes: 'Seasonal cutters',
        created_at: now,
      },
      {
        id: g2,
        code: 'PERM',
        name: 'Permanent field crew',
        employment_type: 'permanent',
        rate_zar: 45,
        rate_unit: 'per_person_hour',
        active: true,
        created_at: now,
      },
    ],
    labour_logs: [
      {
        id: newId('lab'),
        field_id: f1,
        gang_id: g1,
        date: now.slice(0, 10),
        gang_or_person: 'Cutting gang A',
        activity: 'Weed control',
        employment_type: 'temporary',
        headcount: 12,
        hours: 8,
        rate_zar: 280,
        rate_unit: 'per_person_day',
        cost_zar: computeLabourCost({
          rate_zar: 280,
          rate_unit: 'per_person_day',
          headcount: 12,
          hours: 8,
        }),
        created_at: now,
      },
      {
        id: newId('lab'),
        field_id: f1,
        gang_id: g2,
        date: now.slice(0, 10),
        gang_or_person: 'Permanent field crew',
        activity: 'Irrigation check',
        employment_type: 'permanent',
        headcount: 3,
        hours: 6,
        rate_zar: 45,
        rate_unit: 'per_person_hour',
        cost_zar: computeLabourCost({
          rate_zar: 45,
          rate_unit: 'per_person_hour',
          headcount: 3,
          hours: 6,
        }),
        created_at: now,
      },
    ],
    regen_samples: [
      {
        id: newId('rgn'),
        field_id: f1,
        date: now.slice(0, 10),
        soil_organic_carbon_pct: 1.8,
        moisture_pct: 22,
        cover_pct: 65,
        water_used_mm: 18,
        biodiversity_notes: 'Cover crop strip on headlands',
        created_at: now,
      },
    ],
    updated_at: now,
  };
}
