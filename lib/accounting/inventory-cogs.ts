/**
 * IAS 2 (simplified): when an AR sales invoice sells goods that already sit
 * on 1140 at a known unit cost, post Dr 5100 · Cr 1140.
 *
 * Cost is resolved from real fields only (line unit_cost, products.cost_price,
 * last stock_movements.unit_cost). Selling price is never used as cost.
 * Unknown / zero cost → skip and stamp. Services and membership → no COGS.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  postBalancedJournal,
  resolveCoaAccountIdByCode,
  type JournalLineInput,
} from '@/lib/accounting/post-journal';
import { round2 } from '@/lib/accounting/server';
import { priceForCurrency } from '@/lib/inventory/priceForCurrency';
import { arRevenueCodeForInvoice } from '@/lib/accounting/contract-liability';

export const INVENTORY_CODE = '1140';
export const COGS_CODE = '5100';
export const COGS_SOURCE = 'invoice_cogs';

const GOODS_TYPES = new Set([
  'finished_good',
  'raw_material',
  'consumable',
  'kit',
  'goods',
  'product',
  'inventory',
  'stock',
]);

const SERVICE_TYPES = new Set([
  'service',
  'membership',
  'care',
  'session',
  'labour',
  'labor',
  'fee',
]);

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

export type CogsLineInput = {
  product_id?: number | null;
  sku?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  unit_cost?: number | null;
  cost_price?: number | null;
  account_code?: string | null;
  product_type?: string | null;
};

export type ProductCostLookup = {
  productId: number;
  sku: string | null;
  costPrice: number;
  productType: string | null;
};

export type CogsSkipReason =
  | 'not_goods'
  | 'no_qty'
  | 'no_product'
  | 'no_cost'
  | 'no_coa'
  | 'already_posted'
  | 'not_ar';

export type CogsLinePlan = {
  productId: number | null;
  sku: string | null;
  quantity: number;
  unitCost: number;
  amount: number;
  skip: CogsSkipReason | null;
};

export function isMembershipOrServiceInvoice(inv: Record<string, unknown>): boolean {
  if (arRevenueCodeForInvoice(inv) === '4400') return true;
  const meta = asMeta(inv.metadata);
  const kind = String(meta.kind || meta.invoice_kind || '').toLowerCase();
  if (['service', 'membership', 'care', 'advisor'].includes(kind)) return true;
  return false;
}

export function isGoodsProductType(type?: string | null): boolean {
  const t = String(type || '').toLowerCase().trim();
  if (!t) return true;
  if (SERVICE_TYPES.has(t)) return false;
  if (GOODS_TYPES.has(t)) return true;
  return !SERVICE_TYPES.has(t);
}

export function lineQuantity(line: CogsLineInput): number {
  const q = Number(line.quantity);
  if (!Number.isFinite(q) || q <= 0) return 0;
  return q;
}

/** Explicit cost on the line — never unit_price / sell price. */
export function explicitLineCost(line: CogsLineInput): number | null {
  for (const raw of [line.unit_cost, line.cost_price]) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0.00005) return n;
  }
  return null;
}

export function lookupCostForLine(
  line: CogsLineInput,
  byId: Map<number, ProductCostLookup>,
  bySku: Map<string, ProductCostLookup>
): ProductCostLookup | null {
  const pid = Number(line.product_id || 0);
  if (pid > 0 && byId.has(pid)) return byId.get(pid) || null;
  const sku = String(line.sku || '').trim().toLowerCase();
  if (sku && bySku.has(sku)) return bySku.get(sku) || null;
  return null;
}

export function planCogsLine(
  line: CogsLineInput,
  lookup: ProductCostLookup | null
): CogsLinePlan {
  const qty = lineQuantity(line);
  const sku = line.sku != null ? String(line.sku) : null;
  const productId = Number(line.product_id || lookup?.productId || 0) || null;
  const code = String(line.account_code || '').trim();
  if (code === '4400' || code === '4200' || code.startsWith('4400')) {
    return {
      productId,
      sku,
      quantity: qty,
      unitCost: 0,
      amount: 0,
      skip: 'not_goods',
    };
  }
  const type = line.product_type || lookup?.productType || null;
  if (!isGoodsProductType(type)) {
    return {
      productId,
      sku,
      quantity: qty,
      unitCost: 0,
      amount: 0,
      skip: 'not_goods',
    };
  }
  if (qty <= 0) {
    return {
      productId,
      sku,
      quantity: 0,
      unitCost: 0,
      amount: 0,
      skip: 'no_qty',
    };
  }
  const explicit = explicitLineCost(line);
  const fromProduct = lookup && lookup.costPrice > 0.00005 ? lookup.costPrice : null;
  const unitCost = explicit ?? fromProduct;
  if (unitCost == null) {
    const hasRef = Boolean(productId || (sku && sku.trim()));
    return {
      productId,
      sku,
      quantity: qty,
      unitCost: 0,
      amount: 0,
      skip: hasRef ? 'no_cost' : 'no_product',
    };
  }
  return {
    productId,
    sku,
    quantity: qty,
    unitCost,
    amount: round2(qty * unitCost),
    skip: null,
  };
}

export function sumCogsAmount(plans: CogsLinePlan[]): number {
  return round2(plans.reduce((s, p) => s + (p.skip ? 0 : p.amount), 0));
}

export function cogsJournalLines(opts: {
  cogsAccountId: number;
  inventoryAccountId: number;
  amount: number;
  memo?: string;
}): JournalLineInput[] {
  const amount = round2(Math.abs(Number(opts.amount) || 0));
  const memo = opts.memo || 'Cost of sales';
  return [
    { accountId: opts.cogsAccountId, debit: amount, credit: 0, memo },
    { accountId: opts.inventoryAccountId, debit: 0, credit: amount, memo },
  ];
}

export function alreadyPostedCogs(meta: unknown): boolean {
  return Number(asMeta(meta).cogs_journal_id || 0) > 0;
}

export function parseInvoiceCogsLines(items: unknown): CogsLineInput[] {
  if (!Array.isArray(items)) return [];
  const out: CogsLineInput[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    out.push({
      product_id: row.product_id != null ? Number(row.product_id) : null,
      sku: row.sku != null ? String(row.sku) : null,
      quantity: row.quantity != null ? Number(row.quantity) : null,
      unit_price: row.unit_price != null ? Number(row.unit_price) : null,
      unit_cost: row.unit_cost != null ? Number(row.unit_cost) : null,
      cost_price: row.cost_price != null ? Number(row.cost_price) : null,
      account_code:
        row.account_code != null
          ? String(row.account_code)
          : row.gl_code != null
            ? String(row.gl_code)
            : null,
      product_type: row.product_type != null ? String(row.product_type) : null,
    });
  }
  return out;
}

function skipStamp(plans: CogsLinePlan[], fallback: CogsSkipReason): {
  cogs_skipped: CogsSkipReason;
  cogs_lines: Array<{
    product_id: number | null;
    sku: string | null;
    skip: CogsSkipReason | null;
    amount: number;
  }>;
} {
  const reasons = plans.map((p) => p.skip).filter(Boolean) as CogsSkipReason[];
  const unique = [...new Set(reasons)];
  return {
    cogs_skipped: unique.length === 1 ? unique[0] : fallback,
    cogs_lines: plans.map((p) => ({
      product_id: p.productId,
      sku: p.sku,
      skip: p.skip,
      amount: p.amount,
    })),
  };
}

async function loadProductCosts(opts: {
  profileId: number;
  currency?: string | null;
  productIds: number[];
  skus: string[];
}): Promise<{ byId: Map<number, ProductCostLookup>; bySku: Map<string, ProductCostLookup> }> {
  const byId = new Map<number, ProductCostLookup>();
  const bySku = new Map<string, ProductCostLookup>();
  const supabase = getSupabaseServer();
  const rows: Array<Record<string, unknown>> = [];

  if (opts.productIds.length) {
    const { data } = await supabase
      .from('products')
      .select('id, sku, cost_price, sell_price, prices, base_currency, product_type')
      .eq('profile_id', opts.profileId)
      .in('id', opts.productIds.slice(0, 80));
    for (const r of data || []) rows.push(r as Record<string, unknown>);
  }
  const knownSkus = new Set(
    rows
      .map((r) => String(r.sku || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const missingSkus = opts.skus.filter(
    (s) => s && !knownSkus.has(s.trim().toLowerCase())
  );
  if (missingSkus.length) {
    const { data } = await supabase
      .from('products')
      .select('id, sku, cost_price, sell_price, prices, base_currency, product_type')
      .eq('profile_id', opts.profileId)
      .in('sku', missingSkus.slice(0, 80));
    for (const r of data || []) rows.push(r as Record<string, unknown>);
  }

  const ids = [...new Set(rows.map((r) => Number(r.id)).filter((n) => n > 0))];
  const moveCost = new Map<number, number>();
  if (ids.length) {
    const { data: moves } = await supabase
      .from('stock_movements')
      .select('id, product_id, unit_cost')
      .eq('profile_id', opts.profileId)
      .in('product_id', ids)
      .gt('unit_cost', 0)
      .order('id', { ascending: false })
      .limit(200);
    for (const m of moves || []) {
      const pid = Number(m.product_id || 0);
      const cost = Number(m.unit_cost || 0);
      if (pid > 0 && cost > 0 && !moveCost.has(pid)) moveCost.set(pid, cost);
    }
  }

  for (const r of rows) {
    const id = Number(r.id || 0);
    if (!(id > 0)) continue;
    const priced = priceForCurrency(
      {
        prices: Array.isArray(r.prices) ? (r.prices as never) : null,
        base_currency: r.base_currency != null ? String(r.base_currency) : null,
        sell_price: r.sell_price != null ? Number(r.sell_price) : null,
        cost_price: r.cost_price != null ? Number(r.cost_price) : null,
      },
      opts.currency
    );
    const catalogue = Number(priced.cost_price || 0);
    const fromMove = moveCost.get(id) || 0;
    const costPrice = catalogue > 0.00005 ? catalogue : fromMove;
    const sku = r.sku != null ? String(r.sku) : null;
    const rec: ProductCostLookup = {
      productId: id,
      sku,
      costPrice,
      productType: r.product_type != null ? String(r.product_type) : null,
    };
    byId.set(id, rec);
    if (sku) bySku.set(sku.trim().toLowerCase(), rec);
  }
  return { byId, bySku };
}

export async function postCogsOnInvoice(opts: {
  profileId: number;
  invoice: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<{
  ok: boolean;
  journalId?: number;
  skipped?: boolean;
  applied?: number;
  error?: string;
}> {
  const inv = opts.invoice;
  if (String(inv.direction || '') === 'payable') {
    return { ok: true, skipped: true, applied: 0 };
  }
  const meta = asMeta(inv.metadata);
  if (alreadyPostedCogs(meta)) {
    return {
      ok: true,
      skipped: true,
      journalId: Number(meta.cogs_journal_id),
      applied: round2(Number(meta.cogs_amount || 0)),
    };
  }
  if (isMembershipOrServiceInvoice(inv)) {
    const stamp = {
      ...meta,
      cogs_skipped: 'not_goods' as CogsSkipReason,
      cogs_amount: 0,
    };
    await stampCogsMeta(opts.profileId, Number(inv.id), stamp);
    inv.metadata = stamp;
    return { ok: true, skipped: true, applied: 0 };
  }

  const lines = parseInvoiceCogsLines(inv.items);
  if (!lines.length) {
    const stamp = {
      ...meta,
      cogs_skipped: 'no_product' as CogsSkipReason,
      cogs_amount: 0,
    };
    await stampCogsMeta(opts.profileId, Number(inv.id), stamp);
    inv.metadata = stamp;
    return { ok: true, skipped: true, applied: 0 };
  }

  const productIds = [
    ...new Set(lines.map((l) => Number(l.product_id || 0)).filter((n) => n > 0)),
  ];
  const skus = [
    ...new Set(
      lines
        .map((l) => String(l.sku || '').trim())
        .filter(Boolean)
    ),
  ];
  const { byId, bySku } = await loadProductCosts({
    profileId: opts.profileId,
    currency: inv.currency != null ? String(inv.currency) : null,
    productIds,
    skus,
  });

  const plans = lines.map((line) =>
    planCogsLine(line, lookupCostForLine(line, byId, bySku))
  );
  const amount = sumCogsAmount(plans);
  if (amount < 0.005) {
    const extra = skipStamp(plans, 'no_cost');
    const stamp = { ...meta, ...extra, cogs_amount: 0 };
    await stampCogsMeta(opts.profileId, Number(inv.id), stamp);
    inv.metadata = stamp;
    return { ok: true, skipped: true, applied: 0 };
  }

  const cogsId = await resolveCoaAccountIdByCode(opts.profileId, COGS_CODE);
  const invIdGl = await resolveCoaAccountIdByCode(opts.profileId, INVENTORY_CODE);
  if (!cogsId || !invIdGl) {
    const stamp = {
      ...meta,
      cogs_skipped: 'no_coa' as CogsSkipReason,
      cogs_amount: 0,
    };
    await stampCogsMeta(opts.profileId, Number(inv.id), stamp);
    inv.metadata = stamp;
    return { ok: true, skipped: true, applied: 0 };
  }

  const memo = `COGS ${inv.invoice_number || inv.id}`.slice(0, 500);
  const entryDate = String(inv.issue_date || new Date().toISOString()).slice(0, 10);
  const posted = await postBalancedJournal({
    profileId: opts.profileId,
    entryDate,
    memo,
    source: COGS_SOURCE,
    sourceId: String(inv.id),
    currency: String(inv.currency || 'ZAR'),
    createdBy: opts.createdBy || null,
    metadata: {
      ias2: true,
      invoice_id: inv.id,
      invoice_number: inv.invoice_number || null,
      cogs_amount: amount,
    },
    lines: cogsJournalLines({
      cogsAccountId: cogsId,
      inventoryAccountId: invIdGl,
      amount,
      memo,
    }),
  });
  if (!posted.ok) return { ok: false, error: posted.error };

  const stamp = {
    ...meta,
    cogs_journal_id: posted.journalId,
    cogs_amount: amount,
    cogs_posted_at: new Date().toISOString(),
    cogs_skipped: null,
    cogs_lines: plans.map((p) => ({
      product_id: p.productId,
      sku: p.sku,
      skip: p.skip,
      amount: p.amount,
      unit_cost: p.unitCost,
      quantity: p.quantity,
    })),
  };
  await stampCogsMeta(opts.profileId, Number(inv.id), stamp);
  inv.metadata = stamp;
  return { ok: true, journalId: posted.journalId, applied: amount };
}

async function stampCogsMeta(
  profileId: number,
  invoiceId: number,
  metadata: Record<string, unknown>
) {
  if (!(invoiceId > 0)) return;
  const supabase = getSupabaseServer();
  await supabase
    .from('invoices')
    .update({
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .eq('profile_id', profileId);
}
