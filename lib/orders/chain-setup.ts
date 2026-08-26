/**
 * Standing order-chain routing: which customer + which of your products
 * + which supplier fulfills them.
 */

export type ChainProductTerm = {
  moq: number | null;
  lead_time_days: number | null;
};

export type OrderChainSetup = {
  id: number;
  profile_id: number;
  name: string | null;
  customer_id: number | null;
  customer_name: string | null;
  srm_supplier_id: number | null;
  supplier_name: string | null;
  product_ids: number[];
  product_terms: Record<number, ChainProductTerm>;
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

function positiveQty(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function positiveDays(raw: unknown): number | null {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function parseProductTerms(raw: unknown): Record<number, ChainProductTerm> {
  const out: Record<number, ChainProductTerm> = {};
  if (Array.isArray(raw)) {
    for (const row of raw) {
      const o = asObject(row);
      const id = Number(o.product_id ?? o.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      out[id] = {
        moq: positiveQty(o.moq ?? o.min_order_qty),
        lead_time_days: positiveDays(o.lead_time_days),
      };
    }
    return out;
  }
  for (const [k, v] of Object.entries(asObject(raw))) {
    const id = Number(k);
    if (!Number.isFinite(id) || id <= 0) continue;
    const o = asObject(v);
    out[id] = {
      moq: positiveQty(o.moq ?? o.min_order_qty),
      lead_time_days: positiveDays(o.lead_time_days),
    };
  }
  return out;
}

export function serializeProductTerms(
  terms: Record<number, ChainProductTerm> | null | undefined,
  productIds: number[]
): Record<string, ChainProductTerm> {
  const allowed = new Set(productIds);
  const out: Record<string, ChainProductTerm> = {};
  for (const [k, v] of Object.entries(terms || {})) {
    const id = Number(k);
    if (!allowed.has(id)) continue;
    const moq = positiveQty(v?.moq);
    const lead = positiveDays(v?.lead_time_days);
    if (moq == null && lead == null) continue;
    out[String(id)] = { moq, lead_time_days: lead };
  }
  return out;
}

export function termsForProduct(
  setup: Pick<OrderChainSetup, 'product_terms'> | null | undefined,
  productId: number | null
): ChainProductTerm {
  if (!setup || productId == null) return { moq: null, lead_time_days: null };
  return (
    setup.product_terms?.[productId] || { moq: null, lead_time_days: null }
  );
}

export function termsForCustomerProduct(
  setups: OrderChainSetup[],
  customerId: number | null,
  productId: number | null
): ChainProductTerm {
  return termsForProduct(pickSetupForLine(setups, customerId, productId), productId);
}

export function lineMoqError(
  lines: Array<{
    product_id?: unknown;
    qty?: unknown;
    quantity?: unknown;
    name?: unknown;
  }>,
  setups: OrderChainSetup[],
  customerId: number | null
): string | null {
  for (const line of lines) {
    const id = Number(line.product_id);
    if (!Number.isFinite(id) || id <= 0) continue;
    const qty = Number(line.qty ?? line.quantity);
    const moq = termsForCustomerProduct(setups, customerId, id).moq;
    if (moq == null) continue;
    if (!Number.isFinite(qty) || qty < moq) {
      const label = String(line.name || 'This product');
      return `${label} minimum order is ${moq}. Increase the quantity.`;
    }
  }
  return null;
}

export function maxLeadTimeDays(
  setups: OrderChainSetup[],
  customerId: number | null,
  productIds: Array<number | null | undefined>
): number | null {
  let max: number | null = null;
  for (const raw of productIds) {
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0) continue;
    const days = termsForCustomerProduct(setups, customerId, id).lead_time_days;
    if (days == null) continue;
    max = max == null ? days : Math.max(max, days);
  }
  return max;
}

export function formatChainTermsSummary(
  setup: Pick<OrderChainSetup, 'product_ids' | 'product_terms'>
): string {
  const moqs: number[] = [];
  const leads: number[] = [];
  for (const id of setup.product_ids) {
    const t = termsForProduct(setup, id);
    if (t.moq != null) moqs.push(t.moq);
    if (t.lead_time_days != null) leads.push(t.lead_time_days);
  }
  const parts: string[] = [];
  if (moqs.length) {
    const lo = Math.min(...moqs);
    const hi = Math.max(...moqs);
    parts.push(lo === hi ? `MoQ ${lo}` : `MoQ ${lo}–${hi}`);
  }
  if (leads.length) {
    const hi = Math.max(...leads);
    parts.push(`lead ${hi}d`);
  }
  return parts.join(' · ');
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
    product_terms: parseProductTerms(
      asObject(r.metadata).product_terms ?? r.product_terms
    ),
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

/** Product ids this customer may order on the portal (active chains only). */
export function productIdsOnCustomerChains(
  setups: Array<{
    customer_id: number | null;
    product_ids: unknown;
    status?: string | null;
  }>,
  customerId: number
): Set<number> {
  const out = new Set<number>();
  if (!Number.isFinite(customerId) || customerId <= 0) return out;
  for (const s of setups) {
    if (String(s.status || 'active') !== 'active') continue;
    if (Number(s.customer_id) !== customerId) continue;
    for (const id of parseProductIds(s.product_ids)) out.add(id);
  }
  return out;
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
