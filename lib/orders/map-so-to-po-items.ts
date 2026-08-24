/**
 * Map sales_orders.items (CRM shape) → purchase_orders.items (SRM shape).
 * SO lines often use `name`; PO lines require `item_name`.
 * Commercial unit prices from the SO are NOT copied by default (middleman
 * margin). Callers may pass unitPriceOverride or copyPrices=true.
 */

import { normalizePoItems, type PoLineItem } from '@/lib/procurement/types';

export type MapSoToPoOptions = {
  /** When true, copy unit_price from SO lines (rare — usually manufacturer contract price). */
  copyPrices?: boolean;
  /** Flat unit price applied to every line when not copying and no per-line override. */
  defaultUnitPrice?: number;
  /** Optional map product_id → unit_price (contract pricing). */
  priceByProductId?: Record<number, number>;
};

export function mapSoItemsToPoItems(
  soItems: unknown,
  options: MapSoToPoOptions = {}
): { items: PoLineItem[]; total: number } | { error: string } {
  if (!Array.isArray(soItems) || soItems.length === 0) {
    return { error: 'Sales order has no line items' };
  }

  const raw = soItems.map((row) => {
    if (!row || typeof row !== 'object') return null;
    const r = row as Record<string, unknown>;
    const item_name = String(r.item_name || r.name || '').trim();
    if (!item_name) return null;
    const quantity = Number(
      r.quantity != null && String(r.quantity) !== '' ? r.quantity : r.qty
    );
    if (!Number.isFinite(quantity) || quantity <= 0) return null;

    const productId =
      r.product_id != null && Number.isFinite(Number(r.product_id))
        ? Number(r.product_id)
        : null;

    let unit_price = 0;
    if (options.copyPrices) {
      unit_price = Number(r.unit_price) || 0;
    } else if (productId != null && options.priceByProductId?.[productId] != null) {
      unit_price = Number(options.priceByProductId[productId]) || 0;
    } else if (options.defaultUnitPrice != null) {
      unit_price = Number(options.defaultUnitPrice) || 0;
    }

    return {
      product_id: productId,
      item_name,
      quantity,
      unit_price,
      uom: r.uom != null ? String(r.uom) : null,
      primary_image_url:
        r.primary_image_url != null ? String(r.primary_image_url) : null,
    };
  }).filter(Boolean);

  return normalizePoItems(raw);
}
