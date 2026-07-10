import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('manufacturing_work_centers')
      .select('*')
      .eq('profile_id', companyId)
      .order('code');

    if (error) {
      return NextResponse.json({ success: true, workCenters: [], warning: error.message });
    }

    // WIP count per cell
    const { data: orders } = await supabase
      .from('manufacturing_production_orders')
      .select('work_center_id, status')
      .eq('profile_id', companyId)
      .in('status', ['released', 'in_progress', 'hold']);

    const wip: Record<number, number> = {};
    for (const o of orders || []) {
      if (!o.work_center_id) continue;
      wip[o.work_center_id] = (wip[o.work_center_id] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      workCenters: (data || []).map((w) => ({ ...w, wip_orders: wip[w.id] || 0 })),
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
    if (!Number.isFinite(companyId) || !body.code || !body.name) {
      return NextResponse.json({ error: 'companyId, code, name required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const payload = {
      profile_id: companyId,
      code: String(body.code).trim().toUpperCase(),
      name: String(body.name).trim(),
      description: body.description || null,
      capacity_hours_per_day: Number(body.capacity_hours_per_day ?? 8),
      efficiency_pct: Number(body.efficiency_pct ?? 100),
      cost_per_hour: Number(body.cost_per_hour ?? 0),
      status: body.status || 'active',
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('manufacturing_work_centers')
      .insert(payload)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, workCenter: data });
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
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of [
      'code',
      'name',
      'description',
      'capacity_hours_per_day',
      'efficiency_pct',
      'cost_per_hour',
      'status',
    ]) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    const { data, error } = await supabase
      .from('manufacturing_work_centers')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, workCenter: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('manufacturing_work_centers')
      .delete()
      .eq('id', id)
      .eq('profile_id', companyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
