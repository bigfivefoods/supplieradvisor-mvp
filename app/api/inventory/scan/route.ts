import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { parseBarcode } from '@/lib/inventory/gs1';
import { hashMovement } from '@/lib/inventory/hash';

/**
 * POST — resolve a QR/barcode scan and optionally receive stock
 * Body: {
 *   companyId, raw, action?: 'lookup' | 'receive',
 *   quantity?, warehouseId?, containerId?, notes?
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const raw = String(body.raw || '').trim();
    if (!Number.isFinite(companyId) || !raw) {
      return NextResponse.json({ error: 'companyId and raw scan required' }, { status: 400 });
    }

    const parsed = parseBarcode(raw);
    const supabase = getSupabaseServer();

    // Resolve product
    let product: Record<string, unknown> | null = null;

    if (parsed.applicationIdentifiers.public_id) {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('profile_id', companyId)
        .eq('public_id', parsed.applicationIdentifiers.public_id)
        .maybeSingle();
      product = data;
    }

    if (!product && parsed.gtin14) {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('profile_id', companyId)
        .or(`gtin14.eq.${parsed.gtin14},gtin.eq.${parsed.gtin},barcode.eq.${parsed.gtin}`)
        .maybeSingle();
      product = data;
    }

    if (!product && parsed.gtin) {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('profile_id', companyId)
        .or(`barcode.eq.${parsed.gtin},sku.eq.${parsed.gtin},gtin.eq.${parsed.gtin}`)
        .maybeSingle();
      product = data;
    }

    // SKU fallback if raw looks like SKU
    if (!product && parsed.symbology === 'unknown') {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('profile_id', companyId)
        .or(`sku.eq.${raw},barcode.eq.${raw}`)
        .maybeSingle();
      product = data;
    }

    if (!product) {
      return NextResponse.json({
        success: false,
        parsed,
        error: 'No product matched this scan',
        hint: 'Link GTIN/barcode on the product or use product QR (/p/{publicId})',
      }, { status: 404 });
    }

    const action = body.action || 'lookup';
    if (action === 'lookup') {
      return NextResponse.json({ success: true, parsed, product, action: 'lookup' });
    }

    // Receive stock + pedigree
    const qty = Number(body.quantity ?? parsed.quantity ?? 1);
    const lotNumber = body.lot_number || parsed.lot || null;
    const serialNumber = body.serial_number || parsed.serial || null;
    const expiryDate = body.expiry_date || parsed.expiry || null;
    const warehouseId = body.warehouseId != null ? Number(body.warehouseId) : null;
    const containerId = body.containerId != null ? Number(body.containerId) : null;
    const now = new Date().toISOString();

    const productId = Number(product.id);
    let nextQty = qty;

    if (containerId) {
      // Receive into container inventory
      const productName = String(product.name);
      const { data: existing } = await supabase
        .from('container_inventory')
        .select('*')
        .eq('container_id', containerId)
        .eq('product_name', productName)
        .maybeSingle();

      if (existing) {
        nextQty = Number(existing.qty_on_hand || 0) + qty;
        await supabase
          .from('container_inventory')
          .update({
            qty_on_hand: nextQty,
            last_received_at: now,
            updated_at: now,
            sku: product.sku || existing.sku,
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('container_inventory').insert({
          profile_id: companyId,
          container_id: containerId,
          product_name: productName,
          sku: product.sku || null,
          qty_on_hand: qty,
          unit: product.uom || 'unit',
          reorder_level: product.reorder_level || 0,
          last_received_at: now,
        });
        nextQty = qty;
      }
    } else {
      // Warehouse stock_levels
      let q = supabase
        .from('stock_levels')
        .select('*')
        .eq('profile_id', companyId)
        .eq('product_id', productId);
      if (warehouseId) q = q.eq('warehouse_id', warehouseId);
      else q = q.is('warehouse_id', null);
      const { data: level } = await q.maybeSingle();

      if (level) {
        nextQty = Number(level.qty_on_hand || 0) + qty;
        await supabase
          .from('stock_levels')
          .update({
            qty_on_hand: nextQty,
            lot_number: lotNumber || level.lot_number,
            expiry_date: expiryDate || level.expiry_date,
            updated_at: now,
          })
          .eq('id', level.id);
      } else {
        await supabase.from('stock_levels').insert({
          profile_id: companyId,
          product_id: productId,
          warehouse_id: warehouseId,
          qty_on_hand: qty,
          reorder_level: product.reorder_level || 0,
          lot_number: lotNumber,
          expiry_date: expiryDate,
          updated_at: now,
        });
        nextQty = qty;
      }
    }

    // Lot pedigree
    if (lotNumber) {
      const { data: lot } = await supabase
        .from('inventory_lots')
        .select('*')
        .eq('profile_id', companyId)
        .eq('product_id', productId)
        .eq('lot_number', lotNumber)
        .maybeSingle();
      if (lot) {
        await supabase
          .from('inventory_lots')
          .update({
            qty_on_hand: Number(lot.qty_on_hand || 0) + qty,
            expiry_date: expiryDate || lot.expiry_date,
            warehouse_id: warehouseId || lot.warehouse_id,
            container_id: containerId || lot.container_id,
            gtin14: parsed.gtin14 || lot.gtin14,
            updated_at: now,
          })
          .eq('id', lot.id);
      } else {
        await supabase.from('inventory_lots').insert({
          profile_id: companyId,
          product_id: productId,
          lot_number: lotNumber,
          expiry_date: expiryDate,
          qty_on_hand: qty,
          warehouse_id: warehouseId,
          container_id: containerId,
          gtin14: parsed.gtin14 || product.gtin14 || null,
          status: 'active',
        });
      }
    }

    // Serial
    if (serialNumber) {
      await supabase.from('inventory_serials').upsert(
        {
          profile_id: companyId,
          product_id: productId,
          serial_number: serialNumber,
          lot_number: lotNumber,
          status: 'in_stock',
          warehouse_id: warehouseId,
          container_id: containerId,
          updated_at: now,
        },
        { onConflict: 'id' }
      );
      // plain insert if upsert constraint missing
      const { data: ser } = await supabase
        .from('inventory_serials')
        .select('id')
        .eq('profile_id', companyId)
        .eq('serial_number', serialNumber)
        .maybeSingle();
      if (!ser) {
        await supabase.from('inventory_serials').insert({
          profile_id: companyId,
          product_id: productId,
          serial_number: serialNumber,
          lot_number: lotNumber,
          status: 'in_stock',
          warehouse_id: warehouseId,
          container_id: containerId,
        });
      }
    }

    const onchainHash = hashMovement({
      profileId: companyId,
      productId,
      movementType: 'receive_scan',
      quantity: qty,
      at: now,
      reference: raw.slice(0, 64),
    });

    const { data: movement } = await supabase
      .from('stock_movements')
      .insert({
        profile_id: companyId,
        product_id: productId,
        warehouse_id: warehouseId,
        container_id: containerId,
        movement_type: 'receive',
        quantity: qty,
        notes: body.notes || 'QR/barcode scan receive',
        lot_number: lotNumber,
        serial_number: serialNumber,
        expiry_date: expiryDate,
        gtin14: parsed.gtin14 || null,
        scan_raw: raw,
        onchain_hash: onchainHash,
        created_at: now,
      })
      .select('*')
      .single();

    return NextResponse.json({
      success: true,
      action: 'receive',
      parsed,
      product,
      qty_on_hand: nextQty,
      received: qty,
      lot_number: lotNumber,
      serial_number: serialNumber,
      expiry_date: expiryDate,
      movement,
      onchain_hash: onchainHash,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Scan failed' },
      { status: 500 }
    );
  }
}
