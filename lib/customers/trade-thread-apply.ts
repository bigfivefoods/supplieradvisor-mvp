/**
 * Apply deposit-paid → sales order processing on the golden thread.
 */
import { calcDocTotals, docNumber, normalizeItems } from '@/lib/customers/documents';
import {
  parseTradeThread,
  statusForStage,
  writeTradeThread,
  type TradeThread,
} from '@/lib/customers/trade-thread';

type Db = { from: (table: string) => any };

export async function markQuoteDepositPaid(opts: {
  supabase: Db;
  companyId: number;
  quoteId: number;
  invoiceId?: number | null;
  now?: string;
}): Promise<{ ok: true; thread: TradeThread; orderId: number | null } | { ok: false; error: string }> {
  const now = opts.now || new Date().toISOString();
  const { data: quote, error } = await opts.supabase
    .from('customer_quotes')
    .select('*')
    .eq('id', opts.quoteId)
    .eq('profile_id', opts.companyId)
    .maybeSingle();
  if (error || !quote) {
    return { ok: false, error: error?.message || 'Quote not found' };
  }

  let thread = parseTradeThread(quote.metadata, quote.status);
  thread = {
    ...thread,
    stage: 'processing',
    deposit_paid_at: now,
    deposit_invoice_id: opts.invoiceId || thread.deposit_invoice_id,
  };

  if (opts.invoiceId) {
    await opts.supabase
      .from('customer_invoices')
      .update({
        status: 'paid',
        amount_paid: Number(thread.deposit_amount || quote.total_amount || 0),
        updated_at: now,
      })
      .eq('id', opts.invoiceId)
      .eq('profile_id', opts.companyId);
  }

  let orderId = thread.order_id && thread.order_id > 0 ? thread.order_id : null;
  if (!orderId) {
    const items = normalizeItems(quote.items);
    const totals = calcDocTotals(items, Number(quote.tax_rate ?? 15));
    const orderPayload: Record<string, unknown> = {
      profile_id: opts.companyId,
      customer_id: quote.customer_id,
      quote_id: quote.id,
      opportunity_id: quote.opportunity_id || null,
      order_number: docNumber('SO'),
      status: 'processing',
      currency: quote.currency || 'ZAR',
      ...totals,
      customer_name: quote.customer_name,
      contact_name: quote.contact_name,
      contact_email: quote.contact_email,
      contact_phone: quote.contact_phone,
      customer_po_number: thread.po_number,
      notes: [
        quote.notes || '',
        thread.po_number ? `Customer PO ${thread.po_number}` : '',
        thread.po_attachment_url
          ? `Attached PO: ${thread.po_attachment_name || thread.po_attachment_url}`
          : '',
        '[official order — deposit paid, processing]',
      ]
        .filter(Boolean)
        .join('\n'),
      items,
      metadata: {
        thread,
        source: thread.source || 'storefront',
        customer_po_number: thread.po_number,
        inbound_po_id: thread.inbound_po_id || null,
        attachment_url: thread.po_attachment_url || null,
        attachment_name: thread.po_attachment_name || null,
      },
      created_at: now,
      updated_at: now,
    };
    let { data: order, error: oErr } = await opts.supabase
      .from('sales_orders')
      .insert(orderPayload)
      .select('id')
      .single();
    if (oErr) {
      const minimal = {
        profile_id: opts.companyId,
        customer_id: quote.customer_id,
        order_number: orderPayload.order_number,
        status: 'processing',
        currency: orderPayload.currency,
        total_amount: totals.total_amount,
        customer_name: quote.customer_name,
        notes: orderPayload.notes,
        items,
        created_at: now,
        updated_at: now,
      };
      const retry = await opts.supabase
        .from('sales_orders')
        .insert(minimal)
        .select('id')
        .single();
      order = retry.data;
      oErr = retry.error;
    }
    if (oErr || !order?.id) {
      return { ok: false, error: oErr?.message || 'Could not open sales order' };
    }
    orderId = Number(order.id);
  }

  thread.order_id = orderId;
  thread.stage = 'processing';

  await opts.supabase
    .from('customer_quotes')
    .update({
      status: statusForStage('processing'),
      order_id: orderId,
      metadata: writeTradeThread(quote.metadata, thread),
      updated_at: now,
    })
    .eq('id', quote.id)
    .eq('profile_id', opts.companyId);

  if (thread.inbound_po_id && thread.inbound_po_id > 0) {
    const poHit = await opts.supabase
      .from('purchase_orders')
      .select('id, metadata')
      .eq('id', thread.inbound_po_id)
      .maybeSingle();
    const prev =
      poHit.data?.metadata && typeof poHit.data.metadata === 'object'
        ? (poHit.data.metadata as Record<string, unknown>)
        : {};
    await opts.supabase
      .from('purchase_orders')
      .update({
        metadata: {
          ...prev,
          deposit_paid_at: now,
          sales_order_id: orderId,
          deposit_invoice_id: thread.deposit_invoice_id,
        },
        updated_at: now,
      })
      .eq('id', thread.inbound_po_id);
  }

  return { ok: true, thread, orderId };
}
