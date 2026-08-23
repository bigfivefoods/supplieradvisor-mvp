/**
 * Sellable Core Inventory items for the GymAdvisor member shop.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import type { GymShopItem } from './gym-shop';

export type GymInventoryShopItem = {
  id: string;
  product_id: number;
  kind: 'product';
  group: 'goods' | 'service';
  name: string;
  description?: string;
  price_zar: number;
  image_url?: string | null;
  sku?: string | null;
};

const SERVICE_TYPE_RE =
  /^(service|services|membership|class|programme|program)$/i;
const SERVICE_CATEGORY_RE =
  /service|class|membership|programme|program|fitness|pilates|bootcamp|training|pt\b/i;

export function inventoryGroupOf(
  productType?: string | null,
  category?: string | null,
  metadata?: Record<string, unknown> | null
): 'goods' | 'service' {
  const t = String(productType || '').trim();
  if (SERVICE_TYPE_RE.test(t)) return 'service';
  const cat = String(category || '');
  if (SERVICE_CATEGORY_RE.test(cat)) return 'service';
  const key = String(metadata?.shared_sku_key || '');
  if (key.startsWith('core_sku:gym_shop')) return 'service';
  return 'goods';
}

export function gymShopItemFromInventory(
  item: GymInventoryShopItem
): GymShopItem {
  return {
    kind: 'product',
    id: item.id,
    name: item.name,
    description: item.description,
    price_zar: item.price_zar,
    billing: 'once',
    image_url: item.image_url,
    group: item.group,
    code: item.sku || undefined,
  };
}

export function mergeGymShopWithInventory(
  catalog: GymShopItem[],
  inventory: GymInventoryShopItem[]
): GymShopItem[] {
  const ids = new Set(catalog.map((i) => i.id));
  const codes = new Set(
    catalog
      .map((i) => String(i.code || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const extra = inventory.filter((p) => {
    if (ids.has(p.id)) return false;
    const sku = String(p.sku || '').trim().toLowerCase();
    if (sku && codes.has(sku)) return false;
    return true;
  });
  return [...catalog, ...extra.map(gymShopItemFromInventory)];
}

export async function listGymInventoryShop(
  companyId: number
): Promise<GymInventoryShopItem[]> {
  if (!Number.isFinite(companyId) || companyId <= 0) return [];
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('products')
      .select(
        'id, name, sku, category, product_type, short_description, status, primary_image_url, sell_price, prices, is_sellable, metadata'
      )
      .eq('profile_id', companyId)
      .limit(400);
    if (error || !data?.length) return [];
    return data
      .filter((p) => {
        const st = String(p.status || 'active').toLowerCase();
        if (st === 'archived' || st === 'inactive' || st === 'deleted') return false;
        if (p.is_sellable === false) return false;
        return true;
      })
      .map((p) => {
        const prices = Array.isArray(p.prices) ? p.prices : [];
        const zar = prices.find(
          (row: { currency?: string; sell_price?: number }) =>
            String(row?.currency || '').toUpperCase() === 'ZAR'
        );
        const price =
          Number(zar?.sell_price) ||
          Number(p.sell_price) ||
          0;
        const meta =
          p.metadata && typeof p.metadata === 'object' && !Array.isArray(p.metadata)
            ? (p.metadata as Record<string, unknown>)
            : null;
        return {
          id: `inv_${p.id}`,
          product_id: Number(p.id),
          kind: 'product' as const,
          group: inventoryGroupOf(p.product_type, p.category, meta),
          name: String(p.name || 'Product'),
          description: p.short_description ? String(p.short_description) : undefined,
          price_zar: price,
          image_url: p.primary_image_url ? String(p.primary_image_url) : null,
          sku: p.sku ? String(p.sku) : null,
        };
      })
      .filter((p) => p.price_zar > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export function findGymInventoryItem(
  items: GymInventoryShopItem[],
  id: string
): GymInventoryShopItem | null {
  const raw = String(id || '').trim();
  if (!raw) return null;
  return (
    items.find(
      (p) => p.id === raw || String(p.product_id) === raw.replace(/^inv_/, '')
    ) || null
  );
}
