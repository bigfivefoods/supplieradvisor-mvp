import {
  productPriceList,
  type ProductPriceRow,
  type ProductRecord,
} from '@/lib/inventory/types';

/**
 * Resolve unit sell (and cost) for a product in a preferred document currency.
 * Falls back to primary catalogue price when that currency is not stored.
 */
export function priceForCurrency(
  product: Pick<
    ProductRecord,
    'prices' | 'base_currency' | 'sell_price' | 'cost_price'
  >,
  preferredCurrency?: string | null
): {
  unit_price: number;
  cost_price: number;
  currency: string;
  matched: boolean;
  available: ProductPriceRow[];
} {
  const available = productPriceList(product);
  const pref = preferredCurrency
    ? String(preferredCurrency).trim().toUpperCase()
    : null;

  if (pref) {
    const hit = available.find((r) => r.currency === pref);
    if (hit) {
      return {
        unit_price: hit.sell_price,
        cost_price: hit.cost_price,
        currency: hit.currency,
        matched: true,
        available,
      };
    }
  }

  const primary = available[0];
  return {
    unit_price: primary.sell_price,
    cost_price: primary.cost_price,
    currency: primary.currency,
    matched: !pref || primary.currency === pref,
    available,
  };
}

/** Label for product pickers: "Widget (SKU) · ZAR 100 · USD 5.50" */
export function productPriceLabel(
  product: Pick<
    ProductRecord,
    'name' | 'sku' | 'prices' | 'base_currency' | 'sell_price' | 'cost_price'
  >,
  preferCurrency?: string | null
): string {
  const rows = productPriceList(product);
  const ordered = preferCurrency
    ? (() => {
        const p = preferCurrency.toUpperCase();
        const hit = rows.find((r) => r.currency === p);
        return hit
          ? [hit, ...rows.filter((r) => r.currency !== p)]
          : rows;
      })()
    : rows;

  const priceBits = ordered
    .slice(0, 3)
    .map((r) => `${r.currency} ${Number(r.sell_price).toFixed(2)}`)
    .join(' · ');

  return `${product.name}${product.sku ? ` (${product.sku})` : ''} · ${priceBits}`;
}
