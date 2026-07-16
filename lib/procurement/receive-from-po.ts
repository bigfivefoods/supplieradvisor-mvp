/**
 * Receive PO lines into buyer warehouse stock (soft match by source/sku/name).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import type { PoLineItem } from '@/lib/procurement/types';

export type ReceiveFromPoResult = {
  ok: boolean;
  receivedLines: number;
  skippedLines: number;
  qtyTotal: number;
  warnings: string[];
  error?: string;
};

function asLines(items: unknown): PoLineItem[] {
  if (!Array.isArray(items)) return [];
  return items as PoLineItem[];
}

export async function receivePurchaseOrderToInventory(opts: {
  companyId: number;
  poId: number;
  warehouseId?: number | null;
  lotPrefix?: string | null;
}): Promise<ReceiveFromPoResult> {
  const supabase = getSupabaseServer();
  const warnings: string[] = [];
  let receivedLines = 0;
  let skippedLines = 0;
  let qtyTotal = 0;

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .select('id, buyer_profile_id, supplier_profile_id, items, status, metadata')
    .eq('id', opts.poId)
    .eq('buyer_profile_id', opts.companyId)
    .maybeSingle();

  if (error) return { ok: false, receivedLines: 0, skippedLines: 0, qtyTotal: 0, warnings, error: error.message };
  if (!po) {
    return {
      ok: false,
      receivedLines: 0,
      skippedLines: 0,
      qtyTotal: 0,
      warnings,
      error: 'PO not found',
    };
  }

  const meta =
    po.metadata && typeof po.metadata === 'object' && !Array.isArray(po.metadata)
      ? { ...(po.metadata as Record<string, unknown>) }
      : {};
  if (meta.inventory_received_at) {
    return {
      ok: false,
      receivedLines: 0,
      skippedLines: 0,
      qtyTotal: 0,
      warnings: ['Stock already received from this PO'],
      error: 'ALREADY_RECEIVED',
    };
  }

  const lines = asLines(po.items);
  if (!lines.length) {
    return {
      ok: false,
      receivedLines: 0,
      skippedLines: 0,
      qtyTotal: 0,
      warnings,
      error: 'PO has no line items',
    };
  }

  const warehouseId =
    opts.warehouseId != null && Number.isFinite(Number(opts.warehouseId))
      ? Number(opts.warehouseId)
      : null;

  // Default warehouse if none
  let wh = warehouseId;
  if (!wh) {
    const { data: firstWh } = await supabase
      .from('warehouses')
      .select('id')
      .eq('profile_id', opts.companyId)
      .limit(1)
      .maybeSingle();
    wh = firstWh?.id ? Number(firstWh.id) : null;
  }

  const now = new Date().toISOString();
  const lotPrefix = (opts.lotPrefix || `PO${opts.poId}`).slice(0, 20);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const qty = Number(line.quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      skippedLines += 1;
      continue;
    }

    const sellerProductId =
      line.product_id != null ? Number(line.product_id) : null;
    const name = String(line.item_name || '').trim();
    const sku = (line as { sku?: string }).sku
      ? String((line as { sku?: string }).sku)
      : null;

    let productId: number | null = null;

    // 1) Imported product linked to seller source
    if (sellerProductId && Number.isFinite(sellerProductId)) {
      const { data: bySource } = await supabase
        .from('products')
        .select('id')
        .eq('profile_id', opts.companyId)
        .eq('source_product_id', sellerProductId)
        .limit(1)
        .maybeSingle();
      if (bySource?.id) productId = Number(bySource.id);
    }

    // 2) Same product id if buyer owns it (self-supply edge case)
    if (!productId && sellerProductId) {
      const { data: own } = await supabase
        .from('products')
        .select('id')
        .eq('profile_id', opts.companyId)
        .eq('id', sellerProductId)
        .maybeSingle();
      if (own?.id) productId = Number(own.id);
    }

    // 3) SKU match
    if (!productId && sku) {
      const { data: bySku } = await supabase
        .from('products')
        .select('id')
        .eq('profile_id', opts.companyId)
        .ilike('sku', sku)
        .limit(1)
        .maybeSingle();
      if (bySku?.id) productId = Number(bySku.id);
    }

    // 4) Name match
    if (!productId && name) {
      const { data: byName } = await supabase
        .from('products')
        .select('id')
        .eq('profile_id', opts.companyId)
        .ilike('name', name)
        .limit(1)
        .maybeSingle();
      if (byName?.id) productId = Number(byName.id);
    }

    if (!productId) {
      skippedLines += 1;
      warnings.push(
        `Skipped “${name || 'line'}” — no matching product in your inventory (import from network or create SKU)`
      );
      continue;
    }

    const lotNumber = `${lotPrefix}-${i + 1}`;

    let q = supabase
      .from('stock_levels')
      .select('id, qty_on_hand')
      .eq('profile_id', opts.companyId)
      .eq('product_id', productId);
    if (wh) q = q.eq('warehouse_id', wh);
    else q = q.is('warehouse_id', null);
    const { data: level } = await q.maybeSingle();

    if (level) {
      await supabase
        .from('stock_levels')
        .update({
          qty_on_hand: Number(level.qty_on_hand || 0) + qty,
          lot_number: lotNumber,
          updated_at: now,
        })
        .eq('id', level.id);
    } else {
      await supabase.from('stock_levels').insert({
        profile_id: opts.companyId,
        product_id: productId,
        warehouse_id: wh,
        qty_on_hand: qty,
        lot_number: lotNumber,
        updated_at: now,
      });
    }

    // Soft stock movement log if table exists
    try {
      await supabase.from('stock_movements').insert({
        profile_id: opts.companyId,
        product_id: productId,
        warehouse_id: wh,
        quantity: qty,
        movement_type: 'receive',
        notes: `PO #${opts.poId} receive`,
        lot_number: lotNumber,
        reference_type: 'purchase_order',
        reference_id: String(opts.poId),
        created_at: now,
      });
    } catch {
      /* optional */
    }

    receivedLines += 1;
    qtyTotal += qty;
  }

  if (receivedLines > 0) {
    meta.inventory_received_at = now;
    meta.inventory_received_lines = receivedLines;
    meta.inventory_received_qty = qtyTotal;
    if (wh) meta.inventory_warehouse_id = wh;
    await supabase
      .from('purchase_orders')
      .update({ metadata: meta, updated_at: now })
      .eq('id', opts.poId)
      .eq('buyer_profile_id', opts.companyId);
  }

  return {
    ok: receivedLines > 0,
    receivedLines,
    skippedLines,
    qtyTotal,
    warnings,
    error:
      receivedLines === 0
        ? 'No lines matched your inventory products'
        : undefined,
  };
}
