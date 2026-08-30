/**
 * Supplier PO unit price: live products.cost_price (inventory wins).
 * Never sell_price. Never a typed guess. Never KELPACK_SEED_PRICES.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  applyMappedUnitPrices,
  productCostFromRow,
  roundMoney,
  supplierFacingUnitPrice,
} from '@/lib/commercial/engine';
import { lookupAcceptedMap } from '@/lib/commercial/db';
import { srmIdFromPo } from '@/lib/procurement/po-email';
import type { PoLineItem } from '@/lib/procurement/types';

export const OPEN_SUPPLIER_PO_STATUSES = ['draft', 'sent', 'confirmed'] as const;

function asObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function isOpenUnreceivedPo(po: {
  status?: unknown;
  metadata?: unknown;
}): boolean {
  const st = String(po.status || '').toLowerCase();
  if (!(OPEN_SUPPLIER_PO_STATUSES as readonly string[]).includes(st)) return false;
  const meta = asObject(po.metadata);
  if (meta.inventory_received_at) return false;
  const received = String(meta.inventory_received || '').toLowerCase();
  if (received === 'true' || received === '1') return false;
  return true;
}

export { productCostFromRow, supplierFacingUnitPrice };

function normSku(v: unknown): string {
  return String(v || '').trim().toLowerCase();
}

async function loadProductRows(
  profileId: number,
  ids: number[],
  skus: string[]
): Promise<Map<number, Record<string, unknown>>> {
  const out = new Map<number, Record<string, unknown>>();
  const supabase = getSupabaseServer();
  const uniqueIds = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
  if (uniqueIds.length) {
    const { data } = await supabase
      .from('products')
      .select('id, sku, cost_price, prices, name')
      .eq('profile_id', profileId)
      .in('id', uniqueIds);
    for (const row of data || []) {
      const r = row as unknown as Record<string, unknown>;
      out.set(Number(r.id), r);
    }
  }
  const wantSkus = [...new Set(skus.map(normSku).filter(Boolean))];
  const missingSkus = wantSkus.filter(
    (s) => ![...out.values()].some((r) => normSku(r.sku) === s)
  );
  if (missingSkus.length) {
    const { data } = await supabase
      .from('products')
      .select('id, sku, cost_price, prices, name')
      .eq('profile_id', profileId)
      .limit(800);
    for (const row of data || []) {
      const r = row as unknown as Record<string, unknown>;
      const sku = normSku(r.sku);
      if (sku && missingSkus.includes(sku)) out.set(Number(r.id), r);
    }
  }
  return out;
}

export function attachProductIdsFromSku<
  T extends { product_id?: number | null; sku?: string | null },
>(
  items: T[],
  products: Map<number, Record<string, unknown>>
): { items: T[]; error?: string } {
  const bySku = new Map<string, number>();
  for (const [id, row] of products) {
    const sku = normSku(row.sku);
    if (sku) bySku.set(sku, id);
  }
  const next = items.map((item) => {
    const pid = Number(item.product_id);
    if (Number.isFinite(pid) && pid > 0) return { ...item, product_id: pid };
    const sku = normSku(item.sku);
    const hit = sku ? bySku.get(sku) : undefined;
    return hit ? { ...item, product_id: hit } : { ...item };
  });
  const miss = next.find((i) => !(Number(i.product_id) > 0));
  if (miss) {
    const name = String(
      (miss as { item_name?: string; name?: string }).item_name ||
        (miss as { name?: string }).name ||
        miss.sku ||
        'line'
    );
    return {
      items: next,
      error: `Missing product_id for ${name}. Match a SKU or pick a catalogue line.`,
    };
  }
  return { items: next };
}

export async function lookupSupplierPoPriceMap(opts: {
  profileId: number;
  supplierId?: number | null;
  products: Map<number, Record<string, unknown>>;
}): Promise<Record<number, number>> {
  let accepted: Record<number, number> = {};
  if (opts.supplierId && opts.supplierId > 0) {
    try {
      accepted = await lookupAcceptedMap({
        profileId: opts.profileId,
        partyKind: 'supplier',
        supplierId: opts.supplierId,
      });
    } catch {
      accepted = {};
    }
  }
  const map: Record<number, number> = {};
  for (const [pid, row] of opts.products) {
    const unit = supplierFacingUnitPrice({
      costPrice: row.cost_price as number | null,
      prices: row.prices,
      acceptedPrice: Object.prototype.hasOwnProperty.call(accepted, pid)
        ? accepted[pid]
        : null,
    });
    if (unit != null) map[pid] = unit;
  }
  for (const [pid, price] of Object.entries(accepted)) {
    const id = Number(pid);
    if (!Object.prototype.hasOwnProperty.call(map, id)) {
      map[id] = roundMoney(price);
    }
  }
  return map;
}

export async function priceSupplierPoItems(opts: {
  profileId: number;
  supplierId?: number | null;
  items: PoLineItem[];
}): Promise<
  | { ok: true; items: Array<PoLineItem & { line_total: number }>; total: number }
  | { ok: false; error: string }
> {
  const ids = opts.items.map((i) => Number(i.product_id)).filter((n) => n > 0);
  const skus = opts.items.map((i) => String(i.sku || '').trim()).filter(Boolean);
  const products = await loadProductRows(opts.profileId, ids, skus);
  const attached = attachProductIdsFromSku(opts.items, products);
  if (attached.error) return { ok: false, error: attached.error };
  const map = await lookupSupplierPoPriceMap({
    profileId: opts.profileId,
    supplierId: opts.supplierId,
    products,
  });
  const priced = applyMappedUnitPrices(attached.items, map);
  if (!priced.ok) return priced;
  return { ok: true, items: priced.items, total: priced.total };
}

export async function repriceOpenSupplierPos(opts: {
  profileId: number;
  supplierId?: number | null;
  productId?: number | null;
}): Promise<number> {
  const supabase = getSupabaseServer();
  const hit = await supabase
    .from('purchase_orders')
    .select('id, status, items, total_amount, metadata, supplier_id')
    .eq('buyer_profile_id', opts.profileId)
    .in('status', [...OPEN_SUPPLIER_PO_STATUSES])
    .limit(300);
  if (hit.error || !hit.data) return 0;
  let updated = 0;
  const now = new Date().toISOString();
  for (const raw of hit.data) {
    const po = raw as unknown as Record<string, unknown>;
    if (!isOpenUnreceivedPo(po)) continue;
    const srmId = srmIdFromPo({
      supplier_id: po.supplier_id,
      metadata: po.metadata,
    });
    if (opts.supplierId && srmId !== opts.supplierId) continue;
    const items = Array.isArray(po.items) ? (po.items as PoLineItem[]) : [];
    if (!items.length) continue;
    if (opts.productId) {
      const has = items.some((i) => Number(i.product_id) === opts.productId);
      if (!has) continue;
    }
    const priced = await priceSupplierPoItems({
      profileId: opts.profileId,
      supplierId: srmId,
      items,
    });
    if (!priced.ok) continue;
    const patch: Record<string, unknown> = {
      items: priced.items,
      total_amount: priced.total,
      subtotal: priced.total,
      updated_at: now,
    };
    let upd = await supabase
      .from('purchase_orders')
      .update(patch as never)
      .eq('id', po.id)
      .eq('buyer_profile_id', opts.profileId);
    if (upd.error && /column|schema cache/i.test(upd.error.message || '')) {
      delete patch.subtotal;
      upd = await supabase
        .from('purchase_orders')
        .update(patch as never)
        .eq('id', po.id)
        .eq('buyer_profile_id', opts.profileId);
    }
    if (!upd.error) updated += 1;
  }
  return updated;
}
