/**
 * Delivery notes derived from a customer invoice.
 * Stored on customer_invoices.metadata.delivery_notes — no prices, VAT, or bank details.
 */
import { normalizeItems } from '@/lib/customers/documents';
import { toWhatsAppE164Digits } from '@/lib/invites/whatsapp';

export const DELIVERY_NOTES_META_KEY = 'delivery_notes';
export const MAX_DELIVERY_NOTES = 20;

export type DeliveryNoteLine = {
  key: string;
  name: string;
  sku: string | null;
  uom: string | null;
  invoiced_qty: number;
  delivered_qty: number;
};

export type DeliveryNoteRecord = {
  id: string;
  number: string;
  nonce: string;
  invoice_id: number;
  invoice_number: string;
  created_at: string;
  delivery_date: string;
  delivered_by: string | null;
  vehicle_reg: string | null;
  notes: string | null;
  delivery_address: string | null;
  customer_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  seller_name: string | null;
  lines: DeliveryNoteLine[];
  received_by_name: string | null;
  received_by_date: string | null;
  revoked_at: string | null;
};

export type PublicDeliveryNoteLine = {
  name: string;
  sku: string | null;
  uom: string | null;
  invoicedQty: number;
  deliveredQty: number;
};

/** Public read model. Keys are an allow-list — never prices, VAT, or bank details. */
export type PublicDeliveryNote = {
  number: string;
  invoiceNumber: string;
  deliveryDate: string;
  customerName: string;
  contactName: string | null;
  contactPhone: string | null;
  deliveryAddress: string | null;
  deliveredBy: string | null;
  vehicleReg: string | null;
  notes: string | null;
  sellerName: string;
  sellerAddress: string | null;
  sellerPhone: string | null;
  sellerEmail: string | null;
  logoUrl: string | null;
  lines: PublicDeliveryNoteLine[];
  receivedByName: string | null;
  receivedByDate: string | null;
  partial: boolean;
};

export type SellerDeliveryNote = PublicDeliveryNote & {
  id: string;
  revoked: boolean;
  createdAt: string;
  shareUrl: string;
  pdfUrl: string;
};

export type DraftDeliveryLine = {
  key: string;
  name: string;
  sku: string | null;
  uom: string | null;
  invoicedQty: number;
  alreadyDelivered: number;
  remainingQty: number;
  deliveredQty: number;
};

const PUBLIC_KEYS: Array<keyof PublicDeliveryNote> = [
  'number',
  'invoiceNumber',
  'deliveryDate',
  'customerName',
  'contactName',
  'contactPhone',
  'deliveryAddress',
  'deliveredBy',
  'vehicleReg',
  'notes',
  'sellerName',
  'sellerAddress',
  'sellerPhone',
  'sellerEmail',
  'logoUrl',
  'lines',
  'receivedByName',
  'receivedByDate',
  'partial',
];

const LINE_KEYS: Array<keyof PublicDeliveryNoteLine> = [
  'name',
  'sku',
  'uom',
  'invoicedQty',
  'deliveredQty',
];

export function roundQty(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 1000) / 1000;
}

export function formatQty(n: number): string {
  const x = roundQty(n);
  if (Number.isInteger(x)) return String(x);
  return String(x);
}

export function lineKey(index: number, sku: string | null | undefined, name: string): string {
  const s = String(sku || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  const n = String(name || 'item')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return `${index}:${s}:${n}`;
}

function clip(value: unknown, max: number): string | null {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  return s.slice(0, max);
}

function clipMultiline(value: unknown, max: number): string | null {
  const s = String(value ?? '').replace(/\r\n/g, '\n').trim();
  if (!s) return null;
  return s.slice(0, max);
}

export function asMetadataObject(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>) };
  }
  if (typeof metadata === 'string' && metadata.trim()) {
    try {
      const parsed = JSON.parse(metadata) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      return {};
    }
  }
  return {};
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function parseDeliveryNoteRecord(raw: unknown): DeliveryNoteRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id || '').trim();
  const number = String(row.number || '').trim();
  const nonce = String(row.nonce || '').trim();
  if (!id || !number || !nonce) return null;
  const linesRaw = Array.isArray(row.lines) ? row.lines : [];
  const lines: DeliveryNoteLine[] = [];
  for (const item of linesRaw) {
    if (!item || typeof item !== 'object') continue;
    const line = item as Record<string, unknown>;
    const name = clip(line.name, 180);
    if (!name) continue;
    lines.push({
      key: String(line.key || lineKey(lines.length, line.sku as string, name)).slice(0, 120),
      name,
      sku: clip(line.sku, 60),
      uom: clip(line.uom, 24) || 'unit',
      invoiced_qty: roundQty(num(line.invoiced_qty ?? line.invoicedQty)),
      delivered_qty: roundQty(num(line.delivered_qty ?? line.deliveredQty)),
    });
  }
  return {
    id: id.slice(0, 80),
    number: number.slice(0, 80),
    nonce: nonce.slice(0, 80),
    invoice_id: Math.floor(num(row.invoice_id ?? row.invoiceId)),
    invoice_number: String(row.invoice_number || row.invoiceNumber || '').slice(0, 80),
    created_at: String(row.created_at || row.createdAt || ''),
    delivery_date: String(row.delivery_date || row.deliveryDate || '').slice(0, 10),
    delivered_by: clip(row.delivered_by ?? row.deliveredBy, 120),
    vehicle_reg: clip(row.vehicle_reg ?? row.vehicleReg, 40),
    notes: clipMultiline(row.notes, 2000),
    delivery_address: clipMultiline(row.delivery_address ?? row.deliveryAddress, 500),
    customer_name: clip(row.customer_name ?? row.customerName, 180),
    contact_name: clip(row.contact_name ?? row.contactName, 160),
    contact_phone: clip(row.contact_phone ?? row.contactPhone, 40),
    seller_name: clip(row.seller_name ?? row.sellerName, 180),
    lines,
    received_by_name: clip(row.received_by_name ?? row.receivedByName, 160),
    received_by_date: String(row.received_by_date || row.receivedByDate || '').slice(0, 10) || null,
    revoked_at: row.revoked_at ? String(row.revoked_at) : null,
  };
}

export function readDeliveryNotes(metadata: unknown): DeliveryNoteRecord[] {
  const meta = asMetadataObject(metadata);
  const raw = meta[DELIVERY_NOTES_META_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .map(parseDeliveryNoteRecord)
    .filter((n): n is DeliveryNoteRecord => Boolean(n));
}

/** Merge notes into metadata and keep every other key (finance stamps, trade thread, …). */
export function writeDeliveryNotes(
  metadata: unknown,
  notes: DeliveryNoteRecord[]
): Record<string, unknown> {
  const meta = asMetadataObject(metadata);
  meta[DELIVERY_NOTES_META_KEY] = notes.slice(0, MAX_DELIVERY_NOTES);
  return meta;
}

export function deliveryNoteNumber(
  invoiceNumber: string,
  existing: Array<{ number: string }>
): string {
  const raw = String(invoiceNumber || '').trim() || 'INVOICE';
  const base = `DN-${raw}`.slice(0, 72);
  const used = new Set(existing.map((n) => n.number));
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`.slice(0, 80);
}

export function invoiceLinesForDelivery(items: unknown): Array<{
  key: string;
  name: string;
  sku: string | null;
  uom: string | null;
  invoicedQty: number;
}> {
  return normalizeItems(items).map((item, index) => ({
    key: lineKey(index, item.sku, item.name),
    name: item.name,
    sku: item.sku ? String(item.sku) : null,
    uom: item.uom ? String(item.uom) : 'unit',
    invoicedQty: roundQty(item.quantity),
  }));
}

export function qtyAlreadyDelivered(
  notes: DeliveryNoteRecord[],
  key: string,
  exceptNoteId?: string
): number {
  let used = 0;
  for (const note of notes) {
    if (note.revoked_at) continue;
    if (exceptNoteId && note.id === exceptNoteId) continue;
    const line = note.lines.find((l) => l.key === key);
    if (line) used += line.delivered_qty;
  }
  return roundQty(used);
}

export function draftDeliveryLines(
  items: unknown,
  notes: DeliveryNoteRecord[]
): DraftDeliveryLine[] {
  return invoiceLinesForDelivery(items).map((line) => {
    const alreadyDelivered = qtyAlreadyDelivered(notes, line.key);
    const remainingQty = roundQty(Math.max(0, line.invoicedQty - alreadyDelivered));
    return {
      ...line,
      alreadyDelivered,
      remainingQty,
      deliveredQty: remainingQty,
    };
  });
}

export type DeliveryNoteInput = {
  deliveryDate?: string | null;
  deliveredBy?: string | null;
  vehicleReg?: string | null;
  notes?: string | null;
  deliveryAddress?: string | null;
  receivedByName?: string | null;
  receivedByDate?: string | null;
  lines?: Array<{ key?: string; deliveredQty?: number | null }>;
};

function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function randomToken(bytes = 9): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function buildDeliveryNoteRecord(opts: {
  invoiceId: number;
  invoiceNumber: string;
  customerName?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  sellerName?: string | null;
  items: unknown;
  existing: DeliveryNoteRecord[];
  input: DeliveryNoteInput;
  now?: Date;
  id?: string;
  nonce?: string;
}): { ok: true; note: DeliveryNoteRecord } | { ok: false; error: string } {
  const drafts = draftDeliveryLines(opts.items, opts.existing);
  if (!drafts.length) {
    return { ok: false, error: 'This invoice has no line items to deliver.' };
  }
  const requested = new Map<string, number>();
  for (const line of opts.input.lines || []) {
    const key = String(line.key || '').trim();
    if (!key) continue;
    requested.set(key, roundQty(num(line.deliveredQty)));
  }
  const lines: DeliveryNoteLine[] = [];
  for (const draft of drafts) {
    const delivered = requested.has(draft.key)
      ? requested.get(draft.key)!
      : draft.remainingQty;
    if (delivered - draft.remainingQty > 0.0001) {
      return {
        ok: false,
        error: `Delivered quantity for ${draft.name} is higher than the remaining ${formatQty(draft.remainingQty)}.`,
      };
    }
    if (delivered <= 0) continue;
    lines.push({
      key: draft.key,
      name: draft.name,
      sku: draft.sku,
      uom: draft.uom,
      invoiced_qty: draft.invoicedQty,
      delivered_qty: delivered,
    });
  }
  if (!lines.length) {
    const fully = drafts.every((d) => d.remainingQty <= 0);
    return {
      ok: false,
      error: fully
        ? 'This invoice is fully delivered. Revoke a delivery note to deliver again.'
        : 'Enter a delivered quantity on at least one line.',
    };
  }
  if (opts.existing.length >= MAX_DELIVERY_NOTES) {
    return { ok: false, error: 'Too many delivery notes on this invoice.' };
  }
  const now = opts.now || new Date();
  const date = String(opts.input.deliveryDate || '').slice(0, 10);
  const note: DeliveryNoteRecord = {
    id: opts.id || `dn_${randomToken()}`,
    number: deliveryNoteNumber(opts.invoiceNumber, opts.existing),
    nonce: opts.nonce || randomToken(18),
    invoice_id: opts.invoiceId,
    invoice_number: String(opts.invoiceNumber || opts.invoiceId),
    created_at: now.toISOString(),
    delivery_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayIso(now),
    delivered_by: clip(opts.input.deliveredBy, 120),
    vehicle_reg: clip(opts.input.vehicleReg, 40),
    notes: clipMultiline(opts.input.notes, 2000),
    delivery_address: clipMultiline(opts.input.deliveryAddress, 500),
    customer_name: clip(opts.customerName, 180),
    contact_name: clip(opts.contactName, 160),
    contact_phone: clip(opts.contactPhone, 40),
    seller_name: clip(opts.sellerName, 180),
    lines,
    received_by_name: clip(opts.input.receivedByName, 160),
    received_by_date: /^\d{4}-\d{2}-\d{2}$/.test(String(opts.input.receivedByDate || ''))
      ? String(opts.input.receivedByDate).slice(0, 10)
      : null,
    revoked_at: null,
  };
  return { ok: true, note };
}

export function safeLogoUrl(url: unknown): string | null {
  const s = String(url || '').trim();
  if (!s || s.length > 500) return null;
  if (s.startsWith('https://') || s.startsWith('http://') || s.startsWith('/')) return s;
  return null;
}

export function toPublicDeliveryNote(
  note: DeliveryNoteRecord,
  seller?: {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logoUrl?: string | null;
  } | null
): PublicDeliveryNote {
  const lines = note.lines.map((line) => ({
    name: line.name,
    sku: line.sku,
    uom: line.uom,
    invoicedQty: line.invoiced_qty,
    deliveredQty: line.delivered_qty,
  }));
  const view: PublicDeliveryNote = {
    number: note.number,
    invoiceNumber: note.invoice_number,
    deliveryDate: note.delivery_date,
    customerName: note.customer_name || 'Customer',
    contactName: note.contact_name,
    contactPhone: note.contact_phone,
    deliveryAddress: note.delivery_address,
    deliveredBy: note.delivered_by,
    vehicleReg: note.vehicle_reg,
    notes: note.notes,
    sellerName: seller?.name || note.seller_name || 'Seller',
    sellerAddress: seller?.address || null,
    sellerPhone: seller?.phone || null,
    sellerEmail: seller?.email || null,
    logoUrl: safeLogoUrl(seller?.logoUrl),
    lines,
    receivedByName: note.received_by_name,
    receivedByDate: note.received_by_date,
    partial: lines.some((l) => l.deliveredQty + 0.0001 < l.invoicedQty),
  };
  return pickPublic(view);
}

function pickPublic(view: PublicDeliveryNote): PublicDeliveryNote {
  const out = {} as PublicDeliveryNote;
  for (const key of PUBLIC_KEYS) {
    if (key === 'lines') {
      out.lines = view.lines.map((line) => {
        const row = {} as PublicDeliveryNoteLine;
        for (const lk of LINE_KEYS) row[lk] = line[lk] as never;
        return row;
      });
    } else {
      (out as Record<string, unknown>)[key] = view[key];
    }
  }
  return out;
}

/** Throws if a serialised note carries commercial fields. Used before public responses. */
export function assertNoCommercialFields(value: unknown): void {
  const blob = JSON.stringify(value);
  const banned = [
    'unit_price',
    'line_total',
    'subtotal',
    'tax_amount',
    'tax_rate',
    'total_amount',
    'amount_paid',
    'vat_number',
    'bank_name',
    'account_number',
    'account_name',
    'iban',
    'swift',
    'branch_code',
    'currency',
    'payment_terms',
  ];
  const lower = blob.toLowerCase();
  for (const key of banned) {
    if (lower.includes(`"${key}"`)) {
      throw new Error('Delivery note leaked a commercial field');
    }
  }
}

export function deliveryNoteWhatsAppText(opts: {
  customerName?: string | null;
  contactName?: string | null;
  number: string;
  invoiceNumber: string;
  viewUrl: string;
  pdfUrl?: string | null;
  pdfAttached?: boolean;
}): string {
  const first =
    String(opts.contactName || opts.customerName || '')
      .trim()
      .split(/\s+/)[0] || 'there';
  const customer = String(opts.customerName || '').trim();
  const lines = [
    `Hi ${first}! 👋`,
    ``,
    `Delivery note *${opts.number}*${customer ? ` for *${customer}*` : ''}.`,
    `Invoice ref: *${opts.invoiceNumber}*`,
    ``,
    `View the delivery note:`,
    opts.viewUrl.trim(),
  ];
  if (opts.pdfAttached) {
    lines.push(``, `The PDF is attached.`);
  } else if (opts.pdfUrl?.trim()) {
    lines.push(``, `Download PDF:`, opts.pdfUrl.trim());
  }
  lines.push(
    ``,
    `—`,
    `Sent via *SupplierAdvisor®*`,
    `https://www.supplieradvisor.com`
  );
  return lines.join('\n');
}

export function deliveryNoteWhatsAppHref(opts: {
  text: string;
  phone?: string | null;
  mode: 'wa.me' | 'whatsapp';
}): string {
  const digits = toWhatsAppE164Digits(opts.phone);
  const q = encodeURIComponent(opts.text);
  if (opts.mode === 'whatsapp') {
    return digits
      ? `whatsapp://send?phone=${digits}&text=${q}`
      : `whatsapp://send?text=${q}`;
  }
  return digits ? `https://wa.me/${digits}?text=${q}` : `https://wa.me/?text=${q}`;
}

export function isPartialDelivery(note: Pick<DeliveryNoteRecord, 'lines'>): boolean {
  return note.lines.some((l) => l.delivered_qty + 0.0001 < l.invoiced_qty);
}
