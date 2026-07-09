/** Shared quote / order / invoice line-item helpers */

/** Authorization attribute for buyer server-side reads (not an RLS boundary). */
export type DocVisibility = 'seller_only' | 'shared';

export type DocLineItem = {
  product_id?: number | null;
  sku?: string | null;
  name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  uom?: string | null;
  line_total: number;
};

export type DocTotals = {
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
};

export function calcLineTotal(qty: number, unitPrice: number) {
  return Math.round(Math.max(0, qty) * Math.max(0, unitPrice) * 100) / 100;
}

export function calcDocTotals(items: DocLineItem[], taxRate = 15): DocTotals {
  const subtotal = Math.round(
    items.reduce((s, i) => s + Number(i.line_total || calcLineTotal(i.quantity, i.unit_price)), 0) * 100
  ) / 100;
  const tax_amount = Math.round(subtotal * (Number(taxRate) / 100) * 100) / 100;
  const total_amount = Math.round((subtotal + tax_amount) * 100) / 100;
  return { subtotal, tax_rate: Number(taxRate) || 0, tax_amount, total_amount };
}

export function normalizeItems(raw: unknown): DocLineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const row = r as Record<string, unknown>;
      const quantity = Number(row.quantity) || 0;
      const unit_price = Number(row.unit_price) || 0;
      const name = String(row.name || row.product_name || 'Item').trim() || 'Item';
      return {
        product_id: row.product_id != null ? Number(row.product_id) : null,
        sku: row.sku != null ? String(row.sku) : null,
        name,
        description: row.description != null ? String(row.description) : null,
        quantity,
        unit_price,
        uom: row.uom != null ? String(row.uom) : 'unit',
        line_total: calcLineTotal(quantity, unit_price),
      };
    })
    .filter((i) => i.name);
}

export function docNumber(prefix: string) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${y}${m}${day}-${rand}`;
}

export function formatMoney(amount: number | null | undefined, currency = 'ZAR') {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'ZAR',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function statusBadgeClass(status?: string | null) {
  switch ((status || '').toLowerCase()) {
    case 'accepted':
    case 'confirmed':
    case 'fulfilled':
    case 'paid':
    case 'active':
    case 'resolved':
    case 'closed':
    case 'approved':
      return 'bg-emerald-100 text-emerald-800';
    case 'sent':
    case 'processing':
    case 'shipped':
    case 'investigating':
    case 'in_progress':
      return 'bg-sky-100 text-sky-800';
    case 'rejected':
    case 'cancelled':
    case 'void':
    case 'terminated':
    case 'expired':
      return 'bg-red-100 text-red-800';
    case 'overdue':
    case 'partial':
    case 'open':
      return 'bg-amber-100 text-amber-900';
    default:
      return 'bg-neutral-100 text-neutral-700';
  }
}

/** Points per currency unit spent (loyalty earn rate) */
export const LOYALTY_EARN_RATE = 1; // 1 point per 1 currency unit
export const LOYALTY_TIERS = [
  { value: 'bronze', min: 0, label: 'Bronze' },
  { value: 'silver', min: 1000, label: 'Silver' },
  { value: 'gold', min: 5000, label: 'Gold' },
  { value: 'platinum', min: 15000, label: 'Platinum' },
] as const;

export function tierFromLifetime(points: number) {
  let tier: (typeof LOYALTY_TIERS)[number]['value'] = 'bronze';
  for (const t of LOYALTY_TIERS) {
    if (points >= t.min) tier = t.value;
  }
  return tier;
}
