/**
 * Event handlers for POST /api/webhooks/bfg-shop-sync (contract v1.0, section 4).
 *
 * Everything is scoped to the allowed profile (102) and written through the
 * existing SupplierAdvisor® code via BooksPort / SyncStore: customer rows,
 * sales orders, customer_invoices, syncCrmInvoiceToBooks, recordArPayment +
 * settleInvoicePayment and reverseInvoiceBooks. No ad-hoc ledger writes.
 */
import {
  CONTRACT_VERSION,
  SHOP_ORDER_ORIGIN,
  SHOP_ORIGIN,
  SYNC_ACTOR,
} from './config';
import { SyncError } from './errors';
import {
  displayName,
  planCustomer,
  resolveCustomer,
  type PossibleDuplicate,
} from './customers';
import {
  asMeta,
  addressText,
  buildItems,
  isStaleVersion,
  notesWithMarker,
  paymentTermsLabel,
  sastDate,
} from './mapping';
import {
  centsToRands,
  randsToCents,
  totalsFingerprint,
  totalsInvariantFailures,
} from './money';
import type { Row, SyncPorts } from './ports';
import type {
  Envelope,
  OrderCancelled,
  OrderPaid,
  OrderPlaced,
  OrderRefund,
  OrderStatus,
  ParsedEvent,
  CustomerSnapshot,
} from './validate';

export type SyncResult =
  | 'created'
  | 'updated'
  | 'noop'
  | 'stale'
  | 'voided'
  | 'alerted'
  | 'dry_run';

export type SaIds = {
  profile_id: number;
  customer_id: number | null;
  sales_order_id: number | null;
  sales_order_number: string | null;
  invoice_id: number | null;
  invoice_number: string | null;
  invoice_status: string | null;
  payment_id: number | null;
  amount_paid_cents: number | null;
};

export type HandlerOutput = {
  result: SyncResult;
  sa: Partial<SaIds>;
  possibleDuplicate?: PossibleDuplicate | null;
  warnings?: Array<{ code: string; message: string }>;
  stateVersionStored?: string | null;
  idempotentReplay?: boolean;
  plan?: Row;
  /** Only order.placed: detects the same reference with other totals. */
  fingerprint?: string | null;
};

export type HandlerCtx = {
  ports: SyncPorts;
  profileId: number;
  bankAccountId: number | null;
  envelope: Envelope;
};

const num = (v: unknown) => Number(v || 0);
const nowIso = (ctx: HandlerCtx) => new Date(ctx.ports.nowMs()).toISOString();

export function fullSa(profileId: number, p: Partial<SaIds>): SaIds {
  return {
    profile_id: profileId,
    customer_id: null,
    sales_order_id: null,
    sales_order_number: null,
    invoice_id: null,
    invoice_number: null,
    invoice_status: null,
    payment_id: null,
    amount_paid_cents: null,
    ...p,
  };
}

function invoiceSa(inv: Row, order: Row | null, extra: Partial<SaIds> = {}): Partial<SaIds> {
  return {
    customer_id: inv.customer_id != null ? num(inv.customer_id) : null,
    sales_order_id: order ? num(order.id) : inv.order_id != null ? num(inv.order_id) : null,
    sales_order_number: order ? String(order.order_number || '') || null : null,
    invoice_id: num(inv.id),
    invoice_number: String(inv.invoice_number || '') || null,
    invoice_status: String(inv.status || '') || null,
    amount_paid_cents: randsToCents(inv.amount_paid as number),
    ...extra,
  };
}

async function alertSoft(ctx: HandlerCtx, code: string, title: string, reference: string) {
  try {
    await ctx.ports.alert({
      code,
      title,
      body: `Web order ${reference}: ${title}`,
      metadata: { code, reference, event: ctx.envelope.event, profile_id: ctx.profileId },
    });
  } catch {
    /* alerts never fail the request */
  }
}

async function requireInvoice(ctx: HandlerCtx, reference: string): Promise<{ invoice: Row; order: Row | null }> {
  const { store } = ctx.ports;
  const invoice = await store.invoiceByShopRef(ctx.profileId, reference);
  const order = await store.orderByShopRef(ctx.profileId, reference);
  if (!invoice) {
    if (order) {
      // Order known but invoice missing: a data fault.
      await alertSoft(ctx, 'invoice_not_found', 'invoice missing for a known order', reference);
      throw new SyncError('invoice_not_found', 'Order is known but has no invoice.');
    }
    throw new SyncError('order_not_synced', 'Order has not been synced yet.');
  }
  return { invoice, order };
}

// ───────────────────────────── customer.upsert ─────────────────────────────

export async function handleCustomerUpsert(
  ctx: HandlerCtx,
  c: CustomerSnapshot
): Promise<HandlerOutput> {
  if (c.origin !== 'shop') {
    throw new SyncError('origin_not_allowed', 'customer.upsert only accepts origin "shop".');
  }
  const dry = ctx.envelope.dry_run;
  const plan = await planCustomer(ctx.ports, ctx.profileId, c);
  const out = await resolveCustomer({
    ports: ctx.ports,
    profileId: ctx.profileId,
    snapshot: c,
    stateVersion: ctx.envelope.state_version,
    forOrder: false,
    write: !dry,
    plan,
  });
  const customerId = out.row.id != null ? num(out.row.id) : null;
  const stored =
    (asMeta(out.row.metadata).shop_state_version as string | undefined) ||
    (out.created && !dry ? ctx.envelope.state_version : null) ||
    null;
  if (dry) {
    return {
      result: 'dry_run',
      sa: { customer_id: customerId },
      possibleDuplicate: out.possibleDuplicate,
      plan: {
        customer: plan.existing ? `match:${num(plan.existing.id)}` : 'create',
        lines: 0,
        mapped: true,
        totals_ok: true,
        would_void: false,
      },
      stateVersionStored: stored,
    };
  }
  const result: SyncResult = out.stale
    ? 'stale'
    : out.created
      ? 'created'
      : out.changed
        ? 'updated'
        : 'noop';
  return {
    result,
    sa: { customer_id: customerId },
    possibleDuplicate: out.possibleDuplicate,
    stateVersionStored: stored ?? ctx.envelope.state_version,
  };
}

// ─────────────────────────────── order.placed ──────────────────────────────

async function resolveProducts(
  ctx: HandlerCtx,
  d: OrderPlaced
): Promise<Record<string, number>> {
  const ids = [...new Set(d.lines.map((l) => l.shop_product_id))];
  const found = await ctx.ports.store.productsByShopIds(ctx.profileId, ids);
  const map: Record<string, number> = {};
  const missing: string[] = [];
  for (const id of ids) {
    const row = found[id];
    const pid = row ? num(row.id) : 0;
    if (pid > 0) map[id] = pid;
    else missing.push(id);
  }
  if (missing.length) {
    throw new SyncError('unmapped_product', 'Shop product has no SupplierAdvisor® product.', {
      shop_product_ids: missing,
    });
  }
  return map;
}

function assertTotals(d: OrderPlaced): void {
  const failures = totalsInvariantFailures(d.lines, d.transport, d.totals);
  if (failures.length) {
    throw new SyncError('totals_mismatch', 'Totals failed the cent invariants.', {
      invariants: failures,
    });
  }
}

function storedMatchesTotals(inv: Row, d: OrderPlaced): boolean {
  return (
    randsToCents(inv.subtotal as number) === d.totals.subtotal_ex_vat_cents &&
    randsToCents(inv.tax_amount as number) === d.totals.vat_cents &&
    randsToCents(inv.total_amount as number) === d.totals.total_inc_vat_cents
  );
}

/** Issue the invoice: status sent, then recognise it on the books. */
async function issueInvoice(ctx: HandlerCtx, invoice: Row): Promise<Row> {
  const { store, books } = ctx.ports;
  let current = invoice;
  if (String(current.status) === 'draft') {
    current = await store.updateInvoice(ctx.profileId, num(current.id), {
      status: 'sent',
      updated_at: nowIso(ctx),
    });
  }
  const synced = await books.syncInvoice({
    profileId: ctx.profileId,
    invoice: current,
    createdBy: SYNC_ACTOR,
  });
  if (!synced.ok) {
    // All or nothing: put the invoice back to draft so nothing half-issued is left.
    // A retry resumes from here.
    await store
      .updateInvoice(ctx.profileId, num(current.id), {
        status: 'draft',
        updated_at: nowIso(ctx),
      })
      .catch(() => undefined);
    throw new SyncError('internal_error', 'Could not recognise the invoice on the books.');
  }
  return current;
}

export async function handleOrderPlaced(ctx: HandlerCtx, d: OrderPlaced): Promise<HandlerOutput> {
  const { store } = ctx.ports;
  const pid = ctx.profileId;
  const dry = ctx.envelope.dry_run;
  const fingerprint = totalsFingerprint(d.totals);

  assertTotals(d);

  const existing = await store.invoiceByShopRef(pid, d.reference);
  const existingOrder = await store.orderByShopRef(pid, d.reference);

  if (existing) {
    if (!storedMatchesTotals(existing, d)) {
      await alertSoft(ctx, 'totals_changed', 'same reference arrived with different totals', d.reference);
      throw new SyncError('totals_changed', 'Same reference arrived with different totals.');
    }
    const meta = asMeta(existing.metadata);
    const status = String(existing.status || '');
    if (dry) {
      return {
        result: 'dry_run',
        sa: invoiceSa(existing, existingOrder),
        plan: { customer: 'existing', lines: d.lines.length, mapped: true, totals_ok: true, would_void: false },
        stateVersionStored: String(meta.shop_state_version || ctx.envelope.state_version),
        fingerprint,
      };
    }
    let invoice = existing;
    let resumed = false;
    if (status === 'draft') {
      invoice = await issueInvoice(ctx, existing);
      resumed = true;
    } else if (status !== 'void' && !meta.recognition_journal_id) {
      // Issued earlier but the books step did not finish: run it again (idempotent).
      invoice = await issueInvoice(ctx, existing);
    }
    let order = existingOrder;
    if (order && String(order.status) !== 'invoiced' && String(order.status) !== 'paid' && status !== 'void') {
      order = await store.updateOrder(pid, num(order.id), {
        status: 'invoiced',
        invoice_id: num(invoice.id),
        updated_at: nowIso(ctx),
      });
    }
    return {
      result: resumed ? 'created' : 'noop',
      sa: invoiceSa(invoice, order),
      idempotentReplay: !resumed,
      stateVersionStored: String(meta.shop_state_version || ctx.envelope.state_version),
      fingerprint,
    };
  }

  // New order: map products first, so an unmapped product writes nothing.
  const productIds = await resolveProducts(ctx, d);
  const plan = await planCustomer(ctx.ports, pid, d.customer);

  if (dry) {
    const probe = await resolveCustomer({
      ports: ctx.ports,
      profileId: pid,
      snapshot: d.customer,
      stateVersion: ctx.envelope.state_version,
      forOrder: true,
      write: false,
      plan,
    });
    return {
      result: 'dry_run',
      sa: { customer_id: plan.existing ? num(plan.existing.id) : null },
      possibleDuplicate: probe.possibleDuplicate,
      plan: {
        customer: plan.existing ? `match:${num(plan.existing.id)}` : 'create',
        lines: d.lines.length + (d.transport.status === 'charged' && d.transport.ex_vat_cents > 0 ? 1 : 0),
        mapped: true,
        totals_ok: true,
        would_void: false,
      },
      stateVersionStored: ctx.envelope.state_version,
      fingerprint,
    };
  }

  // 1. Customer
  const cust = await resolveCustomer({
    ports: ctx.ports,
    profileId: pid,
    snapshot: d.customer,
    stateVersion: ctx.envelope.state_version,
    forOrder: true,
    write: true,
    plan,
  });
  const customerId = num(cust.row.id);
  const customerName = displayName(d.customer) || String(cust.row.trading_name || '');

  const items = buildItems(d.lines, d.transport, productIds);
  const terms = paymentTermsLabel(d.payment_terms, d.payment_terms_code);
  const multi = d.shipping.destinations.length > 1;
  const shippingSummary = multi
    ? `Multiple destinations, see web order ${d.reference}`
    : d.shipping.summary || d.shipping.destinations[0]?.address || '';
  const orderNotes = `Web order ${d.reference}`;
  const contactName = d.contact.name || d.customer.contact_name || null;
  const contactEmail = d.contact.email || d.customer.email || null;
  const contactPhone = d.contact.phone || d.customer.phone || null;
  const money = {
    currency: 'ZAR',
    subtotal: centsToRands(d.totals.subtotal_ex_vat_cents),
    tax_rate: 15,
    tax_amount: centsToRands(d.totals.vat_cents),
    total_amount: centsToRands(d.totals.total_inc_vat_cents),
  };

  // 2. Sales order
  let order = existingOrder;
  if (!order) {
    const orderRow: Row = {
      profile_id: pid,
      customer_id: customerId,
      order_number: ctx.ports.docNumber('SO'),
      status: 'confirmed',
      origin: SHOP_ORDER_ORIGIN,
      ...money,
      customer_name: customerName,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      shipping_address: shippingSummary || null,
      notes: orderNotes,
      items,
      payment_terms: terms || null,
      sales_rep_name: d.sales_rep_name || null,
      promised_date: d.expected_delivery_date,
      visibility: 'seller_only',
      created_by: SYNC_ACTOR,
      metadata: {
        shop_order_ref: d.reference,
        shop_order_id: d.shop_order_id,
        origin: SHOP_ORIGIN,
        shop_state_version: ctx.envelope.state_version,
        ...(multi ? { shipments: d.shipping.destinations } : {}),
      },
    };
    let ins = await store.insertOrder(orderRow);
    if (!ins.ok) {
      const again = await store.orderByShopRef(pid, d.reference);
      if (!again) throw new SyncError('conflict_in_progress', 'Order is being created.');
      ins = { ok: true, row: again };
    }
    order = ins.row;
  }

  // 3. Invoice: draft first, issued only when the books step has succeeded.
  let invoice: Row | null = null;
  for (let attempt = 0; attempt < 5 && !invoice; attempt++) {
    const ins = await store.insertInvoice({
      profile_id: pid,
      customer_id: customerId,
      order_id: num(order.id),
      invoice_number: ctx.ports.docNumber('INV'),
      status: 'draft',
      ...money,
      amount_paid: 0,
      issue_date: d.issue_date,
      due_date: d.due_date,
      customer_name: customerName,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      billing_address: addressText(d.billing_address) || addressText(d.customer.billing_address) || null,
      notes: notesWithMarker(d.notes || orderNotes),
      items,
      payment_terms: terms || null,
      sales_rep_name: d.sales_rep_name || null,
      visibility: 'seller_only',
      created_by: SYNC_ACTOR,
      metadata: {
        origin: SHOP_ORIGIN,
        shop_order_ref: d.reference,
        shop_order_id: d.shop_order_id,
        shop_state_version: ctx.envelope.state_version,
      },
    });
    if (ins.ok) {
      invoice = ins.row;
    } else if (ins.conflict === 'ref') {
      invoice = await store.invoiceByShopRef(pid, d.reference);
      if (!invoice) throw new SyncError('conflict_in_progress', 'Invoice is being created.');
    } else if (ins.conflict === 'other') {
      throw new SyncError('internal_error', 'Could not create the invoice.');
    }
    // conflict "number": the invoice number was taken, re-roll and try again.
  }
  if (!invoice) throw new SyncError('internal_error', 'Could not allocate an invoice number.');

  invoice = await issueInvoice(ctx, invoice);

  // 4. Link: sales order invoiced
  order = await store.updateOrder(pid, num(order.id), {
    status: 'invoiced',
    invoice_id: num(invoice.id),
    updated_at: nowIso(ctx),
  });

  return {
    result: 'created',
    sa: invoiceSa(invoice, order, { customer_id: customerId }),
    possibleDuplicate: cust.possibleDuplicate,
    stateVersionStored: ctx.envelope.state_version,
    fingerprint,
  };
}

// ──────────────────────────────── order.paid ───────────────────────────────

async function resolveBankAccount(ctx: HandlerCtx): Promise<number> {
  if (ctx.bankAccountId) return ctx.bankAccountId;
  const ids = await ctx.ports.store.bankAccountIds(ctx.profileId);
  if (ids.length === 1) return ids[0];
  throw new SyncError('unavailable', 'The settlement bank account is not configured.');
}

export async function handleOrderPaid(ctx: HandlerCtx, d: OrderPaid): Promise<HandlerOutput> {
  const { store, books } = ctx.ports;
  const pid = ctx.profileId;
  const dry = ctx.envelope.dry_run;
  const { invoice, order } = await requireInvoice(ctx, d.reference);
  const status = String(invoice.status || '');

  if (status === 'void') {
    await alertSoft(ctx, 'payment_against_void', 'payment received for a voided invoice', d.reference);
    throw new SyncError('payment_against_void', 'Payment for a voided invoice. It is not reopened.');
  }

  const existingPayment = await store.paymentByReference(pid, num(invoice.id), d.payment_reference);
  if (!existingPayment) {
    if (status === 'draft') {
      throw new SyncError('order_not_synced', 'The invoice is not issued yet.');
    }
    if (!['sent', 'overdue', 'partial'].includes(status)) {
      await alertSoft(ctx, 'amount_mismatch', 'payment does not match the outstanding balance', d.reference);
      throw new SyncError('amount_mismatch', 'Payment does not match the outstanding balance.');
    }
    const outstanding =
      randsToCents(invoice.total_amount as number) - randsToCents(invoice.amount_paid as number);
    if (d.amount_cents !== outstanding) {
      await alertSoft(ctx, 'amount_mismatch', 'payment does not match the outstanding balance', d.reference);
      throw new SyncError('amount_mismatch', 'Payment does not match the outstanding balance.', {
        outstanding_cents: outstanding,
        amount_cents: d.amount_cents,
      });
    }
  }
  const bankAccountId = await resolveBankAccount(ctx);

  if (dry) {
    return {
      result: 'dry_run',
      sa: invoiceSa(invoice, order, existingPayment ? { payment_id: num(existingPayment.id) } : {}),
      plan: { customer: `match:${num(invoice.customer_id)}`, lines: 0, mapped: true, totals_ok: true, would_void: false },
    };
  }

  // Record the payment row once (key of record: invoice_id + reference).
  let created = false;
  let payment = existingPayment;
  if (!payment) {
    const rec = await store.recordPayment({
      profile_id: pid,
      invoice_id: num(invoice.id),
      customer_id: invoice.customer_id != null ? num(invoice.customer_id) : null,
      amount: centsToRands(d.amount_cents),
      currency: 'ZAR',
      paid_at: d.paid_at,
      method: d.method === 'paystack' ? 'paystack' : 'eft',
      reference: d.payment_reference,
      notes: `Web order ${d.reference}`,
      created_by: SYNC_ACTOR,
    });
    if (rec.ok) {
      payment = rec.row;
      created = true;
    } else {
      // Lost a race to the same reference: use the winner.
      payment = await store.paymentByReference(pid, num(invoice.id), d.payment_reference);
      if (!payment) throw new SyncError('internal_error', 'Could not record the payment.');
    }
  }

  const paidRands = centsToRands(d.amount_cents);
  const total = num(invoice.total_amount);
  // Resume-safe: re-assert the paid state and the books on every pass.
  let inv = invoice;
  if (created || String(inv.status) !== 'paid') {
    inv = await store.updateInvoice(pid, num(inv.id), {
      status: 'paid',
      amount_paid: created
        ? Math.min(total, centsToRands(randsToCents(inv.amount_paid as number) + d.amount_cents))
        : total,
      paid_at: d.paid_at,
      payment_reference: d.payment_reference,
      updated_at: nowIso(ctx),
    });
  }
  const synced = await books.syncInvoice({ profileId: pid, invoice: inv, createdBy: SYNC_ACTOR });
  if (!synced.ok || !synced.financeInvoiceId) {
    throw new SyncError('internal_error', 'Could not update the books for the payment.');
  }
  const twin = await store.financeTwin(pid, synced.financeInvoiceId);
  if (!twin) throw new SyncError('internal_error', 'Finance invoice not found for settlement.');
  const settled = await books.settlePayment({
    profileId: pid,
    financeInvoice: twin,
    paymentId: num(payment.id),
    amount: paidRands,
    paidAt: d.paid_at,
    bankAccountId,
    createdBy: SYNC_ACTOR,
  });
  if (!settled.ok) {
    throw new SyncError('internal_error', 'Could not settle the payment to the bank account.');
  }

  let ord = order;
  if (ord && String(ord.status) !== 'paid') {
    ord = await store.updateOrder(pid, num(ord.id), {
      status: 'paid',
      updated_at: nowIso(ctx),
    });
  }
  return {
    result: created ? 'created' : 'noop',
    sa: invoiceSa(inv, ord, {
      payment_id: num(payment.id),
      amount_paid_cents: randsToCents(inv.amount_paid as number),
    }),
    idempotentReplay: !created,
  };
}

// ───────────────────────────── order.cancelled ─────────────────────────────

export async function handleOrderCancelled(
  ctx: HandlerCtx,
  d: OrderCancelled
): Promise<HandlerOutput> {
  const { store, books } = ctx.ports;
  const pid = ctx.profileId;
  const dry = ctx.envelope.dry_run;
  const { invoice, order } = await requireInvoice(ctx, d.reference);
  const status = String(invoice.status || '');

  if (status === 'void') {
    return {
      result: dry ? 'dry_run' : 'noop',
      sa: invoiceSa(invoice, order),
      idempotentReplay: !dry,
      plan: dry
        ? { customer: `match:${num(invoice.customer_id)}`, lines: 0, mapped: true, totals_ok: true, would_void: false }
        : undefined,
    };
  }

  // Never void a paid invoice: the void would also reverse the settlement journal.
  const payments = await store.paymentCount(pid, num(invoice.id));
  const paid =
    d.paid_at != null ||
    payments > 0 ||
    num(invoice.amount_paid) > 0 ||
    Boolean(invoice.paid_at) ||
    ['paid', 'partial'].includes(status);
  if (paid) {
    await alertSoft(ctx, 'void_after_paid', 'cancellation received for a paid invoice (not voided)', d.reference);
    throw new SyncError('void_after_paid', 'Void requested for a paid or part-paid invoice. Refused.');
  }
  if (!['sent', 'overdue', 'draft'].includes(status)) {
    throw new SyncError('void_after_paid', 'Invoice is not in a voidable state. Refused.');
  }

  if (dry) {
    return {
      result: 'dry_run',
      sa: invoiceSa(invoice, order),
      plan: { customer: `match:${num(invoice.customer_id)}`, lines: 0, mapped: true, totals_ok: true, would_void: true },
    };
  }

  const reversed = await books.voidInvoiceBooks({
    profileId: pid,
    invoice: { ...invoice, status: 'void' },
    createdBy: SYNC_ACTOR,
  });
  if (!reversed.ok) throw new SyncError('internal_error', 'Could not reverse the invoice books.');

  const meta = asMeta(invoice.metadata);
  const note = `[void ${d.cancelled_at.slice(0, 10)}: web order ${d.reason}]`;
  const voided = await store.updateInvoice(pid, num(invoice.id), {
    status: 'void', // the number is kept and never reused
    notes: String(invoice.notes || '') ? `${String(invoice.notes)}\n${note}` : note,
    metadata: { ...meta, shop_voided_at: d.cancelled_at, shop_void_reason: d.reason },
    updated_at: nowIso(ctx),
  });
  let ord = order;
  if (ord && String(ord.status) !== 'cancelled') {
    ord = await store.updateOrder(pid, num(ord.id), {
      status: 'cancelled',
      updated_at: nowIso(ctx),
    });
  }
  return { result: 'voided', sa: invoiceSa(voided, ord) };
}

// ────────────────────────────── order.status ───────────────────────────────

/** sales_orders.status from the shop fulfilment status (contract 4.5). */
export function mapFulfilmentStatus(current: string, fulfilment: string): string {
  // `cancelled` is owned by order.cancelled / order.refund only.
  if (current === 'cancelled') return current;
  switch (fulfilment) {
    case 'received':
    case 'confirmed':
      // Never move an invoiced / paid (or further along) order backwards.
      return ['invoiced', 'paid', 'processing', 'shipped'].includes(current) ? current : 'confirmed';
    case 'processing':
      return current === 'shipped' ? current : 'processing';
    case 'dispatched':
    case 'out_for_delivery':
    case 'delivered':
      return 'shipped';
    default:
      return current;
  }
}

export async function handleOrderStatus(ctx: HandlerCtx, d: OrderStatus): Promise<HandlerOutput> {
  const { store } = ctx.ports;
  const pid = ctx.profileId;
  const dry = ctx.envelope.dry_run;
  const order = await store.orderByShopRef(pid, d.reference);
  if (!order) throw new SyncError('order_not_synced', 'Order has not been synced yet.');
  const invoice = await store.invoiceByShopRef(pid, d.reference);
  const meta = asMeta(order.metadata);
  const sa = invoice ? invoiceSa(invoice, order) : { sales_order_id: num(order.id), sales_order_number: String(order.order_number || '') || null };

  if (isStaleVersion(meta.shop_status_state_version, ctx.envelope.state_version)) {
    return { result: dry ? 'dry_run' : 'stale', sa, stateVersionStored: String(meta.shop_status_state_version) };
  }
  if (dry) return { result: 'dry_run', sa, stateVersionStored: ctx.envelope.state_version };

  // `cancelled` is handled only by order.cancelled; payment_status is informational.
  const current = String(order.status || '');
  const next = mapFulfilmentStatus(current, d.fulfilment_status);
  const patch: Row = {};
  if (next !== current) patch.status = next;
  if (d.expected_delivery_date && String(order.promised_date || '') !== d.expected_delivery_date) {
    patch.promised_date = d.expected_delivery_date;
  }
  const nextMeta: Row = { ...meta, shop_status_state_version: ctx.envelope.state_version };
  if (d.courier) nextMeta.courier = d.courier;
  if (d.tracking_reference) nextMeta.tracking = d.tracking_reference;
  if (d.fulfilment_status === 'delivered') {
    nextMeta.delivered_at = d.delivered_at || ctx.envelope.state_version;
  }
  const metaChanged = JSON.stringify(nextMeta) !== JSON.stringify(meta);
  if (Object.keys(patch).length === 0 && !metaChanged) {
    return { result: 'noop', sa, stateVersionStored: ctx.envelope.state_version };
  }
  patch.metadata = nextMeta;
  patch.updated_at = nowIso(ctx);
  const updated = await store.updateOrder(pid, num(order.id), patch);
  return {
    result: Object.keys(patch).some((k) => k === 'status' || k === 'promised_date') ? 'updated' : 'noop',
    sa: invoice ? invoiceSa(invoice, updated) : sa,
    stateVersionStored: ctx.envelope.state_version,
  };
}

// ────────────────────────────── order.refund ───────────────────────────────

export async function handleOrderRefund(ctx: HandlerCtx, d: OrderRefund): Promise<HandlerOutput> {
  const { store } = ctx.ports;
  const pid = ctx.profileId;
  const dry = ctx.envelope.dry_run;
  const order = await store.orderByShopRef(pid, d.reference);
  if (!order) throw new SyncError('order_not_synced', 'Order has not been synced yet.');
  const invoice = await store.invoiceByShopRef(pid, d.reference);
  const sa = invoice ? invoiceSa(invoice, order) : { sales_order_id: num(order.id), sales_order_number: String(order.order_number || '') || null };
  if (dry) return { result: 'dry_run', sa };

  // Alert only (v1): the invoice and the receipt stay untouched.
  const note = `[refund needed in SupplierAdvisor®: R${centsToRands(d.amount_cents).toFixed(2)} on ${d.refunded_at.slice(0, 10)}]`;
  const updated = await store.updateOrder(pid, num(order.id), {
    status: 'cancelled',
    notes: String(order.notes || '') ? `${String(order.notes)}\n${note}` : note,
    metadata: {
      ...asMeta(order.metadata),
      refund: { amount_cents: d.amount_cents, refunded_at: d.refunded_at, reason: d.reason },
    },
    updated_at: nowIso(ctx),
  });
  await alertSoft(ctx, 'refund_needed', 'refund needed in SupplierAdvisor®', d.reference);
  return { result: 'alerted', sa: invoice ? invoiceSa(invoice, updated) : sa };
}

// ─────────────────────────────── dispatcher ────────────────────────────────

export async function runEvent(ctx: HandlerCtx, parsed: ParsedEvent): Promise<HandlerOutput> {
  switch (parsed.event) {
    case 'customer.upsert':
      return handleCustomerUpsert(ctx, parsed.data);
    case 'order.placed':
      return handleOrderPlaced(ctx, parsed.data);
    case 'order.paid':
      return handleOrderPaid(ctx, parsed.data);
    case 'order.cancelled':
      return handleOrderCancelled(ctx, parsed.data);
    case 'order.status':
      return handleOrderStatus(ctx, parsed.data);
    case 'order.refund':
      return handleOrderRefund(ctx, parsed.data);
  }
}

export function successBody(
  ctx: HandlerCtx,
  out: HandlerOutput,
  replay: boolean
): Row {
  return {
    ok: true,
    contract_version: CONTRACT_VERSION,
    event: ctx.envelope.event,
    idempotency_key: ctx.envelope.idempotency_key,
    result: out.result,
    idempotent_replay: replay || Boolean(out.idempotentReplay),
    sa: fullSa(ctx.profileId, out.sa),
    possible_duplicate: out.possibleDuplicate ?? null,
    warnings: out.warnings ?? [],
    state_version_stored: out.stateVersionStored ?? null,
    ...(out.plan ? { plan: out.plan } : {}),
  };
}
