import type { StoreChannel, StoreProduct } from '@/lib/storefront/types';

/** Same channel and text filter the store catalogue applies on the server. */
export function filterStoreProducts(
  products: StoreProduct[],
  opts?: { channel?: string | null; q?: string | null }
): StoreProduct[] {
  let next = products;
  if (opts?.channel) {
    const channel = String(opts.channel).toLowerCase();
    next = next.filter(
      (product) =>
        product.channels.includes(channel as StoreChannel) || product.channels.length === 0
    );
  }
  if (opts?.q) {
    const q = opts.q.toLowerCase();
    next = next.filter((product) => {
      const hay = [product.name, product.sku, product.externalRef, product.category, product.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }
  return next;
}

/** Pin a deep-linked product, then a multi-SKU shortlist, without dropping the rest. */
export function pinStoreProducts(
  products: StoreProduct[],
  opts?: { product?: string | null; sku?: string | null; multiKeys?: string[] }
): StoreProduct[] {
  let next = products;
  const deep = String(opts?.product || opts?.sku || '').toLowerCase();
  if (deep) {
    next = [...next].sort((a, b) => {
      const hit = (product: StoreProduct) =>
        String(product.externalRef || '').toLowerCase() === deep ||
        String(product.sku || '').toLowerCase() === deep ||
        String(product.id) === deep
          ? 0
          : 1;
      return hit(a) - hit(b);
    });
  }
  const multi = (opts?.multiKeys || []).map((key) => key.toLowerCase()).filter(Boolean);
  if (multi.length) {
    const rank = new Map(multi.map((key, index) => [key, index] as const));
    next = [...next].sort((a, b) => {
      const score = (product: StoreProduct) =>
        rank.get(String(product.externalRef || '').toLowerCase()) ??
        rank.get(String(product.sku || '').toLowerCase()) ??
        999;
      return score(a) - score(b);
    });
  }
  return next;
}
