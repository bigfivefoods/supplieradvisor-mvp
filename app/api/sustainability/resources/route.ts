import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { MIGRATION_HINT, RESOURCE_TYPES } from '@/lib/sustainability/types';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const typeFilter = sp.get('type');
    const supabase = getSupabaseServer();
    let q = supabase
      .from('esg_resources')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(400);
    if (typeFilter && ['water', 'waste', 'energy'].includes(typeFilter)) {
      q = q.eq('resource_type', typeFilter);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        resources: [],
        summary: {},
        warning: error.message,
        hint: MIGRATION_HINT,
      });
    }

    const resources = data || [];
    const summary: Record<
      string,
      { total: number; by_category: Record<string, number>; unit?: string }
    > = {};
    for (const t of RESOURCE_TYPES) {
      summary[t.value] = { total: 0, by_category: {} };
    }
    for (const r of resources) {
      const ty = String(r.resource_type || 'water');
      if (!summary[ty]) summary[ty] = { total: 0, by_category: {} };
      const amt = Number(r.amount) || 0;
      summary[ty].total += amt;
      const cat = String(r.category || 'other');
      summary[ty].by_category[cat] = (summary[ty].by_category[cat] || 0) + amt;
      if (r.unit) summary[ty].unit = r.unit;
    }

    // Diversion rate for waste
    const waste = summary.waste?.by_category || {};
    const landfill = waste.landfill || 0;
    const recycled = waste.recycled_waste || 0;
    const composted = waste.composted || 0;
    const wasteTotal = landfill + recycled + composted + (waste.hazardous || 0) + (waste.incinerated || 0);
    const diversion_pct =
      wasteTotal > 0
        ? Math.round(((recycled + composted) / wasteTotal) * 1000) / 10
        : null;

    // Renewable share
    const energy = summary.energy?.by_category || {};
    const elec = energy.electricity || 0;
    const ren = energy.renewable || 0;
    const renewable_pct =
      elec + ren > 0 ? Math.round((ren / (elec + ren)) * 1000) / 10 : null;

    return NextResponse.json({
      success: true,
      resources,
      summary,
      kpis: {
        diversion_pct,
        renewable_pct,
        water_withdrawal: summary.water?.by_category?.withdrawal ?? 0,
        waste_landfill: landfill,
        energy_kwh: (energy.electricity || 0) + (energy.fuel || 0) + (energy.gas || 0) + ren,
      },
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
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    const resource_type = String(body.resource_type || '');
    if (!['water', 'waste', 'energy'].includes(resource_type)) {
      return NextResponse.json(
        { error: 'resource_type must be water|waste|energy' },
        { status: 400 }
      );
    }
    if (!String(body.category || '').trim()) {
      return NextResponse.json({ error: 'category required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('esg_resources')
      .insert({
        profile_id: companyId,
        resource_type,
        category: String(body.category).trim(),
        amount: Number(body.amount) || 0,
        unit: body.unit || 'm3',
        period_start: body.period_start || null,
        period_end: body.period_end || null,
        facility_name: body.facility_name || null,
        notes: body.notes || null,
        is_estimate: body.is_estimate !== false,
        created_by: mem.userId,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: MIGRATION_HINT },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: true, resource: data }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of [
      'resource_type',
      'category',
      'amount',
      'unit',
      'period_start',
      'period_end',
      'facility_name',
      'notes',
      'is_estimate',
      'metadata',
    ]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('esg_resources')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, resource: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('esg_resources')
      .delete()
      .eq('id', id)
      .eq('profile_id', companyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
