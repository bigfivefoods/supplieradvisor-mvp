/**
 * Receive PO lines into buyer warehouse stock (soft match by source/sku/name).
 * Creates product stubs for unmatched lines so the golden path "stocked" stage can complete.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import type { PoLineItem } from '@/lib/procurement/types';

export type ReceiveFromPoResult = {
  ok: boolean;
  receivedLines: number;
  skippedLines: number;
  qtyTotal: number;
  createdProducts: number;
  warnings: string[];
  error?: string;
  alreadyReceived?: boolean;
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
  /** Create inventory products when no match (default true) */
  createMissingProducts?: boolean;
  /** Scale line qty by delivered_quantity / order_quantity when set */
  deliveredQuantity?: number | null;
}): Promise<ReceiveFromPoResult> {
  const supabase = getSupabaseServer();
  const warnings: string[] = [];
  let receivedLines = 0;
  let skippedLines = 0;
  let qtyTotal = 0;
  let createdProducts = 0;
  const createMissing = opts.createMissingProducts !== false;

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .select(
      'id, buyer_profile_id, supplier_profile_id, items, status, metadata, delivered_quantity, order_quantity, po_number, order_number'
    )
    .eq('id', opts.poId)
    .eq('buyer_profile_id', opts.companyId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      receivedLines: 0,
      skippedLines: 0,
      qtyTotal: 0,
      createdProducts: 0,
      warnings,
      error: error.message,
    };
  }
  if (!po) {
    return {
      ok: false,
      receivedLines: 0,
      skippedLines: 0,
      qtyTotal: 0,
      createdProducts: 0,
      warnings,
      error: 'PO not found',
    };
  }

  const meta =
    po.metadata && typeof po.metadata === 'object' && !Array.isArray(po.metadata)
      ? { ...(po.metadata as Record<string, unknown>) }
      : {};
  if (meta.inventory_received_at) {
    if (!meta.lots_received_at) {
      await copyPoLotsToInventory({
        companyId: opts.companyId,
        poId: opts.poId,
        poNumber: String(po.po_number || po.order_number || `PO-${opts.poId}`),
        items: asLines(po.items),
        productByLine: {},
        warehouseId: opts.warehouseId != null ? Number(opts.warehouseId) : null,
        meta,
      });
      if (meta.lots_received_at) {
        await supabase
          .from('purchase_orders')
          .update({ metadata: meta, updated_at: new Date().toISOString() })
          .eq('id', opts.poId)
          .eq('buyer_profile_id', opts.companyId);
      }
    }
    return {
      ok: true,
      alreadyReceived: true,
      receivedLines: Number(meta.inventory_received_lines || 0),
      skippedLines: 0,
      qtyTotal: Number(meta.inventory_received_qty || 0),
      createdProducts: 0,
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
      createdProducts: 0,
      warnings,
      error: 'PO has no line items',
    };
  }

  // Scale lines if header delivered qty differs from ordered sum
  const orderedSum = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const deliveredHdr =
    opts.deliveredQuantity != null
      ? Number(opts.deliveredQuantity)
      : po.delivered_quantity != null
        ? Number(po.delivered_quantity)
        : null;
  const scale =
    deliveredHdr != null &&
    Number.isFinite(deliveredHdr) &&
    orderedSum > 0 &&
    Math.abs(deliveredHdr - orderedSum) > 0.0001
      ? Math.max(0, deliveredHdr / orderedSum)
      : 1;
  if (scale !== 1) {
    warnings.push(
      `Scaled line quantities by ${(scale * 100).toFixed(0)}% to match delivered qty ${deliveredHdr}`
    );
  }

  const warehouseId =
    opts.warehouseId != null && Number.isFinite(Number(opts.warehouseId))
      ? Number(opts.warehouseId)
      : null;

  // Default warehouse if none
  let wh = warehouseId;
  const srmStamp = Number(meta.srm_supplier_id);
  if (!wh && Number.isFinite(srmStamp) && srmStamp > 0) {
    const { data: dcs } = await supabase
      .from('warehouses')
      .select('id, metadata')
      .eq('profile_id', opts.companyId)
      .limit(50);
    const hit = (dcs || []).find((w) => {
      const m =
        w.metadata && typeof w.metadata === 'object'
          ? (w.metadata as Record<string, unknown>)
          : {};
      return Number(m.srm_supplier_id) === srmStamp;
    });
    if (hit?.id) wh = Number(hit.id);
  }
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
  const productByLine: Record<number, number> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let qty = Number(line.quantity || 0) * scale;
    qty = Math.round(qty * 1000) / 1000;
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
    const uom = (line as { uom?: string }).uom
      ? String((line as { uom?: string }).uom)
      : null;
    const unitCost = Number(line.unit_price || 0) || null;

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

    // 5) Create stub product so receive never silently drops lines
    if (!productId && createMissing && name) {
      const stubSku = (sku || `PO${opts.poId}-L${i + 1}`).slice(0, 40);
      const insertRow: Record<string, unknown> = {
        profile_id: opts.companyId,
        name: name.slice(0, 200),
        sku: stubSku,
        status: 'active',
        product_type: 'raw_material',
        uom: uom || 'ea',
        updated_at: now,
      };
      if (sellerProductId) insertRow.source_product_id = sellerProductId;
      if (unitCost != null) {
        insertRow.cost_price = unitCost;
        insertRow.sell_price = unitCost;
      }
      const { data: created, error: createErr } = await supabase
        .from('products')
        .insert(insertRow)
        .select('id')
        .single();
      if (createErr || !created?.id) {
        skippedLines += 1;
        warnings.push(
          `Skipped “${name}” — could not create inventory product (${createErr?.message || 'unknown'})`
        );
        continue;
      }
      productId = Number(created.id);
      createdProducts += 1;
      warnings.push(`Created inventory product “${name}” (${stubSku})`);
    }

    if (!productId) {
      skippedLines += 1;
      warnings.push(
        `Skipped “${name || 'line'}” — no matching product and create disabled`
      );
      continue;
    }

    productByLine[i] = productId;
    const lotNumber = `${lotPrefix}-${i + 1}`;
    if (!wh) {
      skippedLines += 1;
      warnings.push(`Skipped “${name || 'line'}” — no warehouse to receive into`);
      continue;
    }
    const { postStock } = await import('@/lib/inventory/post-stock');
    const posted = await postStock({
      profileId: opts.companyId,
      productId,
      warehouseId: wh,
      movementType: 'receive',
      quantity: qty,
      unitCost: unitCost != null && unitCost > 0 ? unitCost : 0,
      lotNumber,
      referenceType: 'purchase_order',
      referenceId: opts.poId,
      notes: `PO #${opts.poId} receive`,
    });
    if (!posted.ok) {
      warnings.push(`Receive post failed for product ${productId}: ${posted.error}`);
    }

    receivedLines += 1;
    qtyTotal += qty;
  }

  if (receivedLines > 0) {
    meta.inventory_received_at = now;
    meta.inventory_received_lines = receivedLines;
    meta.inventory_received_qty = qtyTotal;
    meta.inventory_created_products = createdProducts;
    if (wh) meta.inventory_warehouse_id = wh;
    await copyPoLotsToInventory({
      companyId: opts.companyId,
      poId: opts.poId,
      poNumber: String(po.po_number || po.order_number || `PO-${opts.poId}`),
      items: lines,
      productByLine,
      warehouseId: wh,
      meta,
    });
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
    createdProducts,
    warnings,
    error:
      receivedLines === 0
        ? 'No lines could be received into inventory'
        : undefined,
  };
}

async function copyPoLotsToInventory(opts: {
  companyId: number;
  poId: number;
  poNumber: string;
  items: PoLineItem[];
  productByLine: Record<number, number>;
  warehouseId: number | null;
  meta: Record<string, unknown>;
}): Promise<void> {
  if (opts.meta.lots_received_at) return;
  const supabase = getSupabaseServer();
  const hit = await supabase
    .from('order_batches')
    .select(
      'batch_number, qty, uom, produced_at, expiry_date, order_line_index, metadata'
    )
    .eq('company_id', opts.companyId)
    .eq('order_id', opts.poId)
    .limit(200);
  let rows: Record<string, unknown>[] = (hit.data ||
    []) as unknown as Record<string, unknown>[];
  if (hit.error) {
    const retry = await supabase
      .from('order_batches')
      .select('batch_number, qty, uom, produced_at, metadata')
      .eq('company_id', opts.companyId)
      .eq('order_id', opts.poId)
      .limit(200);
    rows = (retry.data || []) as unknown as Record<string, unknown>[];
  }
  if (!rows.length) return;

  const { inventoryLotPayloadFromBatch } = await import(
    '@/lib/portals/supplier-portal-party'
  );
  for (const raw of rows) {
    const batchNumber = String(raw.batch_number || '').trim();
    if (!batchNumber) continue;
    const lineIdx =
      raw.order_line_index != null ? Number(raw.order_line_index) : 0;
    const productId =
      (Number.isFinite(lineIdx) ? opts.productByLine[lineIdx] : null) ||
      (opts.items[lineIdx]?.product_id != null
        ? Number(opts.items[lineIdx].product_id)
        : null) ||
      Object.values(opts.productByLine)[0] ||
      null;
    const meta =
      raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : {};
    const manufactured =
      String(raw.produced_at || meta.manufactured_date || '').slice(0, 10) ||
      null;
    const expiry =
      String(raw.expiry_date || meta.expiry_date || '').slice(0, 10) || null;
    const bestBefore =
      String(meta.best_before || '').slice(0, 10) || null;
    if (!productId) continue;

    const existing = await supabase
      .from('inventory_lots')
      .select('id, qty_on_hand')
      .eq('profile_id', opts.companyId)
      .eq('product_id', productId)
      .eq('lot_number', batchNumber)
      .maybeSingle();
    if (existing.data?.id) {
      continue;
    }
    const payload = inventoryLotPayloadFromBatch({
      companyId: opts.companyId,
      productId,
      batchNumber,
      qty: Number(raw.qty) || 0,
      manufacturedDate: manufactured,
      expiryDate: expiry,
      bestBefore,
      supplierRef: opts.poNumber,
      warehouseId: opts.warehouseId,
    });
    let ins = await supabase.from('inventory_lots').insert(payload);
    if (ins.error) {
      const soft = { ...payload };
      delete soft.best_before;
      ins = await supabase.from('inventory_lots').insert(soft);
    }
    if (ins.error) {
      const soft = { ...payload };
      delete soft.best_before;
      delete soft.supplier_ref;
      await supabase.from('inventory_lots').insert(soft);
    }
  }
  opts.meta.lots_received_at = new Date().toISOString();
  const prev = Array.isArray(opts.meta.received_lots)
    ? (opts.meta.received_lots as unknown[])
    : [];
  opts.meta.received_lots = [
    ...prev,
    ...rows
      .filter((r) => String(r.batch_number || '').trim())
      .map((r) => ({
        batch_number: String(r.batch_number),
        qty: Number(r.qty) || 0,
        manufactured_date: String(
          r.produced_at ||
            (r.metadata && typeof r.metadata === 'object'
              ? (r.metadata as { manufactured_date?: unknown }).manufactured_date
              : '') ||
            ''
        ).slice(0, 10),
        expiry_date: String(
          r.expiry_date ||
            (r.metadata && typeof r.metadata === 'object'
              ? (r.metadata as { expiry_date?: unknown }).expiry_date
              : '') ||
            ''
        ).slice(0, 10),
      })),
  ];
}
