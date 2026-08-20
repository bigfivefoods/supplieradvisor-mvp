/**
 * Sellable Core Inventory items for the GymAdvisor member shop.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

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

export function inventoryGroupOf(productType?: string | null): 'goods' | 'service' {
  const t = String(productType || '').toLowerCase();
  return t === 'service' || t === 'services' ? 'service' : 'goods';
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
        'id, name, sku, category, product_type, short_description, status, primary_image_url, sell_price, prices, is_sellable'
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
        return {
          id: `inv_${p.id}`,
          product_id: Number(p.id),
          kind: 'product' as const,
          group: inventoryGroupOf(p.product_type),
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
