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
      .from('warehouses')
      .select('*')
      .eq('profile_id', companyId)
      .order('name');

    if (error) {
      return NextResponse.json({
        success: true,
        warehouses: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260709_inventory_world_class.sql',
      });
    }

    // Stock line counts per warehouse
    const { data: levels } = await supabase
      .from('stock_levels')
      .select('warehouse_id, qty_on_hand')
      .eq('profile_id', companyId);

    const stats: Record<number, { lines: number; units: number }> = {};
    for (const l of levels || []) {
      const wid = Number(l.warehouse_id) || 0;
      if (!stats[wid]) stats[wid] = { lines: 0, units: 0 };
      stats[wid].lines += 1;
      stats[wid].units += Number(l.qty_on_hand || 0);
    }

    // Link containers as virtual outlets
    const { data: containers } = await supabase
      .from('containers')
      .select('id, name, container_code, city, status, address')
      .eq('profile_id', companyId)
      .order('name');

    const warehouses = (data || []).map((w) => ({
      ...w,
      stock_lines: stats[w.id]?.lines || 0,
      units_on_hand: stats[w.id]?.units || 0,
    }));

    return NextResponse.json({
      success: true,
      warehouses,
      containers: containers || [],
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || !body.name) {
      return NextResponse.json({ error: 'companyId and name required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const payload = {
      profile_id: companyId,
      name: String(body.name).trim(),
      code: body.code || null,
      warehouse_type: body.warehouse_type || 'warehouse',
      status: body.status || 'active',
      address: body.address || null,
      city: body.city || null,
      country: body.country || null,
      container_id: body.container_id || null,
      is_default: !!body.is_default,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('warehouses').insert(payload).select('*').single();
    if (error) {
      return NextResponse.json(
        { error: error.message, hint: 'Run inventory world class migration' },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, warehouse: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const fields = [
      'name',
      'code',
      'warehouse_type',
      'status',
      'address',
      'city',
      'country',
      'container_id',
      'is_default',
    ] as const;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('warehouses')
      .update(updates)
      .eq('id', Number(body.id))
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, warehouse: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('warehouses').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
