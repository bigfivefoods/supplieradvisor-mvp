import { getSupabaseServer } from '@/lib/supabase/server-client';
import type { PortalStockLine } from '@/lib/portals/trade-portal';
import { postStock } from '@/lib/inventory/post-stock';

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
    .replace(/\b(pty|ltd|limited|npc|npo|cc|inc|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function warehouseMatchesCustomer(
  warehouse: {
    warehouse_type?: unknown;
    owner_type?: unknown;
    name?: unknown;
    partner_name?: unknown;
    metadata?: unknown;
  },
  viewer: { customerId: number; tradingName?: string | null }
): boolean {
  const type = String(warehouse.warehouse_type || '').toLowerCase();
  const owner = String(warehouse.owner_type || '').toLowerCase();
  const isSite = type === 'customer_site' || owner === 'customer';
  if (!isSite) return false;
  const meta = asObject(warehouse.metadata);
  const stamped = Number(meta.customer_id);
  if (
    Number.isFinite(viewer.customerId) &&
    viewer.customerId > 0 &&
    stamped === viewer.customerId
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

export async function resolveCustomerSites(opts: {
  companyId: number;
  customerId: number;
  tradingName?: string | null;
}): Promise<Array<{ id: number; name: string }>> {
  const supabase = getSupabaseServer();
  const wide = await supabase
    .from('warehouses')
    .select(
      'id, name, partner_name, warehouse_type, owner_type, status, metadata'
    )
    .eq('profile_id', opts.companyId)
    .limit(200);
  const rows = (wide.error ? [] : wide.data || []) as unknown as Record<
    string,
    unknown
  >[];
  return rows
    .filter((w) =>
      warehouseMatchesCustomer(w, {
        customerId: opts.customerId,
        tradingName: opts.tradingName,
      })
    )
    .map((w) => ({ id: Number(w.id), name: String(w.name || `Site #${w.id}`) }))
    .filter((w) => Number.isFinite(w.id) && w.id > 0);
}

export async function loadCustomerHeldStock(opts: {
  companyId: number;
  customerId: number;
  tradingName?: string | null;
}): Promise<PortalStockLine[]> {
  const sites = await resolveCustomerSites(opts);
  if (!sites.length) return [];
  const supabase = getSupabaseServer();
  const ids = sites.map((d) => d.id);
  const nameById = Object.fromEntries(sites.map((d) => [d.id, d.name]));
  const levelsHit = await supabase
    .from('stock_levels')
    .select(
      'id, product_id, warehouse_id, qty_on_hand, qty_reserved, lot_number, expiry_date'
    )
    .eq('profile_id', opts.companyId)
    .in('warehouse_id', ids)
    .limit(400);
  const levels = (levelsHit.data || []) as unknown as Record<string, unknown>[];
  const productIds = [
    ...new Set(
      levels.map((l) => Number(l.product_id)).filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  const products = new Map<
    number,
    {
      name: string;
      sku: string | null;
      product_type: string | null;
      primary_image_url: string | null;
    }
  >();
  if (productIds.length) {
    const { data: prows } = await supabase
      .from('products')
      .select('id, name, sku, product_type, primary_image_url')
      .eq('profile_id', opts.companyId)
      .in('id', productIds);
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
  for (const l of levels) {
    const productId = Number(l.product_id);
    const warehouseId = Number(l.warehouse_id);
    const qty = Number(l.qty_on_hand || 0);
    const reserved = Number(l.qty_reserved || 0);
    const product = products.get(productId);
    out.push({
      product_id: Number.isFinite(productId) ? productId : null,
      sku: product?.sku || null,
      name: product?.name || `Product #${productId}`,
      qty_on_hand: qty,
      qty_reserved: reserved,
      qty_available: qty - reserved,
      warehouse_id: Number.isFinite(warehouseId) ? warehouseId : null,
      warehouse_name: nameById[warehouseId] || null,
      product_type: product?.product_type || null,
      primary_image_url: product?.primary_image_url || null,
      lot_number: l.lot_number != null ? String(l.lot_number) : null,
      expiry_date: l.expiry_date != null ? String(l.expiry_date).slice(0, 10) : null,
      po_id: null,
    });
  }
  return out;
}

export async function applyCustomerStockUpdate(opts: {
  companyId: number;
  customerId: number;
  tradingName?: string | null;
  warehouseId: number;
  productId: number;
  qtyOnHand: number;
}): Promise<
  | { ok: true; qty_on_hand: number; qty_available: number }
  | { ok: false; error: string; status: number }
> {
  const sites = await resolveCustomerSites(opts);
  if (!sites.some((d) => d.id === opts.warehouseId)) {
    return {
      ok: false,
      error: 'That warehouse is not this customer site',
      status: 403,
    };
  }
  return postStock({
    profileId: opts.companyId,
    productId: opts.productId,
    warehouseId: opts.warehouseId,
    movementType: 'count',
    absoluteQty: opts.qtyOnHand,
    referenceType: 'portal_stock_update',
    notes: 'Customer portal stock count',
  });
}
