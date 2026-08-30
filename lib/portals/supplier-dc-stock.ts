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
  const nameHit =
    Boolean(name) &&
    (name === want || name.includes(want) || want.includes(name));
  const partnerHit =
    Boolean(partner) &&
    (partner === want || partner.includes(want) || want.includes(partner));
  return nameHit || partnerHit;
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
      'id, product_id, warehouse_id, qty_on_hand, qty_reserved, qty_available, lot_number, expiry_date'
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
  const levelByProductWh = new Map<string, Record<string, unknown>>();
  for (const l of levels) {
    levelByProductWh.set(`${Number(l.warehouse_id)}:${Number(l.product_id)}`, l);
  }
  const productIds = [
    ...new Set(
      levels
        .map((l) => Number(l.product_id))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  const pinnedHit = await supabase
    .from('products')
    .select(
      'id, name, sku, product_type, warehouse_id, metadata, primary_image_url'
    )
    .eq('profile_id', opts.companyId)
    .limit(500);
  let pinned: Record<string, unknown>[] = [];
  if (!pinnedHit.error && pinnedHit.data) {
    pinned = pinnedHit.data as unknown as Record<string, unknown>[];
  } else {
    const retry = await supabase
      .from('products')
      .select('id, name, sku, product_type, metadata')
      .eq('profile_id', opts.companyId)
      .limit(500);
    pinned = (retry.data || []) as unknown as Record<string, unknown>[];
  }
  const defaultWh = ids[0];
  for (const p of pinned) {
    const pid = Number(p.id);
    const meta = asObject(p.metadata);
    const stamped = Number(meta.srm_supplier_id);
    const whCol = Number(p.warehouse_id);
    const onThisDc =
      (Number.isFinite(whCol) && ids.includes(whCol)) ||
      stamped === opts.supplierId;
    if (!onThisDc) continue;
    if (!productIds.includes(pid)) productIds.push(pid);
    const warehouseId =
      Number.isFinite(whCol) && ids.includes(whCol) ? whCol : defaultWh;
    const key = `${warehouseId}:${pid}`;
    if (!levelByProductWh.has(key)) {
      levelByProductWh.set(key, {
        product_id: pid,
        warehouse_id: warehouseId,
        qty_on_hand: 0,
        qty_reserved: 0,
        qty_available: 0,
      });
    }
  }
  const products = new Map<
    number,
    {
      name: string;
      sku: string | null;
      product_type: string | null;
      primary_image_url: string | null;
    }
  >();
  for (const p of pinned) {
    products.set(Number(p.id), {
      name: String(p.name || `Product #${p.id}`),
      sku: p.sku != null ? String(p.sku) : null,
      product_type: p.product_type != null ? String(p.product_type) : null,
      primary_image_url:
        p.primary_image_url != null ? String(p.primary_image_url) : null,
    });
  }
  if (productIds.some((id) => !products.has(id))) {
    const missing = productIds.filter((id) => !products.has(id));
    const { data: prows } = await supabase
      .from('products')
      .select('id, name, sku, product_type, primary_image_url')
      .eq('profile_id', opts.companyId)
      .in('id', missing);
    for (const p of prows || []) {
      products.set(Number(p.id), {
        name: String(p.name || `Product #${p.id}`),
        sku: p.sku != null ? String(p.sku) : null,
        product_type: p.product_type != null ? String(p.product_type) : null,
        primary_image_url:
          p.primary_image_url != null ? String(p.primary_image_url) : null,
      });
    }
  }
  const out: PortalStockLine[] = [];
  for (const l of levelByProductWh.values()) {
    const productId = Number(l.product_id);
    const warehouseId = Number(l.warehouse_id);
    const qty = Number(l.qty_on_hand || 0);
    const reserved = Number(l.qty_reserved || 0);
    const available =
      l.qty_available != null ? Number(l.qty_available) : qty - reserved;
    const product = products.get(productId);
    out.push({
      product_id: Number.isFinite(productId) ? productId : null,
      sku: product?.sku || null,
      name: product?.name || `Product #${productId}`,
      qty_on_hand: qty,
      qty_reserved: reserved,
      qty_available: available,
      warehouse_id: Number.isFinite(warehouseId) ? warehouseId : null,
      warehouse_name: nameById[warehouseId] || null,
      product_type: product?.product_type || null,
      primary_image_url: product?.primary_image_url || null,
      lot_number: l.lot_number != null ? String(l.lot_number) : null,
      expiry_date:
        l.expiry_date != null ? String(l.expiry_date).slice(0, 10) : null,
      po_id: null,
    });
  }
  return out;
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
  const { postStock } = await import('@/lib/inventory/post-stock');
  return postStock({
    profileId: opts.companyId,
    productId: opts.productId,
    warehouseId: opts.warehouseId,
    movementType: 'count',
    absoluteQty: opts.qtyOnHand,
    referenceType: 'portal_stock_update',
    notes: 'Supplier portal stock count',
  });
}
