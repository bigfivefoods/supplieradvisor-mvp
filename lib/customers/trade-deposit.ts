/**
 * Official-order deposit: 50% invoice on Statement, Paystack, then processing.
 */
import {
  calcDocTotals,
  docNumber,
  normalizeItems,
  type DocLineItem,
} from '@/lib/customers/documents';
import {
  DEFAULT_DEPOSIT_PERCENT,
  depositAmountFromTotal,
  writeTradeThread,
  type TradeThread,
} from '@/lib/customers/trade-thread';

type Db = { from: (table: string) => any };

export function scaleItemsForDeposit(
  items: DocLineItem[],
  percent = DEFAULT_DEPOSIT_PERCENT
): DocLineItem[] {
  const p = Math.min(100, Math.max(1, Number(percent) || DEFAULT_DEPOSIT_PERCENT)) / 100;
  return items.map((line) => {
    const unit = Math.round(Number(line.unit_price || 0) * p * 100) / 100;
    const qty = Number(line.quantity || 0);
    return {
      ...line,
      unit_price: unit,
      line_total: Math.round(qty * unit * 100) / 100,
    };
  });
}

export function isDepositInvoiceNumber(raw: unknown): boolean {
  return /^DEP[-_]/i.test(String(raw || '').trim());
}

export function invoiceLooksLikeDeposit(row: {
  number?: string | null;
  notes?: string | null;
  metadata?: unknown;
}): boolean {
  if (isDepositInvoiceNumber(row.number)) return true;
  if (/\bdeposit\b/i.test(String(row.notes || ''))) return true;
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const kind = String(meta.kind || '');
  return kind === 'crm_quote_deposit' || kind === 'crm_po_deposit';
}

export function depositPoNumberFromMeta(metadata: unknown): string | null {
  const meta =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const n = String(meta.po_number || meta.customer_po_number || '').trim();
  return n || null;
}

export async function createTradeDepositInvoice(opts: {
  supabase: Db;
  companyId: number;
  customerId: number;
  quoteId?: number | null;
  inboundPoId?: number | null;
  poNumber: string;
  percent?: number;
  currency: string;
  taxRate: number;
  items: unknown;
  customerName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  now?: string;
}): Promise<
  | { ok: true; id: number; invoice_number: string; total_amount: number; percent: number }
  | { ok: false; error: string }
> {
  const now = opts.now || new Date().toISOString();
  const percent =
    Number(opts.percent) > 0 && Number(opts.percent) <= 100
      ? Number(opts.percent)
      : DEFAULT_DEPOSIT_PERCENT;
  const items = scaleItemsForDeposit(normalizeItems(opts.items), percent);
  const totals = calcDocTotals(items, Number(opts.taxRate ?? 15));
  const po = String(opts.poNumber || '').trim();
  const notes = `Deposit (${percent}%) on official order. Customer PO ${po || 'TBC'}. Appears on the customer statement.`;
  const payload: Record<string, unknown> = {
    profile_id: opts.companyId,
    customer_id: opts.customerId,
    quote_id: opts.quoteId || null,
    invoice_number: docNumber('DEP'),
    status: 'sent',
    currency: String(opts.currency || 'ZAR').slice(0, 8),
    ...totals,
    customer_name: opts.customerName || null,
    contact_name: opts.contactName || null,
    contact_email: opts.contactEmail || null,
    contact_phone: opts.contactPhone || null,
    visibility: 'shared',
    notes,
    items,
    metadata: {
      kind: opts.inboundPoId ? 'crm_po_deposit' : 'crm_quote_deposit',
      deposit_for_quote_id: opts.quoteId || null,
      inbound_po_id: opts.inboundPoId || null,
      po_number: po || null,
    },
    created_at: now,
    updated_at: now,
  };
  let { data: inv, error } = await opts.supabase
    .from('customer_invoices')
    .insert(payload)
    .select('id, invoice_number, total_amount')
    .single();
  if (error) {
    const retry = await opts.supabase
      .from('customer_invoices')
      .insert({
        profile_id: opts.companyId,
        customer_id: opts.customerId,
        invoice_number: payload.invoice_number,
        status: 'sent',
        currency: payload.currency,
        total_amount: totals.total_amount,
        customer_name: opts.customerName || null,
        notes,
        items,
        created_at: now,
        updated_at: now,
      })
      .select('id, invoice_number, total_amount')
      .single();
    inv = retry.data;
    error = retry.error;
  }
  if (error || !inv?.id) {
    return { ok: false, error: error?.message || 'Could not raise deposit invoice' };
  }
  return {
    ok: true,
    id: Number(inv.id),
    invoice_number: String(inv.invoice_number || payload.invoice_number),
    total_amount: Number(inv.total_amount || totals.total_amount),
    percent,
  };
}

export function threadWithDeposit(
  thread: TradeThread,
  opts: {
    poNumber: string;
    invoiceId: number;
    amount: number;
    percent: number;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    inboundPoId?: number | null;
    now?: string;
  }
): TradeThread {
  return {
    ...thread,
    stage: 'deposit',
    accepted_at: opts.now || new Date().toISOString(),
    po_number: opts.poNumber,
    deposit_percent: opts.percent,
    deposit_invoice_id: opts.invoiceId,
    deposit_amount: opts.amount,
    po_attachment_url: opts.attachmentUrl || thread.po_attachment_url || null,
    po_attachment_name: opts.attachmentName || thread.po_attachment_name || null,
    inbound_po_id: opts.inboundPoId || thread.inbound_po_id || null,
  };
}

export { depositAmountFromTotal, writeTradeThread };
