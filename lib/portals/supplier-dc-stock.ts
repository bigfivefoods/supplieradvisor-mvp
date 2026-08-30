import { getSupabaseServer } from '@/lib/supabase/server-client';
import type { PortalStockLine } from '@/lib/portals/trade-portal';

function asObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function normName(v: unknown): string {
  return String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(pty|ltd|limited|npc|npo|cc|inc|the|manufacturing)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function warehouseMatchesSupplier(
  warehouse: {
    warehouse_type?: unknown;
    owner_type?: unknown;
    name?: unknown;
    partner_name?: unknown;
    metadata?: unknown;
  },
  viewer: { supplierId: number; tradingName?: string | null }
): boolean {
  const type = String(warehouse.warehouse_type || '').toLowerCase();
  const owner = String(warehouse.owner_type || '').toLowerCase();
  const isDc = type === 'supplier_dc' || owner === 'supplier';
  if (!isDc) return false;
  const meta = asObject(warehouse.metadata);
  const stamped = Number(meta.srm_supplier_id);
  if (
    Number.isFinite(viewer.supplierId) &&
    viewer.supplierId > 0 &&
    stamped === viewer.supplierId
  ) {
    return true;
  }
  const want = normName(viewer.tradingName);
  if (!want) return false;
  const name = normName(warehouse.name);
  const partner = normName(warehouse.partner_name);
  return (
    (name && (name === want || name.includes(want) || want.includes(name))) ||
    (partner &&
      (partner === want || partner.includes(want) || want.includes(partner)))
  );
}

export async function resolveSupplierDcs(opts: {
  companyId: number;
  supplierId: number;
  tradingName?: string | null;
  stamp?: boolean;
}): Promise<Array<{ id: number; name: string }>> {
  const supabase = getSupabaseServer();
  const wide = await supabase
    .from('warehouses')
    .select(
      'id, name, partner_name, warehouse_type, owner_type, status, metadata'
    )
    .eq('profile_id', opts.companyId)
    .limit(200);
  let rows: Record<string, unknown>[] = [];
  if (!wide.error && wide.data) {
    rows = wide.data as unknown as Record<string, unknown>[];
  } else {
    const soft = await supabase
      .from('warehouses')
      .select('id, name, partner_name, warehouse_type, owner_type, status')
      .eq('profile_id', opts.companyId)
      .limit(200);
    rows = (soft.data || []) as unknown as Record<string, unknown>[];
  }
  const matched: Array<{ id: number; name: string; raw: Record<string, unknown> }> =
    [];
  for (const raw of rows) {
    if (String(raw.status || 'active').toLowerCase() === 'inactive') continue;
    if (
      !warehouseMatchesSupplier(raw, {
        supplierId: opts.supplierId,
        tradingName: opts.tradingName,
      })
    ) {
      continue;
    }
    matched.push({
      id: Number(raw.id),
      name: String(raw.name || 'Supplier DC'),
      raw,
    });
  }
  if (opts.stamp !== false) {
    for (const w of matched) {
      const meta = asObject(w.raw.metadata);
      if (Number(meta.srm_supplier_id) === opts.supplierId) continue;
      const next = { ...meta, srm_supplier_id: opts.supplierId };
      await supabase
        .from('warehouses')
        .update({ metadata: next, updated_at: new Date().toISOString() } as never)
        .eq('id', w.id)
        .eq('profile_id', opts.companyId);
    }
  }
  return matched.map((w) => ({ id: w.id, name: w.name }));
}

export async function loadSupplierHeldStock(opts: {
  companyId: number;
  supplierId: number;
  tradingName?: string | null;
}): Promise<PortalStockLine[]> {
  const dcs = await resolveSupplierDcs({
    companyId: opts.companyId,
    supplierId: opts.supplierId,
    tradingName: opts.tradingName,
    stamp: true,
  });
  if (!dcs.length) return [];
  const supabase = getSupabaseServer();
  const ids = dcs.map((d) => d.id);
  const nameById = Object.fromEntries(dcs.map((d) => [d.id, d.name]));
  const levelsHit = await supabase
    .from('stock_levels')
    .select(
      'id, product_id, warehouse_id, qty_on_hand, qty_reserved, qty_available'
    )
    .eq('profile_id', opts.companyId)
    .in('warehouse_id', ids)
    .limit(400);
  let levels: Record<string, unknown>[] = [];
  if (!levelsHit.error && levelsHit.data) {
    levels = levelsHit.data as unknown as Record<string, unknown>[];
  } else {
    const retry = await supabase
      .from('stock_levels')
      .select('id, product_id, warehouse_id, qty_on_hand')
      .eq('profile_id', opts.companyId)
      .in('warehouse_id', ids)
      .limit(400);
    levels = (retry.data || []) as unknown as Record<string, unknown>[];
  }
  const productIds = [
    ...new Set(
      levels
        .map((l) => Number(l.product_id))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  const products = new Map<
    number,
    { name: string; sku: string | null }
  >();
  if (productIds.length) {
    const { data: prows } = await supabase
      .from('products')
      .select('id, name, sku')
      .eq('profile_id', opts.companyId)
      .in('id', productIds);
    for (const p of prows || []) {
      products.set(Number(p.id), {
        name: String(p.name || `Product #${p.id}`),
        sku: p.sku != null ? String(p.sku) : null,
      });
    }
  }
  return levels.map((l) => {
    const productId = Number(l.product_id);
    const warehouseId = Number(l.warehouse_id);
    const qty = Number(l.qty_on_hand || 0);
    const reserved = Number(l.qty_reserved || 0);
    const available =
      l.qty_available != null ? Number(l.qty_available) : qty - reserved;
    const product = products.get(productId);
    return {
      product_id: Number.isFinite(productId) ? productId : null,
      sku: product?.sku || null,
      name: product?.name || `Product #${productId}`,
      qty_on_hand: qty,
      qty_reserved: reserved,
      qty_available: available,
      warehouse_id: Number.isFinite(warehouseId) ? warehouseId : null,
      warehouse_name: nameById[warehouseId] || null,
      po_id: null,
    };
  });
}

export async function applySupplierStockUpdate(opts: {
  companyId: number;
  supplierId: number;
  tradingName?: string | null;
  warehouseId: number;
  productId: number;
  qtyOnHand: number;
}): Promise<
  | { ok: true; qty_on_hand: number; qty_available: number }
  | { ok: false; error: string; status: number }
> {
  const dcs = await resolveSupplierDcs({
    companyId: opts.companyId,
    supplierId: opts.supplierId,
    tradingName: opts.tradingName,
    stamp: false,
  });
  if (!dcs.some((d) => d.id === opts.warehouseId)) {
    return {
      ok: false,
      error: 'That warehouse is not this supplier DC',
      status: 403,
    };
  }
  const qty = Number(opts.qtyOnHand);
  if (!Number.isFinite(qty) || qty < 0) {
    return { ok: false, error: 'qty_on_hand must be zero or more', status: 400 };
  }
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const existing = await supabase
    .from('stock_levels')
    .select('id, qty_on_hand, qty_reserved')
    .eq('profile_id', opts.companyId)
    .eq('warehouse_id', opts.warehouseId)
    .eq('product_id', opts.productId)
    .maybeSingle();
  const reserved = Number(existing.data?.qty_reserved || 0);
  const available = qty - reserved;
  if (existing.data?.id) {
    const upd = await supabase
      .from('stock_levels')
      .update({
        qty_on_hand: qty,
        qty_available: available,
        updated_at: now,
      } as never)
      .eq('id', existing.data.id)
      .eq('profile_id', opts.companyId);
    if (upd.error && /qty_available/i.test(upd.error.message || '')) {
      const retry = await supabase
        .from('stock_levels')
        .update({ qty_on_hand: qty, updated_at: now } as never)
        .eq('id', existing.data.id)
        .eq('profile_id', opts.companyId);
      if (retry.error) {
        return { ok: false, error: retry.error.message, status: 500 };
      }
    } else if (upd.error) {
      return { ok: false, error: upd.error.message, status: 500 };
    }
  } else {
    const ins = await supabase.from('stock_levels').insert({
      profile_id: opts.companyId,
      warehouse_id: opts.warehouseId,
      product_id: opts.productId,
      qty_on_hand: qty,
      qty_available: available,
      updated_at: now,
    } as never);
    if (ins.error && /qty_available/i.test(ins.error.message || '')) {
      const retry = await supabase.from('stock_levels').insert({
        profile_id: opts.companyId,
        warehouse_id: opts.warehouseId,
        product_id: opts.productId,
        qty_on_hand: qty,
        updated_at: now,
      } as never);
      if (retry.error) {
        return { ok: false, error: retry.error.message, status: 500 };
      }
    } else if (ins.error) {
      return { ok: false, error: ins.error.message, status: 500 };
    }
  }
  const movement = {
    profile_id: opts.companyId,
    product_id: opts.productId,
    warehouse_id: opts.warehouseId,
    quantity: qty,
    movement_type: 'count',
    notes: 'Supplier portal stock count',
    reference_type: 'portal_stock_update',
    created_at: now,
  };
  const mov = await supabase.from('stock_movements').insert(movement as never);
  if (mov.error && /column|schema cache|does not exist/i.test(mov.error.message || '')) {
    await supabase.from('stock_movements').insert({
      profile_id: opts.companyId,
      product_id: opts.productId,
      warehouse_id: opts.warehouseId,
      quantity: qty,
      movement_type: 'count',
      created_at: now,
    } as never);
  }
  return { ok: true, qty_on_hand: qty, qty_available: available };
}
