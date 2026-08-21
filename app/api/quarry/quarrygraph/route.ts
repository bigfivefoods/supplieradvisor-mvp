import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  buildKeyReports,
  computeLabourCost,
  newId,
  projectProductionDates,
  readQuarrygraphFromMetadata,
  summariseQuarrygraph,
  writeQuarrygraphToMetadata,
  QUARRYGRAPH_META_KEY,
  type AggregateProduct,
  type BlastLog,
  type CompliancePermit,
  type DispatchTicket,
  type PlantRun,
  type ProductionPlanItem,
  type QualityTest,
  type QuarryCrew,
  type QuarryFleetLog,
  type QuarryLabourLog,
  type QuarryOperation,
  type QuarrySite,
  type QuarryVehicle,
  type QuarrygraphStore,
  type ReserveEstimate,
  type ResourceAllocation,
  type Stockpile,
  type LabourEmploymentType,
  type LabourRateUnit,
} from '@/lib/quarry/quarrygraph';
import {
  loadAdvisorModuleStore,
  saveAdvisorModuleStore,
} from '@/lib/business/company-data';

export const runtime = 'nodejs';

type Entity =
  | 'quarries'
  | 'sites'
  | 'products'
  | 'reserves'
  | 'production_plan'
  | 'blasts'
  | 'plant_runs'
  | 'stockpiles'
  | 'dispatches'
  | 'vehicles'
  | 'fleet_logs'
  | 'crews'
  | 'labour_logs'
  | 'quality_tests'
  | 'permits'
  | 'allocations';

async function loadStore(companyId: number, opts?: { fresh?: boolean }) {
  return loadAdvisorModuleStore(
    companyId,
    QUARRYGRAPH_META_KEY,
    readQuarrygraphFromMetadata,
    [],
    opts
  );
}

async function saveStore(
  companyId: number,
  _meta: Record<string, unknown>,
  store: QuarrygraphStore
) {
  await saveAdvisorModuleStore(
    companyId,
    QUARRYGRAPH_META_KEY,
    store,
    writeQuarrygraphToMetadata
  );
}

function analysisPayload(store: QuarrygraphStore) {
  const reports = buildKeyReports(store);
  return {
    ...reports,
    productionByProduct: reports.byProduct,
    vehicleUtilisation: reports.vehicleMetrics,
    labourCost: reports.labourCost,
  };
}

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
    return NextResponse.json({
      success: true,
      store,
      summary: summariseQuarrygraph(store),
      analysis: analysisPayload(store),
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
    const { meta, store } = await loadStore(companyId, { fresh: true });
    const now = new Date().toISOString();

    if (action === 'seed_demo') {
      const demo = seedDemo(now);
      await saveStore(companyId, meta, demo);
      return NextResponse.json({
        success: true,
        store: demo,
        summary: summariseQuarrygraph(demo),
        analysis: analysisPayload(demo),
        message: 'Demo quarry loaded',
      });
    }

    if (action === 'project_production') {
      const season = String(body.season || new Date().getFullYear());
      const startDate = String(body.startDate || now.slice(0, 10));
      const daily = Number(body.dailyAllocationT) || 800;
      store.production_plan = projectProductionDates(
        store.production_plan,
        store.reserves,
        season,
        startDate,
        daily
      );
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseQuarrygraph(store),
        analysis: analysisPayload(store),
        message: 'Production dates projected',
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
      const key = entity as keyof QuarrygraphStore;
      const list = store[key];
      if (Array.isArray(list)) {
        (store as Record<string, unknown>)[key] = list.filter(
          (row: { id?: string }) => row.id !== id
        );
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseQuarrygraph(store),
        analysis: analysisPayload(store),
      });
    }

    if (!entity) {
      return NextResponse.json({ error: 'entity required' }, { status: 400 });
    }
    const rec = (body.record || body) as Record<string, unknown>;

    upsertEntity(store, entity, rec, now);

    // Dual-write permanent crews only → People directory
    let peopleSync: {
      employeeId: number | null;
      created?: boolean;
      error?: string;
    } | null = null;
    if (entity === 'crews') {
      const crewId = String(
        rec.id || store.crews[store.crews.length - 1]?.id || ''
      );
      const crew = store.crews.find((c) => c.id === crewId);
      if (crew) {
        const { syncStoreStaffPersonToHr } = await import(
          '@/lib/hr/sync-service-person'
        );
        peopleSync = await syncStoreStaffPersonToHr({
          companyId,
          source: 'quarrygraph_crew',
          person: crew,
        });
      }
    }

    await saveStore(companyId, meta, store);
    return NextResponse.json({
      success: true,
      store,
      summary: summariseQuarrygraph(store),
      analysis: analysisPayload(store),
      people_sync: peopleSync,
      message:
        entity === 'crews' && peopleSync?.employeeId
          ? peopleSync.created
            ? 'Permanent crew saved and added to People directory'
            : 'Permanent crew saved and People record updated'
          : entity === 'crews' && peopleSync && !peopleSync.employeeId
            ? peopleSync.error ||
              'Crew saved — only permanent labour is dual-written to People'
            : undefined,
    });
  } catch (e: unknown) {
    console.error('[quarrygraph]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function upsertEntity(
  store: QuarrygraphStore,
  entity: Entity,
  rec: Record<string, unknown>,
  now: string
) {
  if (!store.quarries) store.quarries = [];
  if (!store.allocations) store.allocations = [];

  if (entity === 'quarries') {
    const id = String(rec.id || newId('qry'));
    const existing = store.quarries.findIndex((q) => q.id === id);
    const prev = existing >= 0 ? store.quarries[existing] : null;
    const kind = String(rec.kind || prev?.kind || 'permanent');
    const row: QuarryOperation = {
      id,
      code: String(rec.code || `Q-${store.quarries.length + 1}`),
      name: String(rec.name || 'Quarry'),
      kind,
      status: String(rec.status || prev?.status || 'active'),
      trading_name:
        rec.trading_name != null
          ? String(rec.trading_name)
          : prev?.trading_name,
      project_code:
        rec.project_code != null
          ? String(rec.project_code)
          : prev?.project_code,
      project_name:
        rec.project_name != null
          ? String(rec.project_name)
          : prev?.project_name,
      client:
        rec.client != null ? String(rec.client) : prev?.client,
      start_date:
        rec.start_date != null
          ? String(rec.start_date)
          : prev?.start_date ?? null,
      end_date:
        rec.end_date != null
          ? String(rec.end_date)
          : prev?.end_date ?? null,
      district: rec.district != null ? String(rec.district) : prev?.district,
      province: rec.province != null ? String(rec.province) : prev?.province,
      country: rec.country != null ? String(rec.country) : prev?.country,
      address:
        rec.address != null ? String(rec.address) : prev?.address,
      manager: rec.manager != null ? String(rec.manager) : prev?.manager,
      phone: rec.phone != null ? String(rec.phone) : prev?.phone,
      email: rec.email != null ? String(rec.email) : prev?.email,
      mining_right_ref:
        rec.mining_right_ref != null
          ? String(rec.mining_right_ref)
          : prev?.mining_right_ref,
      water_use_licence:
        rec.water_use_licence != null
          ? String(rec.water_use_licence)
          : prev?.water_use_licence,
      emp_ref: rec.emp_ref != null ? String(rec.emp_ref) : prev?.emp_ref,
      lat:
        rec.lat != null && rec.lat !== ''
          ? Number(rec.lat)
          : prev?.lat ?? null,
      lng:
        rec.lng != null && rec.lng !== ''
          ? Number(rec.lng)
          : prev?.lng ?? null,
      target_daily_t:
        rec.target_daily_t != null
          ? Number(rec.target_daily_t)
          : prev?.target_daily_t ?? null,
      notes: rec.notes != null ? String(rec.notes) : prev?.notes,
      active: rec.active !== false,
      created_at: prev?.created_at || now,
      updated_at: now,
    };
    if (existing >= 0) store.quarries[existing] = row;
    else store.quarries.push(row);
  } else if (entity === 'sites') {
    const id = String(rec.id || newId('sit'));
    const existing = store.sites.findIndex((s) => s.id === id);
    const prev = existing >= 0 ? store.sites[existing] : null;
    const quarryId =
      rec.quarry_id != null && String(rec.quarry_id)
        ? String(rec.quarry_id)
        : prev?.quarry_id ?? null;
    const q = quarryId
      ? store.quarries.find((x) => x.id === quarryId)
      : undefined;
    const siteType = String(
      rec.site_type || prev?.site_type || 'pit_face'
    );
    const isTemp =
      rec.is_temporary === true ||
      rec.is_temporary === 'true' ||
      siteType === 'temporary_quarry' ||
      siteType === 'batching_plant' ||
      siteType === 'project_pad' ||
      (rec.is_temporary === undefined && prev?.is_temporary === true);
    const row: QuarrySite = {
      id,
      code: String(rec.code || `S-${store.sites.length + 1}`),
      name: String(rec.name || 'Site'),
      quarry_id: quarryId,
      quarry_name:
        rec.quarry_name != null
          ? String(rec.quarry_name)
          : q?.name || prev?.quarry_name,
      site_type: siteType,
      is_temporary: isTemp,
      material: String(rec.material || prev?.material || 'Mixed / other'),
      face: rec.face != null ? String(rec.face) : prev?.face,
      hectares:
        rec.hectares != null
          ? Number(rec.hectares)
          : prev?.hectares ?? null,
      project_code:
        rec.project_code != null
          ? String(rec.project_code)
          : prev?.project_code || q?.project_code,
      project_name:
        rec.project_name != null
          ? String(rec.project_name)
          : prev?.project_name || q?.project_name,
      start_date:
        rec.start_date != null
          ? String(rec.start_date)
          : prev?.start_date ?? null,
      end_date:
        rec.end_date != null
          ? String(rec.end_date)
          : prev?.end_date ?? null,
      mining_right_ref:
        rec.mining_right_ref != null
          ? String(rec.mining_right_ref)
          : prev?.mining_right_ref || q?.mining_right_ref,
      water_use_licence:
        rec.water_use_licence != null
          ? String(rec.water_use_licence)
          : prev?.water_use_licence || q?.water_use_licence,
      emp_ref:
        rec.emp_ref != null
          ? String(rec.emp_ref)
          : prev?.emp_ref || q?.emp_ref,
      district:
        rec.district != null
          ? String(rec.district)
          : prev?.district || q?.district,
      province:
        rec.province != null
          ? String(rec.province)
          : prev?.province || q?.province,
      address:
        rec.address != null ? String(rec.address) : prev?.address,
      lat:
        rec.lat != null && rec.lat !== ''
          ? Number(rec.lat)
          : prev?.lat ?? null,
      lng:
        rec.lng != null && rec.lng !== ''
          ? Number(rec.lng)
          : prev?.lng ?? null,
      notes: rec.notes != null ? String(rec.notes) : prev?.notes,
      active: rec.active !== false,
      created_at: prev?.created_at || now,
      updated_at: now,
    };
    if (existing >= 0) store.sites[existing] = row;
    else store.sites.push(row);
  } else if (entity === 'allocations') {
    const id = String(rec.id || newId('alc'));
    const existing = store.allocations.findIndex((a) => a.id === id);
    const prev = existing >= 0 ? store.allocations[existing] : null;
    const resourceType = String(
      rec.resource_type || prev?.resource_type || 'vehicle'
    );
    const resourceId = String(
      rec.resource_id || prev?.resource_id || ''
    );
    let label =
      rec.resource_label != null
        ? String(rec.resource_label)
        : prev?.resource_label;
    if (!label && resourceId) {
      if (resourceType === 'vehicle') {
        const v = store.vehicles.find((x) => x.id === resourceId);
        label = v ? `${v.code} · ${v.name}` : undefined;
      } else if (resourceType === 'crew') {
        const c = store.crews.find((x) => x.id === resourceId);
        label = c ? `${c.code} · ${c.name}` : undefined;
      }
    }
    const row: ResourceAllocation = {
      id,
      resource_type: resourceType,
      resource_id: resourceId,
      resource_label: label,
      quarry_id:
        rec.quarry_id != null && String(rec.quarry_id)
          ? String(rec.quarry_id)
          : prev?.quarry_id ?? null,
      site_id:
        rec.site_id != null && String(rec.site_id)
          ? String(rec.site_id)
          : prev?.site_id ?? null,
      project_code:
        rec.project_code != null
          ? String(rec.project_code)
          : prev?.project_code,
      role: rec.role != null ? String(rec.role) : prev?.role,
      start_date: String(
        rec.start_date || prev?.start_date || now.slice(0, 10)
      ),
      end_date:
        rec.end_date != null
          ? String(rec.end_date)
          : prev?.end_date ?? null,
      notes: rec.notes != null ? String(rec.notes) : prev?.notes,
      created_at: prev?.created_at || now,
      updated_at: now,
    };
    if (existing >= 0) store.allocations[existing] = row;
    else store.allocations.push(row);
  } else if (entity === 'products') {
    const id = String(rec.id || newId('prd'));
    const existing = store.products.findIndex((p) => p.id === id);
    const row: AggregateProduct = {
      id,
      code: String(rec.code || `P-${store.products.length + 1}`),
      name: String(rec.name || 'Product'),
      grade: String(rec.grade || 'Other'),
      material: rec.material != null ? String(rec.material) : undefined,
      density_t_m3:
        rec.density_t_m3 != null ? Number(rec.density_t_m3) : null,
      unit: rec.unit === 'm3' ? 'm3' : 't',
      active: rec.active !== false,
      notes: rec.notes != null ? String(rec.notes) : undefined,
      created_at:
        existing >= 0 ? store.products[existing].created_at : now,
    };
    if (existing >= 0) store.products[existing] = row;
    else store.products.push(row);
  } else if (entity === 'reserves') {
    const id = String(rec.id || newId('rsv'));
    const existing = store.reserves.findIndex((r) => r.id === id);
    const prev = existing >= 0 ? store.reserves[existing] : null;
    const row: ReserveEstimate = {
      id,
      site_id: String(rec.site_id || ''),
      product_id:
        rec.product_id != null ? String(rec.product_id) : null,
      season: String(rec.season || new Date().getFullYear()),
      tonnes: Number(rec.tonnes) || 0,
      quality_metric:
        rec.quality_metric != null ? Number(rec.quality_metric) : null,
      quality_label:
        rec.quality_label != null ? String(rec.quality_label) : undefined,
      status: (rec.status as ReserveEstimate['status']) || 'draft',
      revision: (prev?.revision || 0) + (prev ? 1 : 0) || 1,
      notes: rec.notes != null ? String(rec.notes) : undefined,
      updated_at: now,
    };
    if (existing >= 0) store.reserves[existing] = row;
    else store.reserves.push(row);
  } else if (entity === 'production_plan') {
    const id = String(rec.id || newId('ppn'));
    const existing = store.production_plan.findIndex((p) => p.id === id);
    const siteId = String(rec.site_id || '');
    const season = String(rec.season || new Date().getFullYear());
    const res = store.reserves.find(
      (r) =>
        r.site_id === siteId &&
        r.season === season &&
        r.status !== 'draft' &&
        r.status !== 'depleted'
    );
    const row: ProductionPlanItem = {
      id,
      site_id: siteId,
      product_id:
        rec.product_id != null ? String(rec.product_id) : null,
      season,
      sequence:
        Number(rec.sequence) || store.production_plan.length + 1,
      planned_date:
        rec.planned_date != null ? String(rec.planned_date) : null,
      planned_end_date:
        rec.planned_end_date != null
          ? String(rec.planned_end_date)
          : existing >= 0
            ? store.production_plan[existing].planned_end_date
            : null,
      days:
        rec.days != null
          ? Number(rec.days)
          : existing >= 0
            ? store.production_plan[existing].days
            : null,
      estimated_tonnes:
        rec.estimated_tonnes != null
          ? Number(rec.estimated_tonnes)
          : res?.tonnes ?? null,
      daily_allocation_t:
        rec.daily_allocation_t != null
          ? Number(rec.daily_allocation_t)
          : null,
      destination:
        rec.destination != null ? String(rec.destination) : undefined,
      status:
        (rec.status as ProductionPlanItem['status']) || 'planned',
      notes: rec.notes != null ? String(rec.notes) : undefined,
      updated_at: now,
    };
    if (existing >= 0) store.production_plan[existing] = row;
    else store.production_plan.push(row);
  } else if (entity === 'blasts') {
    const id = String(rec.id || newId('blt'));
    const existing = store.blasts.findIndex((b) => b.id === id);
    const row: BlastLog = {
      id,
      site_id: String(rec.site_id || ''),
      date: String(rec.date || now.slice(0, 10)),
      blast_no: rec.blast_no != null ? String(rec.blast_no) : undefined,
      holes: rec.holes != null ? Number(rec.holes) : null,
      explosives_kg:
        rec.explosives_kg != null ? Number(rec.explosives_kg) : null,
      estimated_broken_t:
        rec.estimated_broken_t != null
          ? Number(rec.estimated_broken_t)
          : null,
      measured_t:
        rec.measured_t != null ? Number(rec.measured_t) : null,
      product_id:
        rec.product_id != null ? String(rec.product_id) : null,
      notes: rec.notes != null ? String(rec.notes) : undefined,
      created_at:
        existing >= 0 ? store.blasts[existing].created_at : now,
    };
    if (existing >= 0) store.blasts[existing] = row;
    else store.blasts.push(row);
  } else if (entity === 'plant_runs') {
    const id = String(rec.id || newId('plr'));
    const existing = store.plant_runs.findIndex((p) => p.id === id);
    const row: PlantRun = {
      id,
      site_id: rec.site_id != null ? String(rec.site_id) : null,
      date: String(rec.date || now.slice(0, 10)),
      plant_name: String(rec.plant_name || 'Crusher'),
      hours: rec.hours != null ? Number(rec.hours) : null,
      feed_tonnes:
        rec.feed_tonnes != null ? Number(rec.feed_tonnes) : null,
      product_id:
        rec.product_id != null ? String(rec.product_id) : null,
      output_tonnes:
        rec.output_tonnes != null ? Number(rec.output_tonnes) : null,
      downtime_min:
        rec.downtime_min != null ? Number(rec.downtime_min) : null,
      notes: rec.notes != null ? String(rec.notes) : undefined,
      created_at:
        existing >= 0 ? store.plant_runs[existing].created_at : now,
    };
    if (existing >= 0) store.plant_runs[existing] = row;
    else store.plant_runs.push(row);
  } else if (entity === 'stockpiles') {
    const id = String(rec.id || newId('stk'));
    const existing = store.stockpiles.findIndex((s) => s.id === id);
    const row: Stockpile = {
      id,
      site_id: rec.site_id != null ? String(rec.site_id) : null,
      product_id: String(rec.product_id || ''),
      name: String(rec.name || 'Stockpile'),
      tonnes: Number(rec.tonnes) || 0,
      last_survey_at:
        rec.last_survey_at != null ? String(rec.last_survey_at) : null,
      notes: rec.notes != null ? String(rec.notes) : undefined,
      updated_at: now,
    };
    if (existing >= 0) store.stockpiles[existing] = row;
    else store.stockpiles.push(row);
  } else if (entity === 'dispatches') {
    const id = String(rec.id || newId('dsp'));
    const existing = store.dispatches.findIndex((d) => d.id === id);
    const row: DispatchTicket = {
      id,
      date: String(rec.date || now.slice(0, 10)),
      ticket_no:
        rec.ticket_no != null ? String(rec.ticket_no) : undefined,
      site_id: rec.site_id != null ? String(rec.site_id) : null,
      product_id:
        rec.product_id != null ? String(rec.product_id) : null,
      stockpile_id:
        rec.stockpile_id != null ? String(rec.stockpile_id) : null,
      customer: rec.customer != null ? String(rec.customer) : undefined,
      vehicle_reg:
        rec.vehicle_reg != null ? String(rec.vehicle_reg) : undefined,
      net_tonnes: Number(rec.net_tonnes) || 0,
      destination:
        rec.destination != null ? String(rec.destination) : undefined,
      order_ref:
        rec.order_ref != null ? String(rec.order_ref) : undefined,
      status: (rec.status as DispatchTicket['status']) || 'weighed',
      notes: rec.notes != null ? String(rec.notes) : undefined,
      created_at:
        existing >= 0 ? store.dispatches[existing].created_at : now,
    };
    // Auto-deduct stockpile when dispatching
    if (
      row.stockpile_id &&
      row.net_tonnes > 0 &&
      (existing < 0 || store.dispatches[existing].status === 'void')
    ) {
      const si = store.stockpiles.findIndex(
        (s) => s.id === row.stockpile_id
      );
      if (si >= 0 && row.status !== 'void') {
        store.stockpiles[si] = {
          ...store.stockpiles[si],
          tonnes: Math.max(
            0,
            (Number(store.stockpiles[si].tonnes) || 0) - row.net_tonnes
          ),
          updated_at: now,
        };
      }
    }
    if (existing >= 0) store.dispatches[existing] = row;
    else store.dispatches.push(row);
  } else if (entity === 'vehicles') {
    const id = String(rec.id || newId('veh'));
    const existing = store.vehicles.findIndex((v) => v.id === id);
    const prev = existing >= 0 ? store.vehicles[existing] : null;
    const row: QuarryVehicle = {
      id,
      code: String(rec.code || `V-${store.vehicles.length + 1}`),
      name: String(rec.name || 'Vehicle'),
      type: rec.type != null ? String(rec.type) : undefined,
      reg_no: rec.reg_no != null ? String(rec.reg_no) : undefined,
      make: rec.make != null ? String(rec.make) : undefined,
      model: rec.model != null ? String(rec.model) : undefined,
      year: rec.year != null ? Number(rec.year) : null,
      ownership:
        rec.ownership != null
          ? String(rec.ownership)
          : prev?.ownership || 'owned',
      status:
        rec.status != null
          ? String(rec.status)
          : prev?.status || 'available',
      quarry_id:
        rec.quarry_id != null && String(rec.quarry_id)
          ? String(rec.quarry_id)
          : null,
      home_site_id:
        rec.home_site_id != null && String(rec.home_site_id)
          ? String(rec.home_site_id)
          : null,
      fuel_capacity_l:
        rec.fuel_capacity_l != null ? Number(rec.fuel_capacity_l) : null,
      odometer_km:
        rec.odometer_km != null ? Number(rec.odometer_km) : null,
      engine_hours:
        rec.engine_hours != null ? Number(rec.engine_hours) : null,
      target_hours_day:
        rec.target_hours_day != null
          ? Number(rec.target_hours_day)
          : 8,
      cost_per_hour_zar:
        rec.cost_per_hour_zar != null
          ? Number(rec.cost_per_hour_zar)
          : null,
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
      operator: rec.operator != null ? String(rec.operator) : undefined,
      last_service_at:
        rec.last_service_at != null ? String(rec.last_service_at) : null,
      next_service_hours:
        rec.next_service_hours != null
          ? Number(rec.next_service_hours)
          : null,
      notes: rec.notes != null ? String(rec.notes) : undefined,
      active: rec.active !== false,
      created_at: prev?.created_at || now,
      updated_at: now,
    };
    if (existing >= 0) store.vehicles[existing] = row;
    else store.vehicles.push(row);
  } else if (entity === 'fleet_logs') {
    const id = String(rec.id || newId('flt'));
    const existing = store.fleet_logs.findIndex((f) => f.id === id);
    const vehicleId =
      rec.vehicle_id != null ? String(rec.vehicle_id) : null;
    const veh = vehicleId
      ? store.vehicles.find((v) => v.id === vehicleId)
      : null;
    const siteId = rec.site_id != null ? String(rec.site_id) : null;
    const quarryId =
      rec.quarry_id != null && String(rec.quarry_id)
        ? String(rec.quarry_id)
        : veh?.quarry_id ||
          (siteId
            ? store.sites.find((s) => s.id === siteId)?.quarry_id
            : null) ||
          null;
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
      const h = hours || 0;
      const k = km || 0;
      const f = fuel_l || 0;
      const computed =
        h * (Number(veh?.cost_per_hour_zar) || 0) +
        k * (Number(veh?.cost_per_km_zar) || 0) +
        f * (fuel_price_zar_l || 0);
      if (computed > 0) cost_zar = Math.round(computed * 100) / 100;
    }
    const row: QuarryFleetLog = {
      id,
      site_id: siteId,
      quarry_id: quarryId,
      vehicle_id: vehicleId,
      date: String(rec.date || now.slice(0, 10)),
      vehicle: String(rec.vehicle || veh?.name || veh?.code || 'Vehicle'),
      activity: String(rec.activity || 'Work'),
      hours,
      engine_hours_end:
        rec.engine_hours_end != null
          ? Number(rec.engine_hours_end)
          : null,
      idle_hours:
        rec.idle_hours != null ? Number(rec.idle_hours) : null,
      fuel_l,
      tonnes_moved:
        rec.tonnes_moved != null ? Number(rec.tonnes_moved) : null,
      loads: rec.loads != null ? Number(rec.loads) : null,
      km,
      odometer_km:
        rec.odometer_km != null ? Number(rec.odometer_km) : null,
      fuel_price_zar_l,
      cost_zar,
      operator:
        rec.operator != null
          ? String(rec.operator)
          : veh?.operator,
      notes: rec.notes != null ? String(rec.notes) : undefined,
      created_at:
        existing >= 0 ? store.fleet_logs[existing].created_at : now,
    };
    // Roll meter readings onto vehicle registry
    if (vehicleId && (row.engine_hours_end != null || row.odometer_km != null)) {
      const vi = store.vehicles.findIndex((v) => v.id === vehicleId);
      if (vi >= 0) {
        store.vehicles[vi] = {
          ...store.vehicles[vi],
          engine_hours:
            row.engine_hours_end ?? store.vehicles[vi].engine_hours,
          odometer_km: row.odometer_km ?? store.vehicles[vi].odometer_km,
          updated_at: now,
        };
      }
    }
    if (existing >= 0) store.fleet_logs[existing] = row;
    else store.fleet_logs.push(row);
  } else if (entity === 'crews') {
    const id = String(rec.id || newId('crw'));
    const existing = store.crews.findIndex((c) => c.id === id);
    const prev = existing >= 0 ? store.crews[existing] : null;
    const row: QuarryCrew = {
      id,
      code: String(rec.code || prev?.code || `C-${store.crews.length + 1}`),
      name: String(rec.name || prev?.name || 'Crew'),
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
    if (existing >= 0) store.crews[existing] = row;
    else store.crews.push(row);
  } else if (entity === 'labour_logs') {
    const id = String(rec.id || newId('lab'));
    const existing = store.labour_logs.findIndex((l) => l.id === id);
    const crewId =
      rec.crew_id != null && String(rec.crew_id)
        ? String(rec.crew_id)
        : null;
    const crew = crewId
      ? store.crews.find((c) => c.id === crewId)
      : null;
    const headcount =
      rec.headcount != null ? Number(rec.headcount) : null;
    const hours = rec.hours != null ? Number(rec.hours) : null;
    const quantity =
      rec.quantity != null ? Number(rec.quantity) : null;
    const rate_zar =
      rec.rate_zar != null && rec.rate_zar !== ''
        ? Number(rec.rate_zar)
        : crew?.rate_zar ?? null;
    const rate_unit =
      (rec.rate_unit as LabourRateUnit | null | undefined) ||
      crew?.rate_unit ||
      null;
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
    const row: QuarryLabourLog = {
      id,
      site_id: rec.site_id != null ? String(rec.site_id) : null,
      crew_id: crewId,
      date: String(rec.date || now.slice(0, 10)),
      crew_or_person: String(
        rec.crew_or_person || crew?.name || crew?.code || 'Crew'
      ),
      activity: String(rec.activity || 'Work'),
      employment_type:
        (rec.employment_type as LabourEmploymentType | undefined) ||
        crew?.employment_type ||
        'gang',
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
  } else if (entity === 'quality_tests') {
    const id = String(rec.id || newId('qlt'));
    const existing = store.quality_tests.findIndex((q) => q.id === id);
    const row: QualityTest = {
      id,
      site_id: rec.site_id != null ? String(rec.site_id) : null,
      product_id:
        rec.product_id != null ? String(rec.product_id) : null,
      date: String(rec.date || now.slice(0, 10)),
      sample_ref:
        rec.sample_ref != null ? String(rec.sample_ref) : undefined,
      test_type: String(rec.test_type || 'CS'),
      result: rec.result != null ? Number(rec.result) : null,
      unit: rec.unit != null ? String(rec.unit) : undefined,
      pass_fail:
        (rec.pass_fail as QualityTest['pass_fail']) || 'pending',
      lab: rec.lab != null ? String(rec.lab) : undefined,
      notes: rec.notes != null ? String(rec.notes) : undefined,
      created_at:
        existing >= 0 ? store.quality_tests[existing].created_at : now,
    };
    if (existing >= 0) store.quality_tests[existing] = row;
    else store.quality_tests.push(row);
  } else if (entity === 'permits') {
    const id = String(rec.id || newId('prm'));
    const existing = store.permits.findIndex((p) => p.id === id);
    let status = (rec.status as CompliancePermit['status']) || 'valid';
    if (rec.expires_at) {
      const exp = String(rec.expires_at).slice(0, 10);
      const today = now.slice(0, 10);
      const in90 = new Date();
      in90.setDate(in90.getDate() + 90);
      if (exp < today) status = 'expired';
      else if (exp <= in90.toISOString().slice(0, 10) && status === 'valid')
        status = 'expiring';
    }
    const row: CompliancePermit = {
      id,
      site_id: rec.site_id != null ? String(rec.site_id) : null,
      type: String(rec.type || 'Mining right'),
      ref_no: String(rec.ref_no || ''),
      issued_at:
        rec.issued_at != null ? String(rec.issued_at) : null,
      expires_at:
        rec.expires_at != null ? String(rec.expires_at) : null,
      status,
      notes: rec.notes != null ? String(rec.notes) : undefined,
      created_at:
        existing >= 0 ? store.permits[existing].created_at : now,
    };
    if (existing >= 0) store.permits[existing] = row;
    else store.permits.push(row);
  } else {
    throw new Error('Unknown entity');
  }
}

function seedDemo(now: string): QuarrygraphStore {
  const y = String(new Date().getFullYear());
  const q1 = newId('qry');
  const q2 = newId('qry');
  const q3 = newId('qry');
  const q4 = newId('qry');
  const s1 = newId('sit');
  const s2 = newId('sit');
  const s3 = newId('sit');
  const s4 = newId('sit');
  const s5 = newId('sit');
  const p1 = newId('prd');
  const p2 = newId('prd');
  const p3 = newId('prd');
  const v1 = newId('veh');
  const v2 = newId('veh');
  const v3 = newId('veh');
  const c1 = newId('crw');
  const stk1 = newId('stk');
  const stk2 = newId('stk');

  return {
    quarries: [
      {
        id: q1,
        code: 'HV',
        name: 'Highveld Aggregates',
        kind: 'permanent',
        status: 'active',
        trading_name: 'Highveld Aggregates (Pty) Ltd',
        district: 'Emalahleni',
        province: 'Mpumalanga',
        address: 'R555 corridor, Emalahleni',
        manager: 'Sipho Nkosi',
        mining_right_ref: `MR-${y}-001`,
        water_use_licence: 'WUL-88421',
        emp_ref: 'EMP-HV-12',
        lat: -25.872,
        lng: 29.235,
        target_daily_t: 1200,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: q2,
        code: 'KP',
        name: 'Klipfontein Pit',
        kind: 'permanent',
        status: 'active',
        trading_name: 'Klipfontein Quarries',
        district: 'Middelburg',
        province: 'Mpumalanga',
        address: 'Klipfontein farm, Middelburg',
        manager: 'Anika Botha',
        mining_right_ref: `MR-${y}-014`,
        lat: -25.775,
        lng: 29.465,
        target_daily_t: 600,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: q3,
        code: 'TMP-N4',
        name: 'N4 borrow pit (temp)',
        kind: 'temporary',
        status: 'active',
        project_code: 'N4-REHAB-26',
        project_name: 'N4 rehabilitation package B',
        client: 'SANRAL contractor JV',
        start_date: `${y}-03-01`,
        end_date: `${y}-11-30`,
        district: 'eMalahleni',
        province: 'Mpumalanga',
        address: 'N4 km 42 temporary quarry',
        lat: -25.841,
        lng: 29.312,
        target_daily_t: 400,
        notes: 'Temporary quarry for project duration only',
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: q4,
        code: 'BP-RMX',
        name: 'Ready-mix batching plant · Middelburg',
        kind: 'batching_plant',
        status: 'active',
        project_code: 'RMX-MID-01',
        project_name: 'Municipal road base supply',
        client: 'Local municipality',
        start_date: `${y}-01-15`,
        end_date: `${y}-12-15`,
        district: 'Middelburg',
        province: 'Mpumalanga',
        address: 'Industrial park, Middelburg',
        lat: -25.79,
        lng: 29.48,
        target_daily_t: 320,
        notes: 'Project mobile batching plant — allocate ADTs + loader',
        active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    sites: [
      {
        id: s1,
        code: 'PIT-A',
        name: 'North face',
        quarry_id: q1,
        quarry_name: 'Highveld Aggregates',
        site_type: 'pit_face',
        is_temporary: false,
        material: 'Dolerite',
        face: 'A-North',
        hectares: 18.5,
        mining_right_ref: `MR-${y}-001`,
        water_use_licence: 'WUL-88421',
        emp_ref: 'EMP-HV-12',
        district: 'Emalahleni',
        province: 'Mpumalanga',
        lat: -25.8705,
        lng: 29.238,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: s2,
        code: 'PIT-B',
        name: 'Sand pit',
        quarry_id: q1,
        quarry_name: 'Highveld Aggregates',
        site_type: 'pit_face',
        is_temporary: false,
        material: 'Alluvial sand',
        face: 'B-East',
        hectares: 6.2,
        mining_right_ref: `MR-${y}-001`,
        district: 'Emalahleni',
        province: 'Mpumalanga',
        lat: -25.874,
        lng: 29.241,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: s3,
        code: 'KP-1',
        name: 'Main face',
        quarry_id: q2,
        quarry_name: 'Klipfontein Pit',
        site_type: 'pit_face',
        is_temporary: false,
        material: 'Granite',
        face: 'Main',
        hectares: 12,
        district: 'Middelburg',
        province: 'Mpumalanga',
        lat: -25.776,
        lng: 29.467,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: s4,
        code: 'N4-PAD',
        name: 'N4 crusher pad',
        quarry_id: q3,
        quarry_name: 'N4 borrow pit (temp)',
        site_type: 'temporary_quarry',
        is_temporary: true,
        material: 'Mixed / other',
        project_code: 'N4-REHAB-26',
        project_name: 'N4 rehabilitation package B',
        start_date: `${y}-03-01`,
        end_date: `${y}-11-30`,
        hectares: 2.5,
        district: 'eMalahleni',
        province: 'Mpumalanga',
        lat: -25.842,
        lng: 29.315,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: s5,
        code: 'BP-YARD',
        name: 'Batch plant yard',
        quarry_id: q4,
        quarry_name: 'Ready-mix batching plant · Middelburg',
        site_type: 'batching_plant',
        is_temporary: true,
        material: 'Mixed / other',
        project_code: 'RMX-MID-01',
        start_date: `${y}-01-15`,
        end_date: `${y}-12-15`,
        district: 'Middelburg',
        province: 'Mpumalanga',
        lat: -25.791,
        lng: 29.481,
        active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    products: [
      {
        id: p1,
        code: 'G1',
        name: 'G1 base',
        grade: 'G1',
        material: 'Dolerite',
        density_t_m3: 2.1,
        unit: 't',
        active: true,
        created_at: now,
      },
      {
        id: p2,
        code: '19mm',
        name: '19mm concrete stone',
        grade: '19mm concrete stone',
        material: 'Dolerite',
        density_t_m3: 1.55,
        unit: 't',
        active: true,
        created_at: now,
      },
      {
        id: p3,
        code: 'CSAND',
        name: 'Crusher sand',
        grade: 'Crusher sand',
        material: 'Dolerite',
        unit: 't',
        active: true,
        created_at: now,
      },
    ],
    reserves: [
      {
        id: newId('rsv'),
        site_id: s1,
        product_id: p1,
        season: y,
        tonnes: 420000,
        quality_metric: 28,
        quality_label: 'CS MPa',
        status: 'approved',
        revision: 1,
        updated_at: now,
      },
      {
        id: newId('rsv'),
        site_id: s2,
        product_id: p3,
        season: y,
        tonnes: 85000,
        status: 'surveyed',
        revision: 1,
        updated_at: now,
      },
    ],
    production_plan: [
      {
        id: newId('ppn'),
        site_id: s1,
        product_id: p1,
        season: y,
        sequence: 1,
        planned_date: null,
        estimated_tonnes: 48000,
        destination: 'Road project · N4',
        status: 'planned',
        updated_at: now,
      },
      {
        id: newId('ppn'),
        site_id: s1,
        product_id: p2,
        season: y,
        sequence: 2,
        planned_date: null,
        estimated_tonnes: 22000,
        destination: 'Ready-mix plant',
        status: 'planned',
        updated_at: now,
      },
    ],
    blasts: [
      {
        id: newId('blt'),
        site_id: s1,
        date: now.slice(0, 10),
        blast_no: 'B-104',
        holes: 48,
        explosives_kg: 920,
        estimated_broken_t: 12500,
        measured_t: 11800,
        product_id: p1,
        created_at: now,
      },
    ],
    plant_runs: [
      {
        id: newId('plr'),
        site_id: s1,
        date: now.slice(0, 10),
        plant_name: 'Primary jaw + cone',
        hours: 9.5,
        feed_tonnes: 2100,
        product_id: p1,
        output_tonnes: 980,
        downtime_min: 40,
        created_at: now,
      },
      {
        id: newId('plr'),
        site_id: s1,
        date: now.slice(0, 10),
        plant_name: 'Primary jaw + cone',
        hours: 9.5,
        feed_tonnes: 2100,
        product_id: p2,
        output_tonnes: 620,
        created_at: now,
      },
    ],
    stockpiles: [
      {
        id: stk1,
        site_id: s1,
        product_id: p1,
        name: 'G1 pad North',
        tonnes: 4200,
        last_survey_at: now.slice(0, 10),
        updated_at: now,
      },
      {
        id: stk2,
        site_id: s1,
        product_id: p2,
        name: '19mm pad',
        tonnes: 1850,
        last_survey_at: now.slice(0, 10),
        updated_at: now,
      },
    ],
    dispatches: [
      {
        id: newId('dsp'),
        date: now.slice(0, 10),
        ticket_no: 'WB-88421',
        site_id: s1,
        product_id: p1,
        stockpile_id: stk1,
        customer: 'BuildRight Civils',
        vehicle_reg: 'HL 123-456',
        net_tonnes: 34.2,
        destination: 'N4 km 42',
        status: 'dispatched',
        created_at: now,
      },
    ],
    vehicles: [
      {
        id: v1,
        code: 'EX01',
        name: 'Excavator 01',
        type: 'Excavator',
        reg_no: 'MP 11-AA',
        make: 'CAT',
        model: '349',
        year: 2019,
        ownership: 'owned',
        status: 'working',
        quarry_id: q1,
        home_site_id: s1,
        fuel_capacity_l: 670,
        engine_hours: 8420,
        target_hours_day: 10,
        cost_per_hour_zar: 1850,
        fuel_burn_l_h: 38,
        fuel_price_zar_l: 24.5,
        operator: 'Thabo',
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: v2,
        code: 'AD02',
        name: 'ADT 02',
        type: 'ADT',
        reg_no: 'MP 22-BB',
        make: 'Volvo',
        model: 'A40G',
        year: 2021,
        ownership: 'owned',
        status: 'working',
        quarry_id: q1,
        home_site_id: s1,
        fuel_capacity_l: 480,
        engine_hours: 4120,
        odometer_km: 88200,
        target_hours_day: 10,
        cost_per_hour_zar: 1450,
        cost_per_km_zar: 18.5,
        fuel_burn_l_h: 28,
        fuel_price_zar_l: 24.5,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: v3,
        code: 'LD05',
        name: 'Loader 05',
        type: 'Loader',
        reg_no: 'MP 33-CC',
        make: 'Komatsu',
        model: 'WA480',
        ownership: 'hired',
        status: 'available',
        quarry_id: q2,
        home_site_id: s3,
        engine_hours: 2100,
        target_hours_day: 8,
        cost_per_hour_zar: 980,
        fuel_price_zar_l: 24.5,
        fuel_burn_l_h: 22,
        active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    fleet_logs: [
      {
        id: newId('flt'),
        site_id: s1,
        quarry_id: q1,
        vehicle_id: v1,
        date: now.slice(0, 10),
        vehicle: 'Excavator 01',
        activity: 'Load face',
        hours: 9.5,
        idle_hours: 0.8,
        fuel_l: 95,
        tonnes_moved: 1180,
        loads: 42,
        engine_hours_end: 8429.5,
        cost_zar: 17575,
        fuel_price_zar_l: 24.5,
        operator: 'Thabo',
        created_at: now,
      },
      {
        id: newId('flt'),
        site_id: s1,
        quarry_id: q1,
        vehicle_id: v2,
        date: now.slice(0, 10),
        vehicle: 'ADT 02',
        activity: 'Haul to crusher',
        hours: 8.5,
        idle_hours: 1.2,
        fuel_l: 110,
        km: 45,
        tonnes_moved: 1180,
        loads: 42,
        odometer_km: 88245,
        cost_zar: 12325,
        fuel_price_zar_l: 24.5,
        created_at: now,
      },
      {
        id: newId('flt'),
        site_id: s3,
        quarry_id: q2,
        vehicle_id: v3,
        date: now.slice(0, 10),
        vehicle: 'Loader 05',
        activity: 'Load stockpile',
        hours: 6,
        fuel_l: 55,
        tonnes_moved: 420,
        loads: 28,
        cost_zar: 5880,
        fuel_price_zar_l: 24.5,
        created_at: now,
      },
    ],
    crews: [
      {
        id: c1,
        code: 'DRILL',
        name: 'Drill & blast crew',
        employment_type: 'contractor',
        rate_zar: 450,
        rate_unit: 'per_person_day',
        active: true,
        created_at: now,
      },
    ],
    labour_logs: [
      {
        id: newId('lab'),
        site_id: s1,
        crew_id: c1,
        date: now.slice(0, 10),
        crew_or_person: 'Drill & blast crew',
        activity: 'Blast prep',
        employment_type: 'contractor',
        headcount: 6,
        hours: 8,
        rate_zar: 450,
        rate_unit: 'per_person_day',
        cost_zar: computeLabourCost({
          rate_zar: 450,
          rate_unit: 'per_person_day',
          headcount: 6,
          hours: 8,
        }),
        created_at: now,
      },
    ],
    quality_tests: [
      {
        id: newId('qlt'),
        site_id: s1,
        product_id: p1,
        date: now.slice(0, 10),
        sample_ref: 'LAB-2201',
        test_type: 'CS',
        result: 28.4,
        unit: 'MPa',
        pass_fail: 'pass',
        lab: 'Internal lab',
        created_at: now,
      },
      {
        id: newId('qlt'),
        site_id: s1,
        product_id: p2,
        date: now.slice(0, 10),
        sample_ref: 'LAB-2202',
        test_type: 'Grading',
        result: 96,
        unit: '% in spec',
        pass_fail: 'pass',
        lab: 'Internal lab',
        created_at: now,
      },
    ],
    permits: [
      {
        id: newId('prm'),
        site_id: s1,
        type: 'Mining right',
        ref_no: `MR-${y}-001`,
        issued_at: `${Number(y) - 5}-03-01`,
        expires_at: `${Number(y) + 10}-02-28`,
        status: 'valid',
        created_at: now,
      },
      {
        id: newId('prm'),
        site_id: s1,
        type: 'Water use licence',
        ref_no: 'WUL-88421',
        issued_at: `${Number(y) - 2}-06-15`,
        expires_at: `${y}-12-31`,
        status: 'expiring',
        created_at: now,
      },
      {
        id: newId('prm'),
        site_id: s1,
        type: 'EMP / EA',
        ref_no: 'EMP-HV-12',
        issued_at: `${Number(y) - 4}-01-10`,
        expires_at: `${Number(y) + 6}-01-09`,
        status: 'valid',
        created_at: now,
      },
    ],
    allocations: [
      {
        id: newId('alc'),
        resource_type: 'vehicle',
        resource_id: v2,
        resource_label: 'AD02 · ADT 02',
        quarry_id: q4,
        site_id: s5,
        project_code: 'RMX-MID-01',
        role: 'Haul aggregate to batch plant',
        start_date: `${y}-01-15`,
        end_date: `${y}-12-15`,
        created_at: now,
        updated_at: now,
      },
      {
        id: newId('alc'),
        resource_type: 'vehicle',
        resource_id: v3,
        resource_label: 'LD05 · Loader 05',
        quarry_id: q4,
        site_id: s5,
        project_code: 'RMX-MID-01',
        role: 'Feed hoppers',
        start_date: `${y}-01-15`,
        end_date: `${y}-06-30`,
        created_at: now,
        updated_at: now,
      },
      {
        id: newId('alc'),
        resource_type: 'crew',
        resource_id: c1,
        resource_label: 'DRILL · Drill & blast crew',
        quarry_id: q3,
        site_id: s4,
        project_code: 'N4-REHAB-26',
        role: 'Temp quarry blast prep',
        start_date: `${y}-03-01`,
        end_date: `${y}-11-30`,
        created_at: now,
        updated_at: now,
      },
      {
        id: newId('alc'),
        resource_type: 'plant',
        resource_id: 'mobile_jaw_01',
        resource_label: 'Mobile jaw crusher 01',
        quarry_id: q3,
        site_id: s4,
        project_code: 'N4-REHAB-26',
        role: 'On-site crush',
        start_date: `${y}-03-01`,
        end_date: `${y}-11-30`,
        created_at: now,
        updated_at: now,
      },
    ],
    updated_at: now,
  };
}
