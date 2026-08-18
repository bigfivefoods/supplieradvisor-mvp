/**
 * DentalAdvisor — appointment materials / consumables allocation.
 * Practice-controlled catalogue from Inventory module (products + categories).
 * Supports stock soft-warnings, service-linked defaults, billable lines, and
 * previously recorded usage reload.
 */

import type { ProductRecord } from '@/lib/inventory/types';
import { productPriceList } from '@/lib/inventory/types';

/** One line of material used on an appointment (persisted on DentalAppointment). */
export type DentalMaterialUsage = {
  /** Product id (number from inventory) or stable string key for demo items */
  product_id: number | string;
  name: string;
  category: string;
  /** Quantity consumed */
  quantity: number;
  /** Unit of measure (syringe, carpule, pack, …) */
  uom?: string | null;
  /** Lot / batch when track_lot */
  lot_number?: string | null;
  /** Whether this line should flow to the invoice */
  billable: boolean;
  /** Sell unit price at time of use (ZAR primary) */
  unit_price: number;
  /** Snapshot of on-hand at allocation time (for audit) */
  qty_on_hand_at_use?: number | null;
  /** Soft stock warning level at allocation */
  stock_warning?: 'ok' | 'low' | 'out' | null;
  /** Quantity already issued from Inventory on this appointment */
  posted_qty?: number;
};

export type StockWarningLevel = 'ok' | 'low' | 'out';

export function stockWarning(
  product: Pick<ProductRecord, 'qty_on_hand' | 'reorder_level'> | null | undefined,
  qtyToUse = 1
): StockWarningLevel {
  if (!product) return 'ok';
  const onHand = Number(product.qty_on_hand ?? 0);
  const reorder = Number(product.reorder_level ?? 0);
  if (onHand <= 0) return 'out';
  if (onHand - qtyToUse < 0) return 'out';
  if (reorder > 0 && onHand - qtyToUse <= reorder) return 'low';
  if (reorder > 0 && onHand <= reorder) return 'low';
  return 'ok';
}

export function stockWarningLabel(level: StockWarningLevel): string {
  switch (level) {
    case 'out':
      return 'Out of stock';
    case 'low':
      return 'Low stock';
    default:
      return '';
  }
}

export function stockWarningClass(level: StockWarningLevel): string {
  switch (level) {
    case 'out':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'low':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    default:
      return 'bg-emerald-50 text-emerald-800 border-emerald-100';
  }
}

/** Primary ZAR (or first) sell price from product. */
export function productSellPrice(p: ProductRecord): number {
  const list = productPriceList(p);
  const zar = list.find((r) => r.currency === 'ZAR');
  if (zar) return Number(zar.sell_price) || 0;
  return Number(list[0]?.sell_price ?? p.sell_price ?? 0) || 0;
}

export function usageFromProduct(
  p: ProductRecord,
  quantity = 1,
  opts?: { billable?: boolean; lot_number?: string | null }
): DentalMaterialUsage {
  const qty = Math.max(0.01, Number(quantity) || 1);
  const warning = stockWarning(p, qty);
  const unit = productSellPrice(p);
  const billable =
    opts?.billable !== undefined
      ? opts.billable
      : Boolean(p.is_sellable !== false && unit > 0);
  return {
    product_id: p.id,
    name: p.name,
    category: p.category || 'General',
    quantity: qty,
    uom: p.uom || 'unit',
    lot_number: opts?.lot_number ?? null,
    billable,
    unit_price: unit,
    qty_on_hand_at_use: Number(p.qty_on_hand ?? 0),
    stock_warning: warning,
  };
}

/** Keyword → category/product name hints for service default materials. */
const SERVICE_DEFAULT_KEYWORDS: Array<{
  match: RegExp;
  categories?: string[];
  nameHints?: string[];
}> = [
  {
    match: /composite|restor|filling|resin|bonding/i,
    categories: ['Restorative'],
    nameHints: ['composite', 'bonding', 'etch'],
  },
  {
    match: /endo|root\s*canal|rct|pulp/i,
    categories: ['Endodontic'],
    nameHints: ['file', 'gutta', 'sealer', 'hypochlorite', 'niti'],
  },
  {
    match: /extract|surg|implant|graft|membrane|suture/i,
    categories: ['Surgical & Implant', 'Surgical'],
    nameHints: ['suture', 'membrane', 'graft', 'blade'],
  },
  {
    match: /hygien|scale|polish|prophy|fluoride|sealant/i,
    categories: ['Preventive'],
    nameHints: ['fluoride', 'sealant', 'prophy'],
  },
  {
    match: /impression|pvs|alginate|tray/i,
    categories: ['Impression'],
    nameHints: ['impression', 'pvs', 'alginate', 'tray'],
  },
  {
    match: /anest|inject|block|lidocaine|articaine/i,
    categories: ['Anesthetics'],
    nameHints: ['lidocaine', 'articaine', 'carpule', 'needle'],
  },
];

/**
 * Resolve suggested default materials for a service name/code.
 * Prefers real products that match category or name keywords.
 */
export function resolveServiceDefaultMaterials(
  products: ProductRecord[],
  serviceName?: string | null,
  serviceCode?: string | null
): DentalMaterialUsage[] {
  if (!products.length) return [];
  const hay = `${serviceName || ''} ${serviceCode || ''}`.trim();
  if (!hay) return [];

  const matched = SERVICE_DEFAULT_KEYWORDS.filter((k) => k.match.test(hay));
  if (!matched.length) return [];

  const out: DentalMaterialUsage[] = [];
  const seen = new Set<number | string>();

  for (const rule of matched) {
    for (const p of products) {
      if (p.status && p.status !== 'active') continue;
      const cat = (p.category || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      const catHit =
        rule.categories?.some((c) => cat.includes(c.toLowerCase())) ?? false;
      const nameHit =
        rule.nameHints?.some((h) => name.includes(h.toLowerCase())) ?? false;
      if (!catHit && !nameHit) continue;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(usageFromProduct(p, 1));
      if (out.length >= 6) return out;
    }
  }
  return out;
}

export function normalizeDentalMaterials(raw: unknown): DentalMaterialUsage[] {
  if (!Array.isArray(raw)) return [];
  const out: DentalMaterialUsage[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const name = String(r.name || '').trim();
    const quantity = Number(r.quantity);
    if (!name || !Number.isFinite(quantity) || quantity <= 0) continue;
    const pidRaw = r.product_id;
    const product_id =
      typeof pidRaw === 'number' && Number.isFinite(pidRaw)
        ? pidRaw
        : String(pidRaw || name);
    const unit = Number(r.unit_price);
    const posted = Number(r.posted_qty);
    const warn = String(r.stock_warning || '');
    out.push({
      product_id,
      name,
      category: String(r.category || 'General'),
      quantity,
      uom: r.uom != null ? String(r.uom) : null,
      lot_number: r.lot_number != null ? String(r.lot_number) : null,
      billable: r.billable !== false,
      unit_price: Number.isFinite(unit) && unit > 0 ? unit : 0,
      qty_on_hand_at_use:
        r.qty_on_hand_at_use != null ? Number(r.qty_on_hand_at_use) : null,
      stock_warning:
        warn === 'low' || warn === 'out' || warn === 'ok' ? warn : null,
      posted_qty: Number.isFinite(posted) && posted > 0 ? posted : 0,
    });
  }
  return out;
}

/** Extra units to issue from stock after a new allocation. */
export function materialsIssueDelta(
  next: DentalMaterialUsage[]
): Array<{ product_id: number; quantity: number; name: string; lot_number?: string | null }> {
  const out: Array<{
    product_id: number;
    quantity: number;
    name: string;
    lot_number?: string | null;
  }> = [];
  for (const line of next) {
    const pid = Number(line.product_id);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    const qty = Math.max(0, Number(line.quantity) || 0);
    const posted = Math.max(0, Number(line.posted_qty) || 0);
    const delta = Math.round((qty - posted) * 1000) / 1000;
    if (delta <= 0) continue;
    out.push({
      product_id: pid,
      quantity: delta,
      name: line.name,
      lot_number: line.lot_number || null,
    });
  }
  return out;
}

export function markMaterialsPosted(
  lines: DentalMaterialUsage[]
): DentalMaterialUsage[] {
  return lines.map((l) => ({ ...l, posted_qty: Number(l.quantity) || 0 }));
}

export function billableTotal(lines: DentalMaterialUsage[]): number {
  return lines.reduce((sum, l) => {
    if (!l.billable) return sum;
    return sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
  }, 0);
}

export function filterCatalogue(
  products: ProductRecord[],
  opts: { q?: string; category?: string | null }
): ProductRecord[] {
  const q = (opts.q || '').trim().toLowerCase();
  const cat = (opts.category || '').trim().toLowerCase();
  return products.filter((p) => {
    if (p.status && String(p.status).toLowerCase() !== 'active') return false;
    if (cat && cat !== 'all') {
      if ((p.category || 'General').toLowerCase() !== cat) return false;
    }
    if (!q) return true;
    const hay = `${p.name || ''} ${p.sku || ''} ${p.category || ''} ${p.barcode || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

export function categoriesFromProducts(products: ProductRecord[]): string[] {
  const set = new Set<string>();
  for (const p of products) {
    const c = (p.category || 'General').trim() || 'General';
    set.add(c);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Compact summary for sidebar / context card */
export function materialsSummary(
  lines: DentalMaterialUsage[] | null | undefined
): {
  count: number;
  billableTotal: number;
  labels: string[];
  hasLowStock: boolean;
  hasOutOfStock: boolean;
} {
  const list = lines || [];
  return {
    count: list.length,
    billableTotal: billableTotal(list),
    labels: list.slice(0, 4).map((l) => {
      const qty = Number(l.quantity) || 1;
      return qty === 1 ? l.name : `${qty}× ${l.name}`;
    }),
    hasLowStock: list.some((l) => l.stock_warning === 'low'),
    hasOutOfStock: list.some((l) => l.stock_warning === 'out'),
  };
}
