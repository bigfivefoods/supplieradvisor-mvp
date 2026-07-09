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
      body.customer_name || customer?.trading_name || null,
    contact_name: body.contact_name || customer?.contact_name || null,
    contact_email: body.contact_email || customer?.email || null,
    contact_phone: body.contact_phone || customer?.phone || null,
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

    const supabase = getSupabaseServer();
    const table = TABLES[kind];
    const now = new Date().toISOString();

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
      const { data: order, error: oErr } = await supabase
        .from('sales_orders')
        .insert(orderPayload)
        .select('*')
        .single();
      if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

      await supabase
        .from('customer_quotes')
        .update({ status: 'converted', order_id: order.id, updated_at: now })
        .eq('id', quote.id);

      return NextResponse.json({ success: true, order, type: 'order', action: 'convert_to_order' });
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
        billing_address: order.shipping_address,
        notes: order.notes,
        items,
        updated_at: now,
      };
      const { data: invoice, error: iErr } = await supabase
        .from('customer_invoices')
        .insert(invPayload)
        .select('*')
        .single();
      if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

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

    // ── Mark invoice paid + loyalty earn ───────────────────────────────────
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
      const paid = Number(body.amount_paid ?? inv.total_amount);
      const { data: updated, error: uErr } = await supabase
        .from('customer_invoices')
        .update({
          status: 'paid',
          amount_paid: paid,
          paid_at: now,
          updated_at: now,
        })
        .eq('id', inv.id)
        .select('*')
        .single();
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

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

      return NextResponse.json({ success: true, invoice: updated, action: 'mark_paid' });
    }

    // ── Create ─────────────────────────────────────────────────────────────
    const items = normalizeItems(body.items);
    if (!items.length) {
      return NextResponse.json({ error: 'Add at least one line item (product or service)' }, { status: 400 });
    }
    const taxRate = body.tax_rate != null ? Number(body.tax_rate) : 15;
    const totals = calcDocTotals(items, taxRate);
    const customer = await loadCustomer(
      supabase,
      body.customer_id ? Number(body.customer_id) : null
    );
    const payload = buildPayload(kind, body, companyId, items, totals, customer);

    const { data, error } = await supabase.from(table).insert(payload).select('*').single();
    if (error) {
      return NextResponse.json(
        { error: error.message, hint: 'Run 20260709_crm_sales_lifecycle.sql' },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, document: data, type: kind });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const kind = kindOf(request, body);
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const supabase = getSupabaseServer();
    const table = TABLES[kind];
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

    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', Number(body.id))
      .select('*')
      .single();
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
