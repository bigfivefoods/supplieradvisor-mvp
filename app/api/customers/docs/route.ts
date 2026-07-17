import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  calcDocTotals,
  docNumber,
  normalizeItems,
  tierFromLifetime,
  LOYALTY_EARN_RATE,
  type DocLineItem,
} from '@/lib/customers/documents';
import {
  assertCustomersAccess,
  assertSellerCustomerNotSuspended,
} from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';
import { promptAfterInvoicePaid } from '@/lib/ratings/create-prompt';

type DocKind = 'quote' | 'order' | 'invoice';

const TABLES: Record<DocKind, string> = {
  quote: 'customer_quotes',
  order: 'sales_orders',
  invoice: 'customer_invoices',
};

const NUM_PREFIX: Record<DocKind, string> = {
  quote: 'QT',
  order: 'SO',
  invoice: 'INV',
};

const NUM_FIELD: Record<DocKind, string> = {
  quote: 'quote_number',
  order: 'order_number',
  invoice: 'invoice_number',
};

function kindOf(request: NextRequest, body?: Record<string, unknown>): DocKind {
  const t = String(
    body?.type || request.nextUrl.searchParams.get('type') || 'quote'
  ).toLowerCase();
  if (t === 'order' || t === 'orders') return 'order';
  if (t === 'invoice' || t === 'invoices') return 'invoice';
  return 'quote';
}

async function loadCustomer(
  supabase: ReturnType<typeof getSupabaseServer>,
  customerId: number | null
) {
  if (!customerId) return null;
  const { data } = await supabase.from('customers').select('*').eq('id', customerId).maybeSingle();
  return data;
}

function buildPayload(
  kind: DocKind,
  body: Record<string, unknown>,
  companyId: number,
  items: DocLineItem[],
  totals: ReturnType<typeof calcDocTotals>,
  customer: Record<string, unknown> | null
) {
  const now = new Date().toISOString();
  const numField = NUM_FIELD[kind];
  const base: Record<string, unknown> = {
    profile_id: companyId,
    customer_id: body.customer_id ? Number(body.customer_id) : null,
    opportunity_id: body.opportunity_id ? Number(body.opportunity_id) : null,
    [numField]: body[numField] || body.doc_number || docNumber(NUM_PREFIX[kind]),
    status: body.status || 'draft',
    currency: body.currency || 'ZAR',
    subtotal: totals.subtotal,
    tax_rate: totals.tax_rate,
    tax_amount: totals.tax_amount,
    total_amount: totals.total_amount,
    customer_name:
      body.customer_name ||
      customer?.trading_name ||
      customer?.legal_name ||
      customer?.company_name ||
      null,
    contact_name:
      body.contact_name || customer?.contact_name || customer?.name || null,
    contact_email:
      body.contact_email ||
      customer?.email ||
      customer?.contact_email ||
      customer?.billing_email ||
      null,
    contact_phone:
      body.contact_phone ||
      customer?.phone ||
      customer?.contact_phone ||
      customer?.contact_number ||
      null,
    notes: body.notes || null,
    items,
    updated_at: now,
  };

  if (kind === 'quote') {
    base.valid_until = body.valid_until || null;
    base.billing_address = body.billing_address || customer?.billing_address || null;
    base.terms = body.terms || 'Prices valid until the date shown. Subject to stock availability.';
    base.order_id = body.order_id || null;
  }
  if (kind === 'order') {
    base.quote_id = body.quote_id || null;
    base.promised_date = body.promised_date || null;
    base.shipped_date = body.shipped_date || null;
    base.shipping_address =
      body.shipping_address || customer?.shipping_address || customer?.billing_address || null;
    base.invoice_id = body.invoice_id || null;
  }
  if (kind === 'invoice') {
    base.order_id = body.order_id || null;
    base.quote_id = body.quote_id || null;
    base.issue_date = body.issue_date || now.slice(0, 10);
    base.due_date = body.due_date || null;
    base.amount_paid = body.amount_paid != null ? Number(body.amount_paid) : 0;
    base.paid_at = body.paid_at || null;
    base.billing_address = body.billing_address || customer?.billing_address || null;
    // fromPo: durable link for double-invoice guard (column may strip if migration not run)
    const sourcePo = body.source_po_id != null ? Number(body.source_po_id) : NaN;
    if (Number.isFinite(sourcePo) && sourcePo > 0) {
      base.source_po_id = sourcePo;
    }
  }
  return base;
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const kind = kindOf(request);
    const id = request.nextUrl.searchParams.get('id');
    const status = request.nextUrl.searchParams.get('status');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const supabase = getSupabaseServer();
    const table = TABLES[kind];

    if (id) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', Number(id))
        .eq('profile_id', companyId)
        .maybeSingle();
      if (error) {
        return NextResponse.json({
          success: true,
          document: null,
          documents: [],
          warning: error.message,
          hint: 'Run 20260709_crm_sales_lifecycle.sql',
        });
      }
      return NextResponse.json({ success: true, document: data, type: kind });
    }

    let q = supabase
      .from(table)
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (status && status !== 'all') q = q.eq('status', status);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        documents: [],
        warning: error.message,
        hint: 'Run 20260709_crm_sales_lifecycle.sql',
      });
    }
    return NextResponse.json({ success: true, documents: data || [], type: kind });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const kind = kindOf(request, body);
    const action = body.action || 'create';

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const table = TABLES[kind];
    const now = new Date().toISOString();

    // ── One-click invoice from accepted inbound PO ────────────────────────
    if (action === 'create_from_po') {
      const poId = Number(body.poId || body.source_po_id || 0);
      if (!Number.isFinite(poId) || poId <= 0) {
        return NextResponse.json({ error: 'poId required' }, { status: 400 });
      }

      // Double-invoice guard
      const { data: existingInv } = await supabase
        .from('customer_invoices')
        .select('id, invoice_number, status, source_po_id')
        .eq('profile_id', companyId)
        .eq('source_po_id', poId)
        .limit(1)
        .maybeSingle();
      if (existingInv?.id) {
        return NextResponse.json(
          {
            error: `Invoice already exists for PO #${poId}`,
            code: 'DUPLICATE_FROM_PO',
            existing: existingInv,
            document: existingInv,
          },
          { status: 409 }
        );
      }

      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', poId)
        .or(
          `supplier_profile_id.eq.${companyId},supplier_id.eq.${companyId}`
        )
        .maybeSingle();
      if (poErr || !po) {
        return NextResponse.json(
          { error: poErr?.message || 'PO not found or not assigned to you' },
          { status: 404 }
        );
      }
      const poSt = String(po.status || '').toLowerCase();
      if (!['accepted', 'funded', 'open', 'confirmed', 'invoiced'].includes(poSt)) {
        return NextResponse.json(
          {
            error: `PO status is ${poSt || 'unknown'} — accept the PO before invoicing`,
            code: 'PO_NOT_READY',
          },
          { status: 400 }
        );
      }

      const rawItems = Array.isArray(po.items) ? po.items : [];
      let items = normalizeItems(
        rawItems.map((it: Record<string, unknown>) => ({
          name: String(it.item_name || it.name || 'Line'),
          quantity: Number(it.quantity || 1),
          unit_price: Number(it.unit_price || 0),
          uom: it.uom || 'unit',
          line_total:
            Number(it.quantity || 1) * Number(it.unit_price || 0),
        }))
      );
      if (!items.length && Number(po.total_amount) > 0) {
        items = normalizeItems([
          {
            name: String(po.description || `PO #${poId}`),
            quantity: 1,
            unit_price: Number(po.total_amount),
            uom: 'lot',
            line_total: Number(po.total_amount),
          },
        ]);
      }
      if (!items.length) {
        return NextResponse.json(
          { error: 'PO has no line items to invoice' },
          { status: 400 }
        );
      }

      const taxRate = body.tax_rate != null ? Number(body.tax_rate) : 15;
      const totals = calcDocTotals(items, taxRate);

      // Resolve / create CRM customer from buyer profile
      let customerId: number | null =
        body.customer_id != null ? Number(body.customer_id) : null;
      const buyerProfileId = Number(
        body.buyerProfileId || po.buyer_profile_id || 0
      );
      if (!customerId && buyerProfileId > 0) {
        const { data: linked } = await supabase
          .from('customers')
          .select('id')
          .eq('profile_id', companyId)
          .eq('linked_profile_id', buyerProfileId)
          .limit(1)
          .maybeSingle();
        if (linked?.id) customerId = Number(linked.id);
      }
      if (!customerId && buyerProfileId > 0) {
        const { data: peer } = await supabase
          .from('profiles')
          .select('trading_name, legal_name, email, country')
          .eq('id', buyerProfileId)
          .maybeSingle();
        const name =
          peer?.trading_name ||
          peer?.legal_name ||
          po.buyer_name ||
          `Buyer #${buyerProfileId}`;
        const { data: created } = await supabase
          .from('customers')
          .insert({
            profile_id: companyId,
            trading_name: name,
            linked_profile_id: buyerProfileId,
            email: peer?.email || null,
            country: peer?.country || null,
            status: 'active',
            notes: `Auto from PO #${poId}`,
          })
          .select('id')
          .single();
        if (created?.id) customerId = Number(created.id);
      }

      const customer = await loadCustomer(supabase, customerId);
      if (customerId && body.acknowledgeCredit !== true) {
        try {
          const { checkCustomerCreditLimit } = await import(
            '@/lib/customers/credit-limit'
          );
          const credit = await checkCustomerCreditLimit(supabase, {
            companyId,
            customerId,
            additionalAmount: Number(totals.total_amount || 0),
          });
          if (!credit.ok) {
            return NextResponse.json(
              {
                ...credit,
                error: `Credit limit exceeded (limit ${credit.creditLimit}, projected ${credit.projected})`,
              },
              { status: 409 }
            );
          }
        } catch {
          /* soft */
        }
      }

      const invBody = {
        companyId,
        type: 'invoice',
        customer_id: customerId,
        currency: po.currency || 'ZAR',
        tax_rate: taxRate,
        notes: `From purchase order #${poId}`,
        items,
        status: 'draft',
        source_po_id: poId,
        due_date: body.due_date || null,
      };
      const payload = buildPayload(
        'invoice',
        invBody,
        companyId,
        items,
        totals,
        customer
      );
      const inserted = await insertDocTolerant(
        supabase,
        'customer_invoices',
        payload
      );
      if (!inserted.ok) {
        return NextResponse.json(
          { error: inserted.error },
          { status: 500 }
        );
      }

      let documentOut = inserted.data as Record<string, unknown>;
      // Mark PO invoiced
      await supabase
        .from('purchase_orders')
        .update({ status: 'invoiced', updated_at: now })
        .eq('id', poId)
        .or(
          `supplier_profile_id.eq.${companyId},supplier_id.eq.${companyId}`
        );

      // Auto-share when customer linked
      if (customerId && documentOut.id) {
        try {
          const notSuspended = await assertSellerCustomerNotSuspended(
            companyId,
            customerId
          );
          if (notSuspended.ok) {
            const { data: shared } = await supabase
              .from('customer_invoices')
              .update({ visibility: 'shared', updated_at: now })
              .eq('id', Number(documentOut.id))
              .eq('profile_id', companyId)
              .select('*')
              .maybeSingle();
            if (shared) documentOut = shared as Record<string, unknown>;
          }
        } catch {
          /* soft */
        }
      }

      // Company preference: client should auto-email PDF (flag only — auth stays on client)
      let autoEmailOnFromPo = body.autoEmail === true;
      let autoEmailTo: string | null = null;
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('settings')
          .eq('id', companyId)
          .maybeSingle();
        const s =
          prof?.settings && typeof prof.settings === 'object'
            ? (prof.settings as Record<string, unknown>)
            : {};
        if (s.autoEmailOnFromPo === true) autoEmailOnFromPo = true;
        if (autoEmailOnFromPo && documentOut.id) {
          const to = String(
            documentOut.contact_email ||
              (customer as { email?: string } | null)?.email ||
              ''
          ).trim();
          if (to.includes('@')) autoEmailTo = to;
        }
      } catch {
        /* soft */
      }

      return NextResponse.json({
        success: true,
        action: 'create_from_po',
        document: documentOut,
        type: 'invoice',
        poId,
        invoiceSharedToBuyer: String(documentOut.visibility || '') === 'shared',
        autoEmailOnFromPo,
        autoEmailTo,
      });
    }

    // ── Installment mark paid ─────────────────────────────────────────────
    if (action === 'mark_installment_paid' && body.id) {
      if (kind !== 'invoice') {
        return NextResponse.json({ error: 'Invoice only' }, { status: 400 });
      }
      const { data: inv, error } = await supabase
        .from('customer_invoices')
        .select('id, notes, amount_paid, total_amount, status')
        .eq('id', Number(body.id))
        .eq('profile_id', companyId)
        .maybeSingle();
      if (error || !inv) {
        return NextResponse.json(
          { error: error?.message || 'Not found' },
          { status: 404 }
        );
      }
      const {
        parseInstallments,
        writeInstallments,
        installmentSummary,
      } = await import('@/lib/customers/installments');
      const rows = parseInstallments(inv.notes as string);
      if (!rows.length) {
        return NextResponse.json(
          { error: 'No structured installments on this invoice' },
          { status: 400 }
        );
      }
      const idx =
        body.index != null
          ? Number(body.index)
          : rows.findIndex((r) => !r.paid);
      if (idx < 0 || idx >= rows.length) {
        return NextResponse.json(
          { error: 'Invalid installment index' },
          { status: 400 }
        );
      }
      const paidFlag = body.paid !== false;
      rows[idx] = { ...rows[idx], paid: paidFlag };
      const notes = writeInstallments(inv.notes as string, rows);
      const sum = installmentSummary(rows);
      // Soft-sync amount_paid to sum of paid installments when sensible
      let amountPaid = Number(inv.amount_paid || 0);
      if (paidFlag) {
        amountPaid = Math.max(amountPaid, sum.paid);
      }
      const total = Number(inv.total_amount || 0);
      const fullyPaid = total > 0 && amountPaid >= total - 0.01;
      const nextStatus = fullyPaid
        ? 'paid'
        : amountPaid > 0
          ? 'partial'
          : inv.status;
      const { data: updated, error: uErr } = await supabase
        .from('customer_invoices')
        .update({
          notes,
          amount_paid: amountPaid,
          status: nextStatus,
          paid_at: fullyPaid ? now : null,
          updated_at: now,
        })
        .eq('id', inv.id)
        .eq('profile_id', companyId)
        .select('*')
        .single();
      if (uErr) {
        return NextResponse.json({ error: uErr.message }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        action: 'mark_installment_paid',
        invoice: updated,
        installments: rows,
        summary: sum,
      });
    }

    // ── Dunning send-now / skip level ─────────────────────────────────────
    if (
      (action === 'dunning_send_now' || action === 'dunning_skip') &&
      body.id
    ) {
      const { sendDunningForInvoice } = await import(
        '@/lib/customers/dunning-send'
      );
      const result = await sendDunningForInvoice({
        invoiceId: Number(body.id),
        companyId,
        force: action === 'dunning_send_now',
        skipLevel: action === 'dunning_skip',
      });
      if (!result.ok && result.reason === 'forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (!result.ok) {
        return NextResponse.json(
          { error: result.reason || 'Dunning failed', ...result },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, action, ...result });
    }

    // ── Dunning pause / resume ────────────────────────────────────────────
    if (
      (action === 'set_dunning_pause' || action === 'set_payment_plan') &&
      body.id
    ) {
      if (kind !== 'invoice') {
        return NextResponse.json(
          { error: 'Invoice only' },
          { status: 400 }
        );
      }
      const { data: inv, error } = await supabase
        .from('customer_invoices')
        .select('id, notes, status')
        .eq('id', Number(body.id))
        .eq('profile_id', companyId)
        .maybeSingle();
      if (error || !inv) {
        return NextResponse.json(
          { error: error?.message || 'Not found' },
          { status: 404 }
        );
      }
      let notes = inv.notes != null ? String(inv.notes) : '';
      if (action === 'set_dunning_pause') {
        const pause = body.pause !== false;
        if (pause) {
          if (!notes.includes('[dunning paused]')) {
            notes = notes
              ? `${notes}\n[dunning paused ${now.slice(0, 10)}]`
              : `[dunning paused ${now.slice(0, 10)}]`;
          }
        } else {
          notes = notes
            .split('\n')
            .filter((l) => !/\[dunning paused/.test(l))
            .join('\n');
          notes = notes
            ? `${notes}\n[dunning resumed ${now.slice(0, 10)}]`
            : `[dunning resumed ${now.slice(0, 10)}]`;
        }
      } else {
        // payment plan — free text and/or structured installments
        const plan = String(body.plan || body.notes || '').trim().slice(0, 500);
        let structured: Array<{ date: string; amount: number }> = [];
        if (Array.isArray(body.installments) && body.installments.length) {
          structured = body.installments
            .map((x: unknown) => {
              const row = x as { date?: string; amount?: number };
              const date = String(row.date || '').slice(0, 10);
              const amount = Number(row.amount);
              if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(amount)) {
                return null;
              }
              return { date, amount };
            })
            .filter(Boolean) as Array<{ date: string; amount: number }>;
        }
        if (!plan && !structured.length) {
          return NextResponse.json(
            { error: 'plan text or installments[] required' },
            { status: 400 }
          );
        }
        const countHint =
          structured.length ||
          (body.installmentCount != null ? Number(body.installmentCount) : null);
        const line = `[payment plan ${now.slice(0, 10)}] ${
          plan || 'structured installments'
        }${countHint ? ` · ${countHint} installments` : ''}`;
        notes = notes ? `${notes}\n${line}` : line;
        if (structured.length) {
          // Replace prior structured block
          notes = notes.replace(
            /\[installments\][\s\S]*?\[\/installments\]/g,
            ''
          ).trim();
          const { writeInstallments } = await import(
            '@/lib/customers/installments'
          );
          notes = writeInstallments(
            notes,
            structured.map((s, index) => ({
              date: s.date,
              amount: s.amount,
              paid: false,
              index,
            }))
          );
        }
        // Optional promise date from plan (first installment)
        const ptp = body.promise_to_pay_date
          ? String(body.promise_to_pay_date).slice(0, 10)
          : structured[0]?.date || null;
        if (ptp && /^\d{4}-\d{2}-\d{2}$/.test(ptp)) {
          const { error: pErr } = await supabase
            .from('customer_invoices')
            .update({
              notes,
              promise_to_pay_date: ptp,
              updated_at: now,
            })
            .eq('id', inv.id)
            .eq('profile_id', companyId);
          if (pErr && /promise_to_pay|column/i.test(pErr.message || '')) {
            await supabase
              .from('customer_invoices')
              .update({ notes, updated_at: now })
              .eq('id', inv.id);
          } else if (pErr) {
            return NextResponse.json({ error: pErr.message }, { status: 500 });
          }
          return NextResponse.json({
            success: true,
            action: 'set_payment_plan',
            promise_to_pay_date: ptp,
            installments: structured,
          });
        }
      }
      const { data: updated, error: uErr } = await supabase
        .from('customer_invoices')
        .update({ notes: notes || null, updated_at: now })
        .eq('id', inv.id)
        .eq('profile_id', companyId)
        .select('*')
        .single();
      if (uErr) {
        return NextResponse.json({ error: uErr.message }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        action,
        invoice: updated,
      });
    }

    // ── Convert quote → order ──────────────────────────────────────────────
    if (action === 'convert_to_order' && body.id) {
      const { data: quote, error } = await supabase
        .from('customer_quotes')
        .select('*')
        .eq('id', Number(body.id))
        .eq('profile_id', companyId)
        .maybeSingle();
      if (error || !quote) {
        return NextResponse.json({ error: error?.message || 'Quote not found' }, { status: 404 });
      }
      const items = normalizeItems(quote.items);
      const totals = calcDocTotals(items, Number(quote.tax_rate ?? 15));
      const orderPayload = {
        profile_id: companyId,
        customer_id: quote.customer_id,
        quote_id: quote.id,
        opportunity_id: quote.opportunity_id,
        order_number: docNumber('SO'),
        status: 'confirmed',
        currency: quote.currency || 'ZAR',
        ...totals,
        customer_name: quote.customer_name,
        contact_name: quote.contact_name,
        contact_email: quote.contact_email,
        contact_phone: quote.contact_phone,
        shipping_address: quote.billing_address,
        notes: quote.notes,
        items,
        updated_at: now,
      };
      const orderIns = await insertDocTolerant(
        supabase,
        'sales_orders',
        orderPayload as Record<string, unknown>
      );
      if (!orderIns.ok) {
        return NextResponse.json({ error: orderIns.error }, { status: 500 });
      }
      const order = orderIns.data;

      await supabase
        .from('customer_quotes')
        .update({ status: 'converted', order_id: order.id, updated_at: now })
        .eq('id', quote.id);

      return NextResponse.json({
        success: true,
        order,
        type: 'order',
        action: 'convert_to_order',
      });
    }

    // ── Convert order → invoice ────────────────────────────────────────────
    if (action === 'convert_to_invoice' && body.id) {
      const { data: order, error } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('id', Number(body.id))
        .eq('profile_id', companyId)
        .maybeSingle();
      if (error || !order) {
        return NextResponse.json({ error: error?.message || 'Order not found' }, { status: 404 });
      }
      const items = normalizeItems(order.items);
      const totals = calcDocTotals(items, Number(order.tax_rate ?? 15));
      const due = new Date();
      due.setDate(due.getDate() + 30);
      const invPayload = {
        profile_id: companyId,
        customer_id: order.customer_id,
        order_id: order.id,
        quote_id: order.quote_id,
        invoice_number: docNumber('INV'),
        status: 'sent',
        currency: order.currency || 'ZAR',
        ...totals,
        amount_paid: 0,
        issue_date: now.slice(0, 10),
        due_date: due.toISOString().slice(0, 10),
        customer_name: order.customer_name,
        contact_name: order.contact_name,
        contact_email: order.contact_email,
        contact_phone: order.contact_phone,
        billing_address: order.shipping_address,
        notes: order.notes,
        items,
        updated_at: now,
      };
      const invIns = await insertDocTolerant(
        supabase,
        'customer_invoices',
        invPayload as Record<string, unknown>
      );
      if (!invIns.ok) {
        return NextResponse.json(
          {
            error: invIns.error,
            hint: 'Run supabase/migrations/20260713_customer_invoices_contact_phone.sql',
          },
          { status: 500 }
        );
      }
      const invoice = invIns.data;

      await supabase
        .from('sales_orders')
        .update({ status: 'invoiced', invoice_id: invoice.id, updated_at: now })
        .eq('id', order.id);

      return NextResponse.json({
        success: true,
        invoice,
        type: 'invoice',
        action: 'convert_to_invoice',
      });
    }

    // ── Promise-to-pay date (collections) ────────────────────────────────
    if (action === 'set_promise_to_pay' && body.id) {
      if (kind !== 'invoice') {
        return NextResponse.json(
          { error: 'Promise-to-pay applies to invoices only' },
          { status: 400 }
        );
      }
      type InvPtpRow = {
        id: number;
        status?: string | null;
        notes?: string | null;
        invoice_number?: string | null;
        promise_to_pay_date?: string | null;
      };
      const { data: inv, error } = await supabase
        .from('customer_invoices')
        .select('id, status, notes, promise_to_pay_date, invoice_number')
        .eq('id', Number(body.id))
        .eq('profile_id', companyId)
        .maybeSingle();
      // Soft if column missing on select
      let invRow: InvPtpRow | null = inv as InvPtpRow | null;
      if (error && /promise_to_pay|column|schema cache/i.test(error.message || '')) {
        const retry = await supabase
          .from('customer_invoices')
          .select('id, status, notes, invoice_number')
          .eq('id', Number(body.id))
          .eq('profile_id', companyId)
          .maybeSingle();
        if (retry.error || !retry.data) {
          return NextResponse.json(
            {
              error:
                'promise_to_pay_date column missing — run supabase/migrations/20260717_customer_invoices_promise_to_pay.sql',
              code: 'MIGRATION_REQUIRED',
            },
            { status: 503 }
          );
        }
        invRow = retry.data as InvPtpRow;
      } else if (error || !inv) {
        return NextResponse.json(
          { error: error?.message || 'Invoice not found' },
          { status: 404 }
        );
      }

      const clear = body.clear === true || body.promise_to_pay_date === null;
      const rawDate = clear
        ? null
        : String(body.promise_to_pay_date || body.date || '')
            .trim()
            .slice(0, 10);
      if (!clear && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate || '')) {
        return NextResponse.json(
          { error: 'promise_to_pay_date required as YYYY-MM-DD (or clear: true)' },
          { status: 400 }
        );
      }

      const st = String(invRow?.status || '').toLowerCase();
      if (['paid', 'void', 'cancelled'].includes(st)) {
        return NextResponse.json(
          { error: `Cannot set promise on ${st} invoice` },
          { status: 400 }
        );
      }

      const reason = body.reason != null ? String(body.reason).trim().slice(0, 280) : '';
      const prevPtp = invRow?.promise_to_pay_date
        ? String(invRow.promise_to_pay_date).slice(0, 10)
        : null;
      const todayIso = now.slice(0, 10);
      const wasBroken = Boolean(prevPtp && prevPtp < todayIso);
      const renegotiate = Boolean(
        !clear &&
          prevPtp &&
          rawDate &&
          prevPtp !== rawDate &&
          (wasBroken || body.renegotiate === true)
      );
      const line = clear
        ? `[promise cleared ${todayIso}]${reason ? ` reason=${reason}` : ''}`
        : renegotiate
          ? `[promise renegotiated ${prevPtp} → ${rawDate} on ${todayIso}]${
              reason ? ` reason=${reason}` : ''
            }`
          : `[promise ${rawDate} set ${todayIso}]${reason ? ` reason=${reason}` : ''}`;
      const prevNotes = invRow?.notes != null ? String(invRow.notes) : '';
      // Drop daily ptp_reminded markers when renegotiating so cron can fire again
      let notesBase = prevNotes;
      if (renegotiate) {
        notesBase = notesBase
          .split('\n')
          .filter((l) => !/\[ptp_reminded /.test(l))
          .join('\n');
      }
      const notesOut = notesBase ? `${notesBase}\n${line}` : line;

      let { data: updated, error: uErr } = await supabase
        .from('customer_invoices')
        .update({
          promise_to_pay_date: clear ? null : rawDate,
          notes: notesOut,
          updated_at: now,
        })
        .eq('id', Number(body.id))
        .eq('profile_id', companyId)
        .select('*')
        .single();

      if (uErr && /promise_to_pay|column|schema cache/i.test(uErr.message || '')) {
        return NextResponse.json(
          {
            error:
              'promise_to_pay_date column missing — run supabase/migrations/20260717_customer_invoices_promise_to_pay.sql',
            code: 'MIGRATION_REQUIRED',
          },
          { status: 503 }
        );
      }
      if (uErr) {
        return NextResponse.json({ error: uErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: 'set_promise_to_pay',
        invoice: updated,
        promise_to_pay_date: clear ? null : rawDate,
        renegotiated: renegotiate,
        reason: reason || null,
      });
    }

    // ── Mark invoice paid (full or partial) + loyalty earn ────────────────
    if (action === 'mark_paid' && body.id) {
      const { data: inv, error } = await supabase
        .from('customer_invoices')
        .select('*')
        .eq('id', Number(body.id))
        .eq('profile_id', companyId)
        .maybeSingle();
      if (error || !inv) {
        return NextResponse.json({ error: error?.message || 'Invoice not found' }, { status: 404 });
      }
      const total = Number(inv.total_amount || 0);
      const prevPaid = Number(inv.amount_paid || 0);
      // amount_paid = absolute total paid; amount_delta = add this payment
      let paid = Number(
        body.amount_paid != null
          ? body.amount_paid
          : body.amount_delta != null
            ? prevPaid + Number(body.amount_delta)
            : total
      );
      if (!Number.isFinite(paid) || paid < 0) paid = 0;
      if (total > 0 && paid > total * 1.001) paid = total;
      const eps = Math.max(0.01, total * 0.001);
      const fullyPaid = total <= 0 ? paid > 0 : paid >= total - eps;
      const nextStatus = fullyPaid
        ? 'paid'
        : paid > 0
          ? 'partial'
          : String(inv.status || 'sent');
      const paymentRef =
        body.payment_reference != null
          ? String(body.payment_reference).trim().slice(0, 200)
          : '';
      const thisPayment = Math.max(0, paid - prevPaid);
      // Audit trail: append payment line to notes (no migration required)
      let notesOut = inv.notes != null ? String(inv.notes) : '';
      if (paymentRef || thisPayment > 0) {
        const line = [
          `[payment ${now.slice(0, 10)}]`,
          thisPayment > 0
            ? `+${thisPayment.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
            : null,
          `total_paid=${paid.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
          paymentRef ? `ref=${paymentRef}` : null,
          nextStatus,
        ]
          .filter(Boolean)
          .join(' ');
        notesOut = notesOut ? `${notesOut}\n${line}` : line;
      }
      const updatePayload: Record<string, unknown> = {
        status: nextStatus,
        amount_paid: paid,
        paid_at: fullyPaid ? now : inv.paid_at || null,
        updated_at: now,
        notes: notesOut || null,
      };
      if (paymentRef) {
        updatePayload.payment_reference = paymentRef;
      }
      // Clear promise when fully paid
      if (fullyPaid) {
        updatePayload.promise_to_pay_date = null;
      }
      let { data: updated, error: uErr } = await supabase
        .from('customer_invoices')
        .update(updatePayload)
        .eq('id', inv.id)
        .select('*')
        .single();
      // Soft: optional columns may be absent
      if (
        uErr &&
        /payment_reference|promise_to_pay|column|schema cache/i.test(
          uErr.message || ''
        )
      ) {
        delete updatePayload.payment_reference;
        delete updatePayload.promise_to_pay_date;
        const retry = await supabase
          .from('customer_invoices')
          .update(updatePayload)
          .eq('id', inv.id)
          .select('*')
          .single();
        updated = retry.data;
        uErr = retry.error;
      }
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

      // First-class AR ledger row (soft if migration not applied)
      if (thisPayment > 0) {
        try {
          const { recordArPayment } = await import('@/lib/customers/ar-ledger');
          await recordArPayment({
            profile_id: companyId,
            invoice_id: Number(inv.id),
            customer_id: inv.customer_id ? Number(inv.customer_id) : null,
            amount: thisPayment,
            currency: String(inv.currency || 'ZAR'),
            paid_at: now,
            method: body.payment_method
              ? String(body.payment_method).slice(0, 40)
              : 'manual',
            reference: paymentRef || null,
            proof_url: body.proof_url
              ? String(body.proof_url).slice(0, 500)
              : null,
            notes: body.payment_notes
              ? String(body.payment_notes).slice(0, 500)
              : null,
            created_by: _gate.userId || null,
          });
        } catch {
          /* ledger optional */
        }
      }

      // Loyalty points
      if (inv.customer_id) {
        const points = Math.floor(paid * LOYALTY_EARN_RATE);
        if (points > 0) {
          let { data: acct } = await supabase
            .from('loyalty_accounts')
            .select('*')
            .eq('profile_id', companyId)
            .eq('customer_id', inv.customer_id)
            .maybeSingle();
          if (!acct) {
            const created = await supabase
              .from('loyalty_accounts')
              .insert({
                profile_id: companyId,
                customer_id: inv.customer_id,
                points_balance: 0,
                lifetime_earned: 0,
                lifetime_redeemed: 0,
                tier: 'bronze',
              })
              .select('*')
              .single();
            acct = created.data;
          }
          if (acct) {
            const balance = Number(acct.points_balance || 0) + points;
            const lifetime = Number(acct.lifetime_earned || 0) + points;
            const tier = tierFromLifetime(lifetime);
            await supabase
              .from('loyalty_accounts')
              .update({
                points_balance: balance,
                lifetime_earned: lifetime,
                tier,
                updated_at: now,
              })
              .eq('id', acct.id);
            await supabase.from('loyalty_transactions').insert({
              profile_id: companyId,
              loyalty_account_id: acct.id,
              customer_id: inv.customer_id,
              txn_type: 'earn',
              points,
              balance_after: balance,
              reference_type: 'invoice',
              reference_id: String(inv.id),
              notes: `Earn on ${inv.invoice_number}`,
            });
          }
        }
      }

      // Soft-fail mutual rating prompts only when fully paid (not partial)
      let buyerProfileId: number | null = null;
      if (
        fullyPaid &&
        String(inv.status || '').toLowerCase() !== 'paid' &&
        inv.customer_id
      ) {
        const customer = await loadCustomer(supabase, Number(inv.customer_id));
        const linked = Number(customer?.linked_profile_id);
        buyerProfileId =
          Number.isFinite(linked) && linked > 0 ? linked : null;
        void promptAfterInvoicePaid({
          sellerProfileId: companyId,
          customerLinkedProfileId: buyerProfileId,
          customerName:
            inv.customer_name ||
            customer?.trading_name ||
            customer?.legal_name ||
            customer?.company_name ||
            null,
          invoiceId: Number(inv.id),
          userId: null,
        }).catch(() => undefined);
      }

      // Soft: sync linked purchase order → paid only when fully paid
      let poMarkedPaid: number | null = null;
      if (fullyPaid) {
        try {
          const sourcePo = Number(
            (inv as { source_po_id?: unknown }).source_po_id
          );
          if (Number.isFinite(sourcePo) && sourcePo > 0) {
            const { error: poErr } = await supabase
              .from('purchase_orders')
              .update({ status: 'paid', updated_at: now })
              .eq('id', sourcePo)
              .or(
                `supplier_profile_id.eq.${companyId},supplier_id.eq.${companyId}`
              );
            if (!poErr) poMarkedPaid = sourcePo;
          } else {
            const { data: byInv } = await supabase
              .from('purchase_orders')
              .select('id')
              .eq('invoice_id', inv.id)
              .or(
                `supplier_profile_id.eq.${companyId},supplier_id.eq.${companyId}`
              )
              .limit(1)
              .maybeSingle();
            if (byInv?.id) {
              const { error: poErr } = await supabase
                .from('purchase_orders')
                .update({ status: 'paid', updated_at: now })
                .eq('id', byInv.id);
              if (!poErr) poMarkedPaid = Number(byInv.id);
            }
          }
        } catch {
          /* soft */
        }
      }

      // Soft: notify on-platform buyer + rate CTAs (full pay only)
      if (buyerProfileId && fullyPaid) {
        void (async () => {
          try {
            const { data: sellerProf } = await supabase
              .from('profiles')
              .select('trading_name')
              .eq('id', companyId)
              .maybeSingle();
            const sellerName = sellerProf?.trading_name || 'Your supplier';
            const invNum = String(inv.invoice_number || inv.id);
            const { notifyInvoicePaidToBuyer } = await import(
              '@/lib/notifications/email-alerts'
            );
            await notifyInvoicePaidToBuyer({
              buyerProfileId,
              sellerName,
              sellerProfileId: companyId,
              invoiceId: Number(inv.id),
              invoiceNumber: invNum,
              totalAmount: paid,
              currency: String(inv.currency || 'ZAR'),
              poId: poMarkedPaid,
            });
            void supabase.from('notifications').insert({
              profile_id: buyerProfileId,
              type: 'invoice_paid',
              title: `Invoice ${invNum} marked paid`,
              body: `${sellerName} recorded payment — rate this partner to close the trust loop`,
              metadata: {
                invoiceId: inv.id,
                poId: poMarkedPaid,
                sellerProfileId: companyId,
                href: `/dashboard/suppliers/ratings?ratee=${companyId}${
                  poMarkedPaid ? `&fromPo=${poMarkedPaid}` : ''
                }`,
                docsHref: `/dashboard/buyer/documents?invoiceId=${inv.id}&supplierProfileId=${companyId}`,
                otifefHref: poMarkedPaid
                  ? `/dashboard/suppliers/po?po=${poMarkedPaid}`
                  : '/dashboard/suppliers/po',
              },
              read: false,
            });
            // Seller in-app rate nudge
            void supabase.from('notifications').insert({
              profile_id: companyId,
              type: 'rate_after_paid',
              title: `Rate buyer after invoice ${invNum}`,
              body: 'Payment recorded — leave a peer rating',
              metadata: {
                invoiceId: inv.id,
                href: buyerProfileId
                  ? `/dashboard/customers/ratings?ratee=${buyerProfileId}`
                  : '/dashboard/customers/ratings',
              },
              read: false,
            });
          } catch (e) {
            console.warn('mark_paid buyer notify soft-fail', e);
          }
        })();
      }

      return NextResponse.json({
        success: true,
        invoice: updated,
        action: 'mark_paid',
        status: nextStatus,
        fullyPaid,
        amountPaid: paid,
        totalAmount: total,
        balanceDue: Math.max(0, total - paid),
        paymentReference: paymentRef || null,
        poMarkedPaid,
        ratingPrompted: Boolean(buyerProfileId && fullyPaid),
      });
    }

    // ── Create ─────────────────────────────────────────────────────────────
    const items = normalizeItems(body.items);
    if (!items.length) {
      return NextResponse.json({ error: 'Add at least one line item (product or service)' }, { status: 400 });
    }

    // Double-invoice guard: same source PO → one invoice per company
    if (kind === 'invoice') {
      const sourcePoId = body.source_po_id != null ? Number(body.source_po_id) : NaN;
      if (Number.isFinite(sourcePoId) && sourcePoId > 0) {
        const { data: byCol } = await supabase
          .from('customer_invoices')
          .select('id, invoice_number, status, source_po_id, notes')
          .eq('profile_id', companyId)
          .eq('source_po_id', sourcePoId)
          .limit(1)
          .maybeSingle();
        if (byCol?.id) {
          return NextResponse.json(
            {
              error: `Invoice already exists for PO #${sourcePoId}`,
              code: 'DUPLICATE_FROM_PO',
              existing: byCol,
            },
            { status: 409 }
          );
        }
        // Fallback while source_po_id migration may not be applied: notes marker
        const marker = `From purchase order #${sourcePoId}`;
        const { data: byNotes } = await supabase
          .from('customer_invoices')
          .select('id, invoice_number, status, notes')
          .eq('profile_id', companyId)
          .ilike('notes', `%${marker}%`)
          .limit(1)
          .maybeSingle();
        if (byNotes?.id) {
          return NextResponse.json(
            {
              error: `Invoice already exists for PO #${sourcePoId}`,
              code: 'DUPLICATE_FROM_PO',
              existing: byNotes,
            },
            { status: 409 }
          );
        }
      }
    }

    const taxRate = body.tax_rate != null ? Number(body.tax_rate) : 15;
    const totals = calcDocTotals(items, taxRate);
    const customer = await loadCustomer(
      supabase,
      body.customer_id ? Number(body.customer_id) : null
    );

    // Soft credit limit for commercial docs (invoice / order / quote)
    const custIdForCredit = body.customer_id ? Number(body.customer_id) : NaN;
    if (
      Number.isFinite(custIdForCredit) &&
      custIdForCredit > 0 &&
      ['invoice', 'order', 'quote'].includes(kind)
    ) {
      try {
        const { checkCustomerCreditLimit, recordCreditOverride } = await import(
          '@/lib/customers/credit-limit'
        );
        const credit = await checkCustomerCreditLimit(supabase, {
          companyId,
          customerId: custIdForCredit,
          additionalAmount: Number(totals.total_amount || 0),
        });
        if (!credit.ok) {
          const isHold = credit.code === 'CREDIT_HOLD';
          const allowOverride =
            body.forceCredit === true || body.acknowledgeCredit === true;
          if (isHold && !body.forceCreditHold) {
            return NextResponse.json(
              {
                error: `Customer is on credit hold after repeated overrides. Clear hold on the customer profile before trading.`,
                code: 'CREDIT_HOLD',
                creditHold: true,
                overrideCount: credit.overrideCount,
              },
              { status: 409 }
            );
          }
          if (!allowOverride) {
            return NextResponse.json(
              {
                error: `Credit limit exceeded for ${credit.customerName || 'customer'} (limit ${credit.creditLimit.toLocaleString()}, open ${credit.openBalance.toLocaleString()}, this doc would reach ${credit.projected.toLocaleString()}).`,
                code: 'OVER_CREDIT_LIMIT',
                creditLimit: credit.creditLimit,
                openBalance: credit.openBalance,
                projected: credit.projected,
                overBy: credit.overBy,
                overrideCount: credit.overrideCount,
                hint: 'Raise the credit limit, collect payment, or resubmit with acknowledgeCredit: true to override (3 overrides → credit hold).',
              },
              { status: 409 }
            );
          }
          // Record override toward auto-hold
          await recordCreditOverride(supabase, {
            companyId,
            customerId: custIdForCredit,
          });
        }
      } catch (e) {
        console.warn('credit check soft-fail', e);
      }
    }

    const payload = buildPayload(kind, body, companyId, items, totals, customer);

    const inserted = await insertDocTolerant(supabase, table, payload);
    if (!inserted.ok) {
      return NextResponse.json(
        {
          error: inserted.error,
          hint:
            /contact_phone/i.test(inserted.error)
              ? 'Run supabase/migrations/20260713_customer_invoices_contact_phone.sql in Supabase SQL Editor'
              : 'Run 20260709_crm_sales_lifecycle.sql',
        },
        { status: 500 }
      );
    }

    const goldenPath = await import('@/lib/onboarding/checklist').then(
      ({ markOnboardingSteps }) => markOnboardingSteps(companyId, 'first_trade')
    );

    // fromPo create: mark purchase_orders status=invoiced + auto-share with buyer when possible
    let poMarkedInvoiced: number | null = null;
    let invoiceSharedToBuyer = false;
    let buyerNotified = false;
    let buyerEmailRecipients = 0;
    let documentOut = inserted.data as Record<string, unknown>;
    if (kind === 'invoice') {
      const sourcePoId =
        body.source_po_id != null
          ? Number(body.source_po_id)
          : Number(documentOut?.source_po_id);
      if (Number.isFinite(sourcePoId) && sourcePoId > 0) {
        try {
          const invId = Number(documentOut?.id);
          const patch: Record<string, unknown> = {
            status: 'invoiced',
            updated_at: now,
          };
          // invoice_id on PO is optional — strip if column missing via soft retry
          if (Number.isFinite(invId) && invId > 0) {
            patch.invoice_id = invId;
          }
          let { error: poErr } = await supabase
            .from('purchase_orders')
            .update(patch)
            .eq('id', sourcePoId)
            .or(
              `supplier_profile_id.eq.${companyId},supplier_id.eq.${companyId}`
            );
          if (poErr && /invoice_id|column/i.test(poErr.message || '')) {
            const retry = await supabase
              .from('purchase_orders')
              .update({ status: 'invoiced', updated_at: now })
              .eq('id', sourcePoId)
              .or(
                `supplier_profile_id.eq.${companyId},supplier_id.eq.${companyId}`
              );
            poErr = retry.error;
          }
          if (!poErr) poMarkedInvoiced = sourcePoId;

          // Auto-share so buyer can open ?invoiceId= (still draft until seller emails)
          const custId = Number(
            documentOut?.customer_id ?? body.customer_id ?? 0
          );
          if (Number.isFinite(invId) && invId > 0 && custId > 0) {
            try {
              const notSuspended = await assertSellerCustomerNotSuspended(
                companyId,
                custId
              );
              if (notSuspended.ok) {
                const { data: sharedRow, error: shareErr } = await supabase
                  .from('customer_invoices')
                  .update({ visibility: 'shared', updated_at: now })
                  .eq('id', invId)
                  .eq('profile_id', companyId)
                  .select('*')
                  .maybeSingle();
                if (!shareErr && sharedRow) {
                  invoiceSharedToBuyer = true;
                  documentOut = sharedRow as Record<string, unknown>;
                } else if (shareErr && /visibility|column/i.test(shareErr.message || '')) {
                  /* column missing — soft */
                }
              }
            } catch {
              /* soft */
            }
          }

          // Notify buyer that PO was invoiced (await so API can report status)
          if (poMarkedInvoiced) {
            try {
              const { data: poRow } = await supabase
                .from('purchase_orders')
                .select('id, buyer_profile_id')
                .eq('id', sourcePoId)
                .maybeSingle();
              const buyerId = Number(poRow?.buyer_profile_id);
              if (Number.isFinite(buyerId) && buyerId > 0) {
                const { data: sellerProf } = await supabase
                  .from('profiles')
                  .select('trading_name')
                  .eq('id', companyId)
                  .maybeSingle();
                const inv = documentOut;
                const invIdNotify = Number(inv?.id) || invId || null;
                const { notifyPoInvoiced } = await import(
                  '@/lib/notifications/email-alerts'
                );
                const mail = await notifyPoInvoiced({
                  buyerProfileId: buyerId,
                  supplierName: sellerProf?.trading_name || null,
                  supplierProfileId: companyId,
                  poId: sourcePoId,
                  invoiceId: invIdNotify,
                  invoiceNumber: inv?.invoice_number
                    ? String(inv.invoice_number)
                    : null,
                  totalAmount:
                    inv?.total_amount != null
                      ? Number(inv.total_amount)
                      : null,
                  currency: inv?.currency ? String(inv.currency) : null,
                  shared: invoiceSharedToBuyer,
                });
                buyerNotified = true;
                buyerEmailRecipients = mail.recipients;
                void supabase.from('notifications').insert({
                  profile_id: buyerId,
                  type: 'po_invoiced',
                  title: `Invoice raised for PO #${sourcePoId}`,
                  body: invoiceSharedToBuyer
                    ? `${sellerProf?.trading_name || 'Supplier'} invoiced your PO — open shared documents`
                    : `${sellerProf?.trading_name || 'Supplier'} invoiced your purchase order`,
                  metadata: {
                    poId: sourcePoId,
                    invoiceId: invIdNotify,
                    shared: invoiceSharedToBuyer,
                    emailed: mail.emailed,
                    supplierProfileId: companyId,
                    href: invIdNotify
                      ? `/dashboard/buyer/documents?invoiceId=${invIdNotify}&supplierProfileId=${companyId}`
                      : `/dashboard/buyer/documents?supplierProfileId=${companyId}`,
                    otifefHref: `/dashboard/suppliers/po?po=${sourcePoId}`,
                    rateHref: `/dashboard/suppliers/ratings?ratee=${companyId}&fromPo=${sourcePoId}`,
                  },
                  read: false,
                });
                void import('@/lib/push/web-push').then(({ notifyPoInvoicedPush }) =>
                  notifyPoInvoicedPush({
                    buyerProfileId: buyerId,
                    supplierName: sellerProf?.trading_name || null,
                    poId: sourcePoId,
                    invoiceId: invIdNotify,
                    invoiceNumber: inv?.invoice_number
                      ? String(inv.invoice_number)
                      : null,
                  })
                );
              }
            } catch (e) {
              console.warn('PO invoiced notify soft-fail', e);
            }
          }
        } catch {
          /* soft */
        }
      }
    }

    return NextResponse.json({
      success: true,
      document: documentOut,
      type: kind,
      goldenPath,
      poMarkedInvoiced,
      invoiceSharedToBuyer,
      buyerNotified,
      buyerEmailRecipients,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/** Insert; on missing-column schema errors strip the column and retry (up to 6 times). */
async function insertDocTolerant(
  supabase: ReturnType<typeof getSupabaseServer>,
  table: string,
  payload: Record<string, unknown>
): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string }
> {
  let row = { ...payload };
  let lastError = '';

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await supabase
      .from(table)
      .insert(row)
      .select('*')
      .single();

    if (!error && data) {
      return { ok: true, data: data as Record<string, unknown> };
    }

    lastError = error?.message || 'Insert failed';
    // e.g. Could not find the 'contact_phone' column of 'customer_invoices' in the schema cache
    const m =
      /'([^']+)' column/i.exec(lastError) ||
      /column [\"']?([a-z0-9_]+)[\"']?/i.exec(lastError);
    if (
      m?.[1] &&
      row[m[1]] !== undefined &&
      /column|schema cache|does not exist|could not find/i.test(lastError)
    ) {
      delete row[m[1]];
      continue;
    }
    break;
  }

  return { ok: false, error: lastError };
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const kind = kindOf(request, body);
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const supabase = getSupabaseServer();
    const table = TABLES[kind];
    const docId = Number(body.id);
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.customer_id !== undefined) updates.customer_id = body.customer_id;
    if (body.valid_until !== undefined) updates.valid_until = body.valid_until;
    if (body.promised_date !== undefined) updates.promised_date = body.promised_date;
    if (body.due_date !== undefined) updates.due_date = body.due_date;
    if (body.terms !== undefined) updates.terms = body.terms;

    if (body.items !== undefined) {
      const items = normalizeItems(body.items);
      const taxRate = body.tax_rate != null ? Number(body.tax_rate) : 15;
      const totals = calcDocTotals(items, taxRate);
      updates.items = items;
      Object.assign(updates, totals);
    }

    // Share-related fields: visibility and/or customer reassignment while shared.
    // New share + reassignment while shared → membership + suspend check.
    // Unshare (seller_only) always allowed without suspend gate.
    const changingVisibility = body.visibility !== undefined;
    const changingCustomer = body.customer_id !== undefined;

    if (changingVisibility || changingCustomer) {
      const companyId = Number(body.companyId);
      // Load existing (scoped when companyId present)
      let existingQ = supabase
        .from(table)
        .select('id, profile_id, customer_id, visibility')
        .eq('id', docId);
      if (Number.isFinite(companyId) && companyId > 0) {
        existingQ = existingQ.eq('profile_id', companyId);
      }
      const { data: existing, error: loadErr } = await existingQ.maybeSingle();
      if (loadErr) {
        return NextResponse.json({ error: loadErr.message }, { status: 500 });
      }
      if (!existing) {
        return NextResponse.json({ error: 'Document not found for this company' }, { status: 404 });
      }

      const wasShared = (existing.visibility || 'seller_only') === 'shared';
      const nextVisibility = changingVisibility
        ? body.visibility === 'shared' || body.visibility === true
          ? 'shared'
          : 'seller_only'
        : wasShared
          ? 'shared'
          : 'seller_only';
      // Prefer body.customer_id when present (align with contracts share path)
      const nextCustomerId = Number(
        body.customer_id !== undefined ? body.customer_id : existing.customer_id
      );
      const customerChanged =
        changingCustomer &&
        Number(body.customer_id || 0) !== Number(existing.customer_id || 0);
      const willBeShared = nextVisibility === 'shared';

      // Auth when becoming shared, re-asserting shared, or reassigning customer while shared
      const needsShareAuth =
        willBeShared &&
        (changingVisibility || // explicit visibility write to shared (or re-assert)
          (wasShared && customerChanged));

      if (needsShareAuth) {
        if (!Number.isFinite(companyId) || companyId <= 0) {
          return NextResponse.json(
            { error: 'companyId required when sharing or reassigning a shared document' },
            { status: 400 }
          );
        }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
        const member = await assertCustomersAccess(body.privyUserId, companyId, 'write');
        if (!member.ok) {
          return NextResponse.json({ error: member.error }, { status: member.status });
        }
        if (!Number.isFinite(nextCustomerId) || nextCustomerId <= 0) {
          return NextResponse.json(
            { error: 'Assign a customer before sharing this document with the buyer' },
            { status: 400 }
          );
        }
        const notSuspended = await assertSellerCustomerNotSuspended(companyId, nextCustomerId);
        if (!notSuspended.ok) {
          return NextResponse.json(
            { error: notSuspended.error },
            { status: notSuspended.status }
          );
        }
      } else if (changingVisibility && nextVisibility === 'seller_only') {
        // Unshare: membership when companyId/privy provided (tighten access while suspended OK)
        if (Number.isFinite(companyId) && companyId > 0) {
          const member = await assertCustomersAccess(body.privyUserId, companyId, 'write');
          if (!member.ok) {
            return NextResponse.json({ error: member.error }, { status: member.status });
          }
        }
      }

      if (changingVisibility) {
        updates.visibility = nextVisibility;
      }
    }

    let q = supabase.from(table).update(updates).eq('id', docId);
    // Scope ownership when companyId provided (required for share; optional for other fields)
    if (body.companyId != null && Number.isFinite(Number(body.companyId))) {
      q = q.eq('profile_id', Number(body.companyId));
    }

    const { data, error } = await q.select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, document: data, type: kind });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const kind = kindOf(request);
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const supabase = getSupabaseServer();
    const { error } = await supabase.from(TABLES[kind]).delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
