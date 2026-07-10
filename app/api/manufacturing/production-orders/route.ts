import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { nextOrderNumber } from '@/lib/manufacturing/types';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const status = request.nextUrl.searchParams.get('status');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    let query = supabase
      .from('manufacturing_production_orders')
      .select('*')
      .eq('profile_id', companyId)
      .order('priority', { ascending: true })
      .order('scheduled_start', { ascending: true });

    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ success: true, orders: [], warning: error.message });
    }

    const orders = data || [];
    const productIds = [...new Set(orders.map((o) => o.product_id).filter(Boolean))];
    const bomIds = [...new Set(orders.map((o) => o.bom_id).filter(Boolean))];
    const wcIds = [...new Set(orders.map((o) => o.work_center_id).filter(Boolean))];

    const [products, boms, wcs] = await Promise.all([
      productIds.length
        ? supabase.from('products').select('id, name, sku').in('id', productIds)
        : Promise.resolve({ data: [] as { id: number; name: string; sku: string | null }[] }),
      bomIds.length
        ? supabase.from('manufacturing_boms').select('id, bom_number, name').in('id', bomIds)
        : Promise.resolve({ data: [] as { id: number; bom_number: string; name: string }[] }),
      wcIds.length
        ? supabase
            .from('manufacturing_work_centers')
            .select('id, code, name')
            .in('id', wcIds)
        : Promise.resolve({ data: [] as { id: number; code: string; name: string }[] }),
    ]);

    const pMap = Object.fromEntries((products.data || []).map((p) => [p.id, p]));
    const bMap = Object.fromEntries((boms.data || []).map((b) => [b.id, b]));
    const wMap = Object.fromEntries((wcs.data || []).map((w) => [w.id, w]));

    const enriched = orders.map((o) => ({
      ...o,
      product_name: o.product_id ? pMap[o.product_id]?.name : null,
      product_sku: o.product_id ? pMap[o.product_id]?.sku : null,
      bom_number: o.bom_id ? bMap[o.bom_id]?.bom_number : null,
      bom_name: o.bom_id ? bMap[o.bom_id]?.name : null,
      work_center_code: o.work_center_id ? wMap[o.work_center_id]?.code : null,
      work_center_name: o.work_center_id ? wMap[o.work_center_id]?.name : null,
    }));

    return NextResponse.json({ success: true, orders: enriched });
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
    if (!body.product_id && !body.productId) {
      return NextResponse.json({ error: 'product_id required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { count } = await supabase
      .from('manufacturing_production_orders')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId);

    const order_number = body.order_number || nextOrderNumber('WO', (count || 0) + 1);
    const productId = Number(body.product_id || body.productId);

    // auto-pick active BOM if not specified
    let bomId = body.bom_id ? Number(body.bom_id) : null;
    if (!bomId) {
      const { data: bom } = await supabase
        .from('manufacturing_boms')
        .select('id')
        .eq('profile_id', companyId)
        .eq('product_id', productId)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      bomId = bom?.id || null;
    }

    const payload = {
      profile_id: companyId,
      order_number,
      product_id: productId,
      bom_id: bomId,
      work_center_id: body.work_center_id ? Number(body.work_center_id) : null,
      qty_planned: Number(body.qty_planned ?? body.qty ?? 1),
      qty_completed: Number(body.qty_completed ?? 0),
      qty_scrapped: Number(body.qty_scrapped ?? 0),
      status: body.status || 'planned',
      priority: Number(body.priority ?? 50),
      scheduled_start: body.scheduled_start || null,
      scheduled_end: body.scheduled_end || null,
      customer_ref: body.customer_ref || null,
      notes: body.notes || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('manufacturing_production_orders')
      .insert(payload)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, order: data });
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
      'status',
      'qty_planned',
      'qty_completed',
      'qty_scrapped',
      'priority',
      'scheduled_start',
      'scheduled_end',
      'actual_start',
      'actual_end',
      'work_center_id',
      'bom_id',
      'product_id',
      'customer_ref',
      'notes',
    ]) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    // status transitions with timestamps
    if (body.status === 'in_progress' && body.auto_timestamps !== false) {
      updates.actual_start = body.actual_start || new Date().toISOString();
    }
    if (body.status === 'complete' && body.auto_timestamps !== false) {
      updates.actual_end = body.actual_end || new Date().toISOString();
      if (body.qty_completed === undefined && body.fill_complete) {
        // leave as-is unless client sets qty
      }
    }

    // complete action: optionally set qty_completed = qty_planned
    if (body.action === 'complete') {
      const { data: cur } = await supabase
        .from('manufacturing_production_orders')
        .select('qty_planned, qty_completed')
        .eq('id', id)
        .eq('profile_id', companyId)
        .maybeSingle();
      updates.status = 'complete';
      updates.actual_end = new Date().toISOString();
      if (cur && Number(cur.qty_completed || 0) <= 0) {
        updates.qty_completed = cur.qty_planned;
      }
    }
    if (body.action === 'release') {
      updates.status = 'released';
    }
    if (body.action === 'start') {
      updates.status = 'in_progress';
      updates.actual_start = new Date().toISOString();
    }
    if (body.action === 'hold') {
      updates.status = 'hold';
    }

    const { data, error } = await supabase
      .from('manufacturing_production_orders')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, order: data });
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
      .from('manufacturing_production_orders')
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
