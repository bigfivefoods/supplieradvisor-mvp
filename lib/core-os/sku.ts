/**
 * One product book: gym extras, retail till, hire catalogue, clinic consumables.
 */

export type SharedSkuSource = 'gym_shop' | 'retail' | 'hire' | 'clinic';

export type SharedSkuDraft = {
  source: SharedSkuSource;
  source_id: string;
  sku: string;
  name: string;
  price_zar: number;
  category: string;
  track_stock: boolean;
  description?: string;
};

export function sharedSkuKey(source: SharedSkuSource, sourceId: string): string {
  return `core_sku:${source}:${sourceId}`;
}

export function parseSharedSkuKey(
  raw?: string | null
): { source: SharedSkuSource; source_id: string } | null {
  const m = String(raw || '').match(/^core_sku:(gym_shop|retail|hire|clinic):(.+)$/);
  if (!m) return null;
  return { source: m[1] as SharedSkuSource, source_id: m[2] };
}

export function skuFromGymShop(item: {
  id: string;
  name: string;
  price_zar: number;
  code?: string;
  description?: string;
  kind?: string;
}): SharedSkuDraft {
  return {
    source: 'gym_shop',
    source_id: item.id,
    sku: (item.code || `GYM-${item.id}`).slice(0, 32),
    name: item.name,
    price_zar: Number(item.price_zar || 0),
    category: item.kind === 'programme' ? 'Programme' : 'Membership',
    track_stock: false,
    description: item.description,
  };
}

export function skuFromRetail(item: {
  id: string;
  name: string;
  sku?: string;
  price_zar: number;
}): SharedSkuDraft {
  return {
    source: 'retail',
    source_id: item.id,
    sku: (item.sku || `RTL-${item.id}`).slice(0, 32),
    name: item.name,
    price_zar: Number(item.price_zar || 0),
    category: 'Retail',
    track_stock: true,
  };
}

export function skuFromHire(item: {
  id: string;
  title?: string;
  name?: string;
  sku?: string;
  rate_zar?: number | null;
  inventory_product_id?: number | null;
}): SharedSkuDraft {
  return {
    source: 'hire',
    source_id: item.id,
    sku: (item.sku || `HIR-${item.id}`).slice(0, 32),
    name: item.title || item.name || item.id,
    price_zar: Number(item.rate_zar || 0),
    category: 'Hire asset',
    track_stock: true,
  };
}

export function skuFromClinicConsumable(item: {
  id: string | number;
  name: string;
  sku?: string | null;
  sell_price?: number | null;
  category?: string | null;
}): SharedSkuDraft {
  return {
    source: 'clinic',
    source_id: String(item.id),
    sku: String(item.sku || `CLN-${item.id}`).slice(0, 32),
    name: item.name,
    price_zar: Number(item.sell_price || 0),
    category: item.category || 'Consumable',
    track_stock: true,
  };
}

export function collectSharedSkuDrafts(opts: {
  gymShop?: Array<{
    id: string;
    name: string;
    price_zar: number;
    code?: string;
    description?: string;
    kind?: string;
  }>;
  retail?: Array<{ id: string; name: string; sku?: string; price_zar: number }>;
  hire?: Array<{
    id: string;
    title?: string;
    name?: string;
    sku?: string;
    rate_zar?: number | null;
  }>;
  clinic?: Array<{
    id: string | number;
    name: string;
    sku?: string | null;
    sell_price?: number | null;
    category?: string | null;
  }>;
}): SharedSkuDraft[] {
  return [
    ...(opts.gymShop || []).map(skuFromGymShop),
    ...(opts.retail || []).map(skuFromRetail),
    ...(opts.hire || []).map(skuFromHire),
    ...(opts.clinic || []).map(skuFromClinicConsumable),
  ];
}

export function stockAfterUse(onHand: number, qty: number): number {
  return Math.max(0, Number(onHand || 0) - Number(qty || 0));
}

export type LinkedProduct = {
  id: number;
  sku?: string | null;
  name: string;
  metadata?: Record<string, unknown> | null;
};

export function findLinkedProduct(
  products: LinkedProduct[],
  draft: SharedSkuDraft
): LinkedProduct | null {
  const key = sharedSkuKey(draft.source, draft.source_id);
  const byMeta = products.find((p) => {
    const meta = p.metadata || {};
    return String(meta.shared_sku_key || '') === key;
  });
  if (byMeta) return byMeta;
  return (
    products.find(
      (p) => String(p.sku || '').toLowerCase() === draft.sku.toLowerCase()
    ) || null
  );
}
