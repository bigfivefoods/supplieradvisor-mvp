/**
 * Standing order-chain routing: which customer + which of your products
 * + which supplier fulfills them.
 */

export type OrderChainSetup = {
  id: number;
  profile_id: number;
  name: string | null;
  customer_id: number | null;
  customer_name: string | null;
  srm_supplier_id: number | null;
  supplier_name: string | null;
  product_ids: number[];
  status: string;
  notes: string | null;
};

function asObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function parseProductIds(raw: unknown): number[] {
  const list = Array.isArray(raw) ? raw : [];
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const v of list) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    ids.push(n);
  }
  return ids;
}

export function mapChainSetup(raw: unknown): OrderChainSetup | null {
  const r = asObject(raw);
  const id = Number(r.id);
  const profile_id = Number(r.profile_id);
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(profile_id)) return null;
  const customer_id = Number(r.customer_id);
  const srm_supplier_id = Number(r.srm_supplier_id);
  return {
    id,
    profile_id,
    name: r.name != null ? String(r.name) : null,
    customer_id: Number.isFinite(customer_id) && customer_id > 0 ? customer_id : null,
    customer_name: r.customer_name != null ? String(r.customer_name) : null,
    srm_supplier_id:
      Number.isFinite(srm_supplier_id) && srm_supplier_id > 0
        ? srm_supplier_id
        : null,
    supplier_name: r.supplier_name != null ? String(r.supplier_name) : null,
    product_ids: parseProductIds(r.product_ids),
    status: String(r.status || 'active'),
    notes: r.notes != null ? String(r.notes) : null,
  };
}

/** Higher score wins. Negative = no match. */
export function scoreChainSetup(
  setup: OrderChainSetup,
  customerId: number | null,
  productId: number | null
): number {
  if (String(setup.status || 'active') !== 'active') return -1;
  if (!setup.srm_supplier_id) return -1;
  const products = setup.product_ids;
  const productOk =
    productId == null
      ? products.length === 0
      : products.length === 0 || products.includes(productId);
  if (!productOk) return -1;
  const customerOk =
    setup.customer_id == null ||
    (customerId != null && setup.customer_id === customerId);
  if (!customerOk) return -1;
  let score = 1;
  if (setup.customer_id && setup.customer_id === customerId) score += 10;
  if (productId && products.includes(productId)) score += 5;
  if (products.length === 0) score += 1;
  return score;
}

export function pickSetupForLine(
  setups: OrderChainSetup[],
  customerId: number | null,
  productId: number | null
): OrderChainSetup | null {
  let best: OrderChainSetup | null = null;
  let bestScore = -1;
  for (const s of setups) {
    const score = scoreChainSetup(s, customerId, productId);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return bestScore >= 0 ? best : null;
}

export type FulfillmentGroup = {
  srmSupplierId: number | null;
  supplierName: string | null;
  setupId: number | null;
  items: unknown[];
};

/** Split sales-order lines onto the chain setups that own those products. */
export function groupSoItemsByChain(
  items: unknown,
  setups: OrderChainSetup[],
  customerId: number | null
): FulfillmentGroup[] {
  const list = Array.isArray(items) ? items : [];
  const buckets = new Map<string, FulfillmentGroup>();
  const keyFor = (id: number | null) => (id ? `s:${id}` : 'unassigned');

  for (const raw of list) {
    const row = asObject(raw);
    const productId = Number(row.product_id);
    const pid = Number.isFinite(productId) && productId > 0 ? productId : null;
    const setup = pickSetupForLine(setups, customerId, pid);
    const srmId = setup?.srm_supplier_id || null;
    const key = keyFor(srmId);
    const existing = buckets.get(key);
    if (existing) {
      existing.items.push(raw);
    } else {
      buckets.set(key, {
        srmSupplierId: srmId,
        supplierName: setup?.supplier_name || null,
        setupId: setup?.id || null,
        items: [raw],
      });
    }
  }
  return [...buckets.values()];
}
