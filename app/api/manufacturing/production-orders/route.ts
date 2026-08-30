import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { nextOrderNumber } from '@/lib/manufacturing/types';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';
import { captureProductionOrderLabor } from '@/lib/manufacturing/capture-order-labor';

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

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
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
      work_station_id: body.work_station_id
        ? Number(body.work_station_id)
        : null,
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
      'work_station_id',
      'bom_id',
      'product_id',
      'customer_ref',
      'notes',
      'labor_hours',
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

    // log_hours: set hours without forcing complete
    if (body.action === 'log_hours') {
      if (body.labor_hours !== undefined) {
        updates.labor_hours = Number(body.labor_hours);
      }
      if (body.work_center_id !== undefined) {
        updates.work_center_id = body.work_center_id
          ? Number(body.work_center_id)
          : null;
      }
      if (body.work_station_id !== undefined) {
        updates.work_station_id = body.work_station_id
          ? Number(body.work_station_id)
          : null;
      }
    }

    const { data, error } = await supabase
      .from('manufacturing_production_orders')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Labor → cost centre (hours × cell/station rate)
    let labor: Awaited<ReturnType<typeof captureProductionOrderLabor>> | null =
      null;
    const shouldCapture =
      body.action === 'log_hours' ||
      body.action === 'capture_cost' ||
      body.action === 'complete' ||
      body.captureLabor === true ||
      (body.status === 'complete' && body.captureLabor !== false);

    if (shouldCapture) {
      labor = await captureProductionOrderLabor({
        companyId,
        orderId: id,
        laborHours:
          body.labor_hours != null
            ? Number(body.labor_hours)
            : body.action === 'log_hours' && updates.labor_hours != null
              ? Number(updates.labor_hours)
              : null,
        useElapsed: body.useElapsed !== false,
        replace: body.action !== 'log_hours' || body.replaceLabor !== false,
        note: body.labor_note || null,
      });
    }

    // Re-load order so response includes labor fields when present
    let orderOut = data;
    if (labor?.ok && !labor.skipped) {
      const { data: refreshed } = await supabase
        .from('manufacturing_production_orders')
        .select('*')
        .eq('id', id)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (refreshed) orderOut = refreshed;
    }

    let stock = null;
    if (
      (body.action === 'complete' || String(orderOut?.status) === 'complete') &&
      body.skipStock !== true
    ) {
      stock = await postProductionStock({
        companyId,
        order: orderOut as Record<string, unknown>,
        warehouseId:
          body.warehouseId != null ? Number(body.warehouseId) : null,
        lotNumber:
          body.lot_number != null ? String(body.lot_number) : undefined,
        expiryDate:
          body.expiry_date != null ? String(body.expiry_date).slice(0, 10) : undefined,
      });
    }

    return NextResponse.json({
      success: true,
      order: orderOut,
      labor,
      stock,
    });
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

async function postProductionStock(opts: {
  companyId: number;
  order: Record<string, unknown>;
  warehouseId?: number | null;
  lotNumber?: string;
  expiryDate?: string;
}) {
  const productId = Number(opts.order.product_id);
  const bomId = Number(opts.order.bom_id);
  const qty = Number(opts.order.qty_completed || opts.order.qty_planned || 0);
  if (!Number.isFinite(productId) || productId <= 0 || !(qty > 0)) {
    return { ok: false, error: 'no product qty' };
  }
  const supabase = getSupabaseServer();
  let warehouseId = Number(opts.warehouseId);
  if (!Number.isFinite(warehouseId) || warehouseId <= 0) {
    const { data: wh } = await supabase
      .from('warehouses')
      .select('id')
      .eq('profile_id', opts.companyId)
      .eq('is_default', true)
      .maybeSingle();
    warehouseId = wh?.id ? Number(wh.id) : 0;
    if (!warehouseId) {
      const { data: anyWh } = await supabase
        .from('warehouses')
        .select('id')
        .eq('profile_id', opts.companyId)
        .limit(1)
        .maybeSingle();
      warehouseId = anyWh?.id ? Number(anyWh.id) : 0;
    }
  }
  if (!warehouseId) return { ok: false, error: 'no warehouse' };
  const { postStock } = await import('@/lib/inventory/post-stock');
  const warnings: string[] = [];
  if (Number.isFinite(bomId) && bomId > 0) {
    const { data: bomLines } = await supabase
      .from('manufacturing_bom_lines')
      .select('component_product_id, qty_per')
      .eq('bom_id', bomId);
    for (const line of bomLines || []) {
      const comp = Number(line.component_product_id);
      const per = Number(line.qty_per || 0);
      if (!(comp > 0) || !(per > 0)) continue;
      const consumed = await postStock({
        profileId: opts.companyId,
        productId: comp,
        warehouseId,
        movementType: 'consume',
        quantity: per * qty,
        referenceType: 'production_order',
        referenceId: Number(opts.order.id),
        notes: `Produce consume BOM ${bomId}`,
      });
      if (!consumed.ok) warnings.push(consumed.error);
    }
  }
  const lot =
    opts.lotNumber ||
    `FG${productId}-${String(opts.order.id || '')}-${new Date()
      .toISOString()
      .slice(0, 10)}`;
  const produced = await postStock({
    profileId: opts.companyId,
    productId,
    warehouseId,
    movementType: 'produce',
    quantity: qty,
    lotNumber: lot,
    expiryDate: opts.expiryDate,
    referenceType: 'production_order',
    referenceId: Number(opts.order.id),
    notes: `Produce FG ${productId}`,
  });
  if (!produced.ok) warnings.push(produced.error);
  return { ok: produced.ok, warehouseId, lot, warnings };
}
