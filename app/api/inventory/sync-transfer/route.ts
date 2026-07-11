import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { hashMovement } from '@/lib/inventory/hash';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * POST — auto-sync transfer between warehouse stock and container inventory
 * Body: {
 *   companyId,
 *   direction: 'warehouse_to_container' | 'container_to_warehouse',
 *   productId?, product_name?, sku?,
 *   quantity,
 *   warehouseId?,
 *   containerId,
 *   lot_number?, notes?
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const containerId = Number(body.containerId);
    const qty = Math.abs(Number(body.quantity || 0));
    const direction = body.direction || 'warehouse_to_container';

    if (!Number.isFinite(companyId) || !Number.isFinite(containerId) || qty <= 0) {
      return NextResponse.json(
        { error: 'companyId, containerId, and positive quantity required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const warehouseId = body.warehouseId != null ? Number(body.warehouseId) : null;

    // Resolve product
    let productId = body.productId != null ? Number(body.productId) : null;
    let productName = body.product_name ? String(body.product_name) : null;
    let sku = body.sku || null;
    let uom = 'unit';

    if (productId) {
      const { data: p } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();
      if (p) {
        productName = p.name;
        sku = p.sku;
        uom = p.uom || 'unit';
      }
    } else if (productName) {
      const { data: p } = await supabase
        .from('products')
        .select('*')
        .eq('profile_id', companyId)
        .ilike('name', productName)
        .maybeSingle();
      if (p) {
        productId = p.id;
        sku = p.sku;
        uom = p.uom || 'unit';
      }
    }

    if (!productName) {
      return NextResponse.json({ error: 'productId or product_name required' }, { status: 400 });
    }

    const onchainHash = hashMovement({
      profileId: companyId,
      productId: productId || productName,
      movementType: direction,
      quantity: qty,
      at: now,
      reference: `c:${containerId}`,
    });

    if (direction === 'warehouse_to_container') {
      // Decrement warehouse
      if (productId) {
        let q = supabase
          .from('stock_levels')
          .select('*')
          .eq('profile_id', companyId)
          .eq('product_id', productId);
        if (warehouseId) q = q.eq('warehouse_id', warehouseId);
        const { data: level } = await q.maybeSingle();
        if (level) {
          const next = Number(level.qty_on_hand || 0) - qty;
          if (next < -0.0001) {
            return NextResponse.json(
              { error: `Insufficient warehouse stock (have ${level.qty_on_hand})` },
              { status: 409 }
            );
          }
          await supabase
            .from('stock_levels')
            .update({ qty_on_hand: next, updated_at: now })
            .eq('id', level.id);
        } else if (!body.allowNegativeWarehouse) {
          return NextResponse.json(
            {
              error: 'No warehouse stock line for this product — receive into warehouse first, or set allowNegativeWarehouse',
            },
            { status: 409 }
          );
        }
      }

      // Increment container
      const { data: cInv } = await supabase
        .from('container_inventory')
        .select('*')
        .eq('container_id', containerId)
        .eq('product_name', productName)
        .maybeSingle();

      let containerInventoryId: number | null = null;
      if (cInv) {
        await supabase
          .from('container_inventory')
          .update({
            qty_on_hand: Number(cInv.qty_on_hand || 0) + qty,
            last_received_at: now,
            updated_at: now,
            sku: sku || cInv.sku,
          })
          .eq('id', cInv.id);
        containerInventoryId = cInv.id;
      } else {
        const { data: created } = await supabase
          .from('container_inventory')
          .insert({
            profile_id: companyId,
            container_id: containerId,
            product_name: productName,
            sku,
            qty_on_hand: qty,
            unit: uom,
            last_received_at: now,
          })
          .select('id')
          .single();
        containerInventoryId = created?.id ?? null;
      }

      const { data: movement } = await supabase
        .from('stock_movements')
        .insert({
          profile_id: companyId,
          product_id: productId,
          warehouse_id: warehouseId,
          container_id: containerId,
          movement_type: 'transfer',
          quantity: qty,
          notes: body.notes || 'Warehouse → container sync',
          lot_number: body.lot_number || null,
          onchain_hash: onchainHash,
          created_at: now,
        })
        .select('*')
        .single();

      const { data: transfer } = await supabase
        .from('inventory_transfers')
        .insert({
          profile_id: companyId,
          product_id: productId,
          product_name: productName,
          sku,
          quantity: qty,
          from_type: 'warehouse',
          from_id: warehouseId,
          to_type: 'container',
          to_id: containerId,
          lot_number: body.lot_number || null,
          status: 'completed',
          onchain_hash: onchainHash,
          notes: body.notes || null,
          created_by: body.created_by || null,
        })
        .select('*')
        .single();

      return NextResponse.json({
        success: true,
        direction,
        transfer,
        movement,
        container_inventory_id: containerInventoryId,
        onchain_hash: onchainHash,
      });
    }

    // container_to_warehouse
    const { data: cInv } = await supabase
      .from('container_inventory')
      .select('*')
      .eq('container_id', containerId)
      .eq('product_name', productName)
      .maybeSingle();

    if (!cInv || Number(cInv.qty_on_hand || 0) < qty) {
      return NextResponse.json(
        {
          error: `Insufficient container stock (have ${cInv?.qty_on_hand ?? 0})`,
        },
        { status: 409 }
      );
    }

    await supabase
      .from('container_inventory')
      .update({
        qty_on_hand: Number(cInv.qty_on_hand) - qty,
        updated_at: now,
      })
      .eq('id', cInv.id);

    if (productId) {
      let q = supabase
        .from('stock_levels')
        .select('*')
        .eq('profile_id', companyId)
        .eq('product_id', productId);
      if (warehouseId) q = q.eq('warehouse_id', warehouseId);
      const { data: level } = await q.maybeSingle();
      if (level) {
        await supabase
          .from('stock_levels')
          .update({
            qty_on_hand: Number(level.qty_on_hand || 0) + qty,
            updated_at: now,
          })
          .eq('id', level.id);
      } else {
        await supabase.from('stock_levels').insert({
          profile_id: companyId,
          product_id: productId,
          warehouse_id: warehouseId,
          qty_on_hand: qty,
          updated_at: now,
        });
      }
    }

    const { data: movement } = await supabase
      .from('stock_movements')
      .insert({
        profile_id: companyId,
        product_id: productId,
        warehouse_id: warehouseId,
        container_id: containerId,
        movement_type: 'transfer',
        quantity: qty,
        notes: body.notes || 'Container → warehouse sync',
        lot_number: body.lot_number || null,
        onchain_hash: onchainHash,
        created_at: now,
      })
      .select('*')
      .single();

    const { data: transfer } = await supabase
      .from('inventory_transfers')
      .insert({
        profile_id: companyId,
        product_id: productId,
        product_name: productName,
        sku,
        quantity: qty,
        from_type: 'container',
        from_id: containerId,
        to_type: 'warehouse',
        to_id: warehouseId,
        lot_number: body.lot_number || null,
        status: 'completed',
        onchain_hash: onchainHash,
        notes: body.notes || null,
      })
      .select('*')
      .single();

    return NextResponse.json({
      success: true,
      direction,
      transfer,
      movement,
      onchain_hash: onchainHash,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Transfer failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('inventory_transfers')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      return NextResponse.json({ success: true, transfers: [], warning: error.message });
    }
    return NextResponse.json({ success: true, transfers: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
