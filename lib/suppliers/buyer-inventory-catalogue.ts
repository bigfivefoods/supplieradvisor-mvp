/**
 * Buyer-owned inventory as PO lines when the supplier is book-only
 * (invite not accepted) or has no published catalogue yet.
 *
 * Lines store the buyer's product id so GRN can receive into own stock.
 * Unit price prefers cost (what we expect to pay), then sell as fallback.
 */
import { priceForCurrency } from '@/lib/inventory/priceForCurrency';
import type { ProductRecord } from '@/lib/inventory/types';

export const BUYER_INVENTORY_PRODUCT_COLUMNS =
  'id, name, sku, product_type, uom, status, is_purchasable, is_sellable, sell_price, cost_price, base_currency, prices, primary_image_url, short_description, public_id, onchain_hash, onchain_status, onchain_tx_hash, onchain_chain';

export type PoCatalogueSource = 'agreement' | 'inventory' | 'buyer_inventory';

export type PoCatalogueItem = {
  key: string;
  source: PoCatalogueSource;
  seller_product_id: number | null;
  product_name: string;
  sku: string | null;
  product_type: string | null;
  uom: string | null;
  unit_price: number;
  currency: string;
  agreement_id?: number | null;
  agreement_line_id?: number | null;
  agreement_title?: string | null;
  primary_image_url?: string | null;
  short_description?: string | null;
  public_id?: string | null;
  onchain_hash?: string | null;
  onchain_status?: string | null;
  onchain_tx_hash?: string | null;
  onchain_chain?: string | null;
};

export type BuyerInventoryProductRow = Pick<
  ProductRecord,
  | 'id'
  | 'name'
  | 'sku'
  | 'product_type'
  | 'uom'
  | 'status'
  | 'is_purchasable'
  | 'is_sellable'
  | 'sell_price'
  | 'cost_price'
  | 'base_currency'
  | 'prices'
  | 'primary_image_url'
  | 'short_description'
  | 'public_id'
  | 'onchain_hash'
  | 'onchain_status'
  | 'onchain_tx_hash'
  | 'onchain_chain'
>;

const SKIP_TYPES = new Set(['wip', 'work_in_progress']);
const SKIP_STATUS = new Set(['archived', 'inactive', 'deleted']);

export function buyerProductEligibleForPo(
  product: BuyerInventoryProductRow
): boolean {
  const st = String(product.status || 'active').toLowerCase();
  if (SKIP_STATUS.has(st)) return false;
  if (product.is_purchasable === false) return false;
  const type = String(product.product_type || 'finished_good').toLowerCase();
  if (SKIP_TYPES.has(type)) return false;
  const name = String(product.name || '').trim();
  return name.length > 0;
}

export function mapBuyerProductToPoCatalogueItem(
  product: BuyerInventoryProductRow,
  currencyPref: string
): PoCatalogueItem | null {
  if (!buyerProductEligibleForPo(product)) return null;
  const id = Number(product.id);
  if (!Number.isFinite(id) || id <= 0) return null;

  const priced = priceForCurrency(product, currencyPref);
  const cost = Number(priced.cost_price) || 0;
  const sell = Number(priced.unit_price) || 0;
  const unit = cost > 0 ? cost : sell;
  const type = String(product.product_type || 'finished_good').toLowerCase();

  return {
    key: `buyer_inventory:${id}`,
    source: 'buyer_inventory',
    // Own SKU id on the PO line so receiving posts into this company's inventory.
    seller_product_id: id,
    product_name: String(product.name).trim(),
    sku: product.sku ? String(product.sku) : null,
    product_type: type,
    uom: product.uom ? String(product.uom) : 'ea',
    unit_price: unit,
    currency: String(priced.currency || currencyPref || 'ZAR').toUpperCase(),
    agreement_id: null,
    agreement_line_id: null,
    agreement_title: null,
    primary_image_url: product.primary_image_url || null,
    short_description: product.short_description || null,
    public_id: product.public_id ? String(product.public_id) : null,
    onchain_hash: product.onchain_hash ? String(product.onchain_hash) : null,
    onchain_status: product.onchain_status
      ? String(product.onchain_status)
      : null,
    onchain_tx_hash: product.onchain_tx_hash
      ? String(product.onchain_tx_hash)
      : null,
    onchain_chain: product.onchain_chain ? String(product.onchain_chain) : null,
  };
}

export function mapBuyerProductsToPoCatalogue(
  products: BuyerInventoryProductRow[],
  currencyPref: string,
  opts?: { excludeProductIds?: Iterable<number> }
): PoCatalogueItem[] {
  const skip = new Set<number>();
  if (opts?.excludeProductIds) {
    for (const id of opts.excludeProductIds) {
      const n = Number(id);
      if (Number.isFinite(n) && n > 0) skip.add(n);
    }
  }
  const items: PoCatalogueItem[] = [];
  for (const raw of products) {
    const id = Number(raw.id);
    if (skip.has(id)) continue;
    const item = mapBuyerProductToPoCatalogueItem(raw, currencyPref);
    if (item) items.push(item);
  }
  items.sort((a, b) => {
    const ta = a.product_type || '';
    const tb = b.product_type || '';
    if (ta !== tb) return ta.localeCompare(tb);
    return a.product_name.localeCompare(b.product_name);
  });
  return items;
}

export function poCatalogueSourceRank(source: PoCatalogueSource | string): number {
  if (source === 'agreement') return 0;
  if (source === 'inventory') return 1;
  return 2;
}
