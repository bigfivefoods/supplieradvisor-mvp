/** Field mapping helpers (contract v1.0, sections 3 and 4). Pure functions. */
import { DUNNING_PAUSED_MARKER } from './config';
import { centsToRands } from './money';
import type { Address, OrderLine, Transport } from './validate';
import type { Row } from './ports';

const TERMS_LABELS: Record<string, string> = {
  cod: 'COD (Cash on delivery)',
  days_7: 'Net 7',
  days_14: 'Net 14',
  days_30: 'Net 30',
  eom_30: 'EOM + 30',
};

export function paymentTermsLabel(label: string, code: string): string {
  if (label.trim()) return label.trim();
  return TERMS_LABELS[code.trim()] || '';
}

export function addressText(a: Address): string {
  if (a.formatted.trim()) return a.formatted.trim();
  return [a.line1, a.line2, a.city, a.province, a.postal_code, a.country]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ');
}

export function digitsOnly(v: string): string {
  return v.replace(/\D+/g, '');
}

export function normaliseRegistration(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const INTERNAL_DOMAINS = ['bigfivefoods.com'];

export function isInternalEmail(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return INTERNAL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** Append the dunning marker after any other note text, once. */
export function notesWithMarker(notes: string): string {
  const base = notes.trim();
  if (base.includes(DUNNING_PAUSED_MARKER)) return base;
  return base ? `${base}\n${DUNNING_PAUSED_MARKER}` : DUNNING_PAUSED_MARKER;
}

/** Today in SAST (UTC+2) as YYYY-MM-DD. */
export function sastDate(nowMs: number): string {
  return new Date(nowMs + 2 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Invoice / sales-order lines. The charged price is used as sent: unit_price
 * and line_total are the shop's ex-VAT amounts, never SupplierAdvisor® list prices.
 */
export function buildItems(
  lines: OrderLine[],
  transport: Transport,
  productIds: Record<string, number>
): Row[] {
  const items: Row[] = lines.map((l) => ({
    product_id: productIds[l.shop_product_id],
    sku: l.shop_product_id,
    name: l.name,
    description: l.description || (l.pack ? `${l.name}, ${l.pack}` : l.name),
    quantity: l.quantity,
    unit_price: centsToRands(l.unit_ex_vat_cents),
    uom: 'unit',
    line_total: centsToRands(l.line_ex_vat_cents),
    currency: 'ZAR',
    vat_rate: 15,
  }));
  if (transport.status === 'charged' && transport.ex_vat_cents > 0) {
    items.push({
      product_id: null,
      sku: null,
      name: transport.label || 'Transport',
      description: transport.label || 'Transport',
      quantity: 1,
      unit_price: centsToRands(transport.ex_vat_cents),
      uom: 'unit',
      line_total: centsToRands(transport.ex_vat_cents),
      currency: 'ZAR',
      vat_rate: 15,
    });
  }
  return items;
}

export function asMeta(raw: unknown): Row {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Row) };
  }
  return {};
}

/** True when `incoming` is not newer than `stored` (ISO timestamps, ms precision). */
export function isStaleVersion(stored: unknown, incoming: string): boolean {
  if (typeof stored !== 'string' || !stored) return false;
  const a = Date.parse(stored);
  const b = Date.parse(incoming);
  if (Number.isNaN(a) || Number.isNaN(b)) return incoming < stored;
  return b < a;
}
