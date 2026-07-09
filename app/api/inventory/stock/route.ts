import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { hashMovement } from '@/lib/inventory/hash';

/** GET stock levels */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('stock_levels')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: true, levels: [], warning: error.message });
    }

    const productIds = [...new Set((data || []).map((d) => d.product_id).filter(Boolean))];
    const whIds = [...new Set((data || []).map((d) => d.warehouse_id).filter(Boolean))];
    const [{ data: products }, { data: warehouses }] = await Promise.all([
      productIds.length
        ? supabase.from('products').select('id, name, sku, uom, public_id').in('id', productIds)
        : Promise.resolve({ data: [] as { id: number }[] }),
      whIds.length
        ? supabase.from('warehouses').select('id, name, code').in('id', whIds)
        : Promise.resolve({ data: [] as { id: number }[] }),
    ]);

    const pMap = Object.fromEntries((products || []).map((p) => [p.id, p]));
    const wMap = Object.fromEntries((warehouses || []).map((w) => [w.id, w]));

    const levels = (data || []).map((l) => ({
      ...l,
      product: pMap[l.product_id] || null,
      warehouse: l.warehouse_id ? wMap[l.warehouse_id] || null : null,
    }));

    return NextResponse.json({ success: true, levels });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * POST movement — receive | issue | transfer | adjustment | count
 * Body: { companyId, productId, warehouseId, quantity, movement_type, notes?, toWarehouseId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const productId = Number(body.productId);
    const warehouseId = Number(body.warehouseId);
    const qty = Number(body.quantity);
    const type = body.movement_type || body.action || 'adjustment';

    if (!Number.isFinite(companyId) || !Number.isFinite(productId) || !Number.isFinite(qty)) {
      return NextResponse.json(
        { error: 'companyId, productId, and quantity required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const onchainHash = hashMovement({
      profileId: companyId,
      productId,
      movementType: type,
      quantity: qty,
      at: now,
      reference: body.reference_id,
    });

    // Ensure stock level row
    let levelId: number | null = null;
    let currentQty = 0;

    if (Number.isFinite(warehouseId)) {
      const { data: existing } = await supabase
        .from('stock_levels')
        .select('*')
        .eq('profile_id', companyId)
        .eq('product_id', productId)
        .eq('warehouse_id', warehouseId)
        .maybeSingle();

      if (existing) {
        levelId = existing.id;
        currentQty = Number(existing.qty_on_hand || 0);
      }
    } else {
      const { data: existing } = await supabase
        .from('stock_levels')
        .select('*')
        .eq('profile_id', companyId)
        .eq('product_id', productId)
        .is('warehouse_id', null)
        .maybeSingle();
      if (existing) {
        levelId = existing.id;
        currentQty = Number(existing.qty_on_hand || 0);
      }
    }

    let nextQty = currentQty;
    if (type === 'receive' || type === 'return') nextQty = currentQty + Math.abs(qty);
    else if (type === 'issue' || type === 'sale') nextQty = currentQty - Math.abs(qty);
    else if (type === 'count' || type === 'adjustment')
      nextQty = body.absolute ? qty : currentQty + qty;
    else if (type === 'transfer') nextQty = currentQty - Math.abs(qty);
    else nextQty = currentQty + qty;

    if (levelId) {
      await supabase
        .from('stock_levels')
        .update({ qty_on_hand: nextQty, updated_at: now })
        .eq('id', levelId);
    } else {
      const { data: created } = await supabase
        .from('stock_levels')
        .insert({
          profile_id: companyId,
          product_id: productId,
          warehouse_id: Number.isFinite(warehouseId) ? warehouseId : null,
          qty_on_hand: nextQty,
          reorder_level: body.reorder_level != null ? Number(body.reorder_level) : 0,
          updated_at: now,
        })
        .select('id')
        .single();
      levelId = created?.id ?? null;
    }

    // Transfer into destination
    if (type === 'transfer' && body.toWarehouseId) {
      const toId = Number(body.toWarehouseId);
      const { data: dest } = await supabase
        .from('stock_levels')
        .select('*')
        .eq('profile_id', companyId)
        .eq('product_id', productId)
        .eq('warehouse_id', toId)
        .maybeSingle();
      if (dest) {
        await supabase
          .from('stock_levels')
          .update({
            qty_on_hand: Number(dest.qty_on_hand || 0) + Math.abs(qty),
            updated_at: now,
          })
          .eq('id', dest.id);
      } else {
        await supabase.from('stock_levels').insert({
          profile_id: companyId,
          product_id: productId,
          warehouse_id: toId,
          qty_on_hand: Math.abs(qty),
          updated_at: now,
        });
      }
    }

    const { data: movement, error } = await supabase
      .from('stock_movements')
      .insert({
        profile_id: companyId,
        product_id: productId,
        warehouse_id: Number.isFinite(warehouseId) ? warehouseId : null,
        from_warehouse_id: type === 'transfer' ? warehouseId : null,
        to_warehouse_id: type === 'transfer' ? Number(body.toWarehouseId) || null : null,
        movement_type: type,
        quantity: qty,
        unit_cost: body.unit_cost != null ? Number(body.unit_cost) : 0,
        reference_type: body.reference_type || null,
        reference_id: body.reference_id || null,
        notes: body.notes || null,
        created_by: body.created_by || null,
        onchain_hash: onchainHash,
        lot_number: body.lot_number || null,
        created_at: now,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      movement,
      qty_on_hand: nextQty,
      onchain_hash: onchainHash,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
