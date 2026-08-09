import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  emptyFieldgraphStore,
  newId,
  projectHarvestDates,
  readFieldgraphFromMetadata,
  summariseFieldgraph,
  writeFieldgraphToMetadata,
  type AgriApplication,
  type AgriEstimate,
  type AgriField,
  type AgriFleetLog,
  type AgriHarvestPlanItem,
  type AgriLabourLog,
  type AgriRegenSample,
  type FieldgraphStore,
} from '@/lib/agri/fieldgraph';

export const runtime = 'nodejs';

type Entity =
  | 'fields'
  | 'estimates'
  | 'harvest_plan'
  | 'applications'
  | 'fleet_logs'
  | 'labour_logs'
  | 'regen_samples';

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
    return NextResponse.json({
      success: true,
      store,
      summary: summariseFieldgraph(store),
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
      return NextResponse.json({
        success: true,
        store: demo,
        summary: summariseFieldgraph(demo),
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
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFieldgraph(store),
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
      const row: AgriEstimate = {
        id,
        field_id: fieldId,
        season: String(rec.season || new Date().getFullYear()),
        tonnes,
        quality_pct:
          rec.quality_pct != null ? Number(rec.quality_pct) : null,
        tonnes_per_ha: ha > 0 ? Math.round((tonnes / ha) * 100) / 100 : null,
        status: (rec.status as AgriEstimate['status']) || 'draft',
        notes: rec.notes != null ? String(rec.notes) : undefined,
        updated_at: now,
      };
      if (existing >= 0) store.estimates[existing] = row;
      else store.estimates.push(row);
    } else if (entity === 'harvest_plan') {
      const id = String(rec.id || newId('hvt'));
      const existing = store.harvest_plan.findIndex((h) => h.id === id);
      const row: AgriHarvestPlanItem = {
        id,
        field_id: String(rec.field_id || ''),
        season: String(rec.season || new Date().getFullYear()),
        sequence: Number(rec.sequence) || store.harvest_plan.length + 1,
        planned_date:
          rec.planned_date != null ? String(rec.planned_date) : null,
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
      const row: AgriFleetLog = {
        id,
        field_id: rec.field_id != null ? String(rec.field_id) : null,
        date: String(rec.date || now.slice(0, 10)),
        vehicle: String(rec.vehicle || 'Vehicle'),
        activity: String(rec.activity || 'Work'),
        hours: rec.hours != null ? Number(rec.hours) : null,
        fuel_l: rec.fuel_l != null ? Number(rec.fuel_l) : null,
        notes: rec.notes != null ? String(rec.notes) : undefined,
        created_at:
          existing >= 0 ? store.fleet_logs[existing].created_at : now,
      };
      if (existing >= 0) store.fleet_logs[existing] = row;
      else store.fleet_logs.push(row);
    } else if (entity === 'labour_logs') {
      const id = String(rec.id || newId('lab'));
      const existing = store.labour_logs.findIndex((l) => l.id === id);
      const row: AgriLabourLog = {
        id,
        field_id: rec.field_id != null ? String(rec.field_id) : null,
        date: String(rec.date || now.slice(0, 10)),
        gang_or_person: String(rec.gang_or_person || 'Gang'),
        activity: String(rec.activity || 'Work'),
        headcount: rec.headcount != null ? Number(rec.headcount) : null,
        hours: rec.hours != null ? Number(rec.hours) : null,
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

    await saveStore(companyId, meta, store);
    return NextResponse.json({
      success: true,
      store,
      summary: summariseFieldgraph(store),
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
        active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    estimates: [
      {
        id: newId('est'),
        field_id: f1,
        season: String(y),
        tonnes: 2840,
        quality_pct: 12.4,
        tonnes_per_ha: 100,
        status: 'submitted',
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
        updated_at: now,
      },
    ],
    harvest_plan: [
      {
        id: newId('hvt'),
        field_id: f1,
        season: String(y),
        sequence: 1,
        planned_date: null,
        destination: 'Mill / buyer',
        status: 'planned',
        updated_at: now,
      },
      {
        id: newId('hvt'),
        field_id: f2,
        season: String(y),
        sequence: 2,
        planned_date: null,
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
    fleet_logs: [
      {
        id: newId('flt'),
        field_id: f1,
        date: now.slice(0, 10),
        vehicle: 'Tractor 02',
        activity: 'Rip / ridge',
        hours: 6.5,
        fuel_l: 48,
        created_at: now,
      },
    ],
    labour_logs: [
      {
        id: newId('lab'),
        field_id: f1,
        date: now.slice(0, 10),
        gang_or_person: 'Gang A',
        activity: 'Weed control',
        headcount: 12,
        hours: 8,
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
