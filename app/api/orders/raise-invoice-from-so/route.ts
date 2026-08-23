import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';
import {
  calcDocTotals,
  docNumber,
  normalizeItems,
} from '@/lib/customers/documents';

/**
 * POST /api/orders/raise-invoice-from-so
 * Raise a customer invoice from a Sales Order and stamp source_order_id.
 * Mirrors convert_to_invoice with explicit chain fields.
 *
 * Body: { companyId, privyUserId, salesOrderId, status?, due_date?, acknowledgeCredit? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyId = Number(body.companyId);
    const salesOrderId = Number(body.salesOrderId);
    const privyUserId = body.privyUserId as string | undefined;

    if (!companyId || !salesOrderId || !privyUserId) {
      return NextResponse.json(
        { error: 'companyId, salesOrderId and privyUserId are required' },
        { status: 400 }
      );
    }

    const mem = await assertCompanyMember(privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();

    const { data: order, error: soErr } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('id', salesOrderId)
      .eq('profile_id', companyId)
      .maybeSingle();

    if (soErr || !order) {
      return NextResponse.json(
        { error: soErr?.message || 'Sales order not found' },
        { status: 404 }
      );
    }

    // Guard: already has an invoice linked
    if (order.invoice_id) {
      const { data: existing } = await supabase
        .from('customer_invoices')
        .select('id, invoice_number, status')
        .eq('id', Number(order.invoice_id))
        .maybeSingle();
      if (existing?.id) {
        return NextResponse.json(
          {
            error: `Invoice already exists for this SO (${existing.invoice_number || existing.id})`,
            code: 'DUPLICATE_FROM_SO',
            existing,
          },
          { status: 409 }
        );
      }
    }

    const items = normalizeItems(order.items);
    if (!items.length) {
      return NextResponse.json(
        { error: 'Sales order has no line items to invoice' },
        { status: 400 }
      );
    }
    const totals = calcDocTotals(items, Number(order.tax_rate ?? 15));

    // Credit check (soft same as docs route)
    const orderCustId = order.customer_id ? Number(order.customer_id) : 0;
    if (orderCustId > 0 && body.forceCreditHold !== true) {
      try {
        const { checkCustomerCreditLimit, recordCreditOverride } = await import(
          '@/lib/customers/credit-limit'
        );
        const credit = await checkCustomerCreditLimit(supabase, {
          companyId,
          customerId: orderCustId,
          additionalAmount: Number(totals.total_amount || 0),
        });
        if (!credit.ok) {
          if (credit.code === 'CREDIT_HOLD') {
            return NextResponse.json(
              {
                error: 'Customer is on credit hold',
                code: 'CREDIT_HOLD',
              },
              { status: 409 }
            );
          }
          const allow =
            body.forceCredit === true || body.acknowledgeCredit === true;
          if (!allow) {
            return NextResponse.json(
              {
                ...credit,
                error: `Credit limit exceeded`,
                code: 'OVER_CREDIT_LIMIT',
              },
              { status: 409 }
            );
          }
          await recordCreditOverride(supabase, {
            companyId,
            customerId: orderCustId,
          });
        }
      } catch {
        /* soft */
      }
    }

    const due = new Date();
    due.setDate(due.getDate() + 30);
    const dueDate = body.due_date || due.toISOString().slice(0, 10);
    const invStatus = body.status === 'draft' ? 'draft' : 'sent';

    const invPayload: Record<string, unknown> = {
      profile_id: companyId,
      customer_id: order.customer_id,
      order_id: order.id,
      source_order_id: order.id,
      quote_id: order.quote_id || null,
      invoice_number: docNumber('INV'),
      status: invStatus,
      currency: order.currency || 'ZAR',
      ...totals,
      amount_paid: 0,
      issue_date: now.slice(0, 10),
      due_date: dueDate,
      customer_name: order.customer_name,
      contact_name: order.contact_name,
      contact_email: order.contact_email,
      contact_phone: order.contact_phone,
      billing_address: order.shipping_address,
      notes: order.notes
        ? `${order.notes}\n[from SO ${order.order_number || order.id}]`
        : `[from SO ${order.order_number || order.id}]`,
      items,
      created_by: privyUserId,
      updated_at: now,
    };

    let { data: invoice, error: invErr } = await supabase
      .from('customer_invoices')
      .insert(invPayload)
      .select('*')
      .single();

    // Soft retry without source_order_id if column missing
    if (invErr && /source_order_id|column|schema cache/i.test(invErr.message || '')) {
      delete invPayload.source_order_id;
      const retry = await supabase
        .from('customer_invoices')
        .insert(invPayload)
        .select('*')
        .single();
      invoice = retry.data;
      invErr = retry.error;
    }

    if (invErr || !invoice) {
      return NextResponse.json(
        { error: invErr?.message || 'Failed to create invoice' },
        { status: 500 }
      );
    }

    await supabase
      .from('sales_orders')
      .update({
        status: 'invoiced',
        invoice_id: invoice.id,
        updated_at: now,
      })
      .eq('id', order.id)
      .eq('profile_id', companyId);

    // Soft GL sync
    try {
      const { syncCrmInvoiceToBooks } = await import(
        '@/lib/accounting/crm-invoice-gl'
      );
      await syncCrmInvoiceToBooks({
        profileId: companyId,
        crmInvoice: invoice as Record<string, unknown>,
        createdBy: privyUserId,
      });
    } catch {
      /* soft */
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'invoice.created.from_so',
      entity_type: 'customer_invoices',
      entity_id: String(invoice.id),
      summary: `Invoice ${invoice.invoice_number} raised from SO ${order.order_number || order.id}`,
      metadata: { sales_order_id: salesOrderId, invoice_id: invoice.id },
    });

    return NextResponse.json(
      {
        success: true,
        invoice,
        salesOrderId,
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    console.error('[raise-invoice-from-so]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
