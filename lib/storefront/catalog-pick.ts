/**
 * Company allowlist for the public storefront.
 * Default mode `all` keeps today’s catalogue (every active sellable SKU
 * except an explicit per-product hide). Mode `selected` shows only the
 * ticked items — an empty list publishes nothing.
 */

export type StorefrontCatalogMode = 'all' | 'selected';

export type StorefrontCatalogPick = {
  mode: StorefrontCatalogMode;
  product_ids: number[];
  seed_keys: string[];
  gym_item_ids: string[];
};

export const DEFAULT_STOREFRONT_CATALOG: StorefrontCatalogPick = {
  mode: 'all',
  product_ids: [],
  seed_keys: [],
  gym_item_ids: [],
};

function uniqPosInts(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const v of raw) {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out.slice(0, 500);
}

function uniqKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    const s = String(v || '')
      .trim()
      .toLowerCase();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.slice(0, 500);
}

export function parseStorefrontCatalog(raw: unknown): StorefrontCatalogPick {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_STOREFRONT_CATALOG, product_ids: [], seed_keys: [], gym_item_ids: [] };
  }
  const o = raw as Record<string, unknown>;
  return {
    mode: o.mode === 'selected' ? 'selected' : 'all',
    product_ids: uniqPosInts(o.product_ids ?? o.productIds),
    seed_keys: uniqKeys(o.seed_keys ?? o.seedKeys),
    gym_item_ids: uniqKeys(o.gym_item_ids ?? o.gymItemIds),
  };
}

export function storefrontCatalogFromProfileMetadata(
  meta: unknown
): StorefrontCatalogPick {
  const m =
    meta && typeof meta === 'object' && !Array.isArray(meta)
      ? (meta as Record<string, unknown>)
      : {};
  return parseStorefrontCatalog(m.storefront_catalog ?? m.storefrontCatalog);
}

export function serializeStorefrontCatalog(
  pick: StorefrontCatalogPick
): StorefrontCatalogPick {
  return parseStorefrontCatalog(pick);
}

export function storefrontItemKeys(p: {
  id?: number | string | null;
  sku?: string | null;
  externalRef?: string | null;
}): string[] {
  const keys: string[] = [];
  if (p.id != null && String(p.id).trim() !== '') {
    keys.push(String(p.id).trim().toLowerCase());
  }
  if (p.sku) keys.push(String(p.sku).trim().toLowerCase());
  if (p.externalRef) keys.push(String(p.externalRef).trim().toLowerCase());
  return [...new Set(keys.filter(Boolean))];
}

export function productMatchesStorefrontPick(
  p: {
    id?: number | string | null;
    sku?: string | null;
    externalRef?: string | null;
  },
  pick: StorefrontCatalogPick
): boolean {
  if (pick.mode !== 'selected') return true;
  const keys = new Set(storefrontItemKeys(p));
  const idNum = Number(p.id);
  if (Number.isInteger(idNum) && idNum > 0 && pick.product_ids.includes(idNum)) {
    return true;
  }
  for (const k of pick.seed_keys) {
    if (keys.has(k)) return true;
  }
  for (const k of pick.gym_item_ids) {
    if (keys.has(k)) return true;
  }
  return false;
}

export function applyStorefrontCatalog<
  T extends {
    id?: number | string | null;
    sku?: string | null;
    externalRef?: string | null;
  },
>(products: T[], pick: StorefrontCatalogPick): T[] {
  if (pick.mode !== 'selected') return products;
  return products.filter((p) => productMatchesStorefrontPick(p, pick));
}

export function gymStorefrontItemId(kind: string, id: string): string {
  return `gym-${String(kind || '').trim()}-${String(id || '').trim()}`;
}

export type StorefrontPickerItem = {
  key: string;
  kind: 'product' | 'seed' | 'gym';
  id: number | string;
  name: string;
  sku: string | null;
  category: string | null;
  image_url: string | null;
  status: string;
  is_sellable: boolean;
  seed_key: string | null;
};
