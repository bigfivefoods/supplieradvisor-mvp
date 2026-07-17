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

      // Soft-fail mutual rating prompts (seller↔buyer) when customer is on-platform
      if (String(inv.status || '').toLowerCase() !== 'paid' && inv.customer_id) {
        const customer = await loadCustomer(supabase, Number(inv.customer_id));
        const linked = Number(customer?.linked_profile_id);
        void promptAfterInvoicePaid({
          sellerProfileId: companyId,
          customerLinkedProfileId: Number.isFinite(linked) && linked > 0 ? linked : null,
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

      return NextResponse.json({ success: true, invoice: updated, action: 'mark_paid' });
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

    // fromPo create: mark purchase_orders status=invoiced (soft — column/status may vary)
    let poMarkedInvoiced: number | null = null;
    if (kind === 'invoice') {
      const sourcePoId =
        body.source_po_id != null
          ? Number(body.source_po_id)
          : Number(
              (inserted.data as { source_po_id?: unknown } | null)?.source_po_id
            );
      if (Number.isFinite(sourcePoId) && sourcePoId > 0) {
        try {
          const invId = Number(
            (inserted.data as { id?: unknown } | null)?.id
          );
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

          // Soft: notify buyer that PO was invoiced
          if (poMarkedInvoiced) {
            void (async () => {
              try {
                const { data: poRow } = await supabase
                  .from('purchase_orders')
                  .select('id, buyer_profile_id')
                  .eq('id', sourcePoId)
                  .maybeSingle();
                const buyerId = Number(poRow?.buyer_profile_id);
                if (!Number.isFinite(buyerId) || buyerId <= 0) return;
                const { data: sellerProf } = await supabase
                  .from('profiles')
                  .select('trading_name')
                  .eq('id', companyId)
                  .maybeSingle();
                const inv = inserted.data as {
                  id?: unknown;
                  invoice_number?: unknown;
                  total_amount?: unknown;
                  currency?: unknown;
                } | null;
                const { notifyPoInvoiced } = await import(
                  '@/lib/notifications/email-alerts'
                );
                await notifyPoInvoiced({
                  buyerProfileId: buyerId,
                  supplierName: sellerProf?.trading_name || null,
                  poId: sourcePoId,
                  invoiceId: Number(inv?.id) || invId || null,
                  invoiceNumber: inv?.invoice_number
                    ? String(inv.invoice_number)
                    : null,
                  totalAmount:
                    inv?.total_amount != null
                      ? Number(inv.total_amount)
                      : null,
                  currency: inv?.currency ? String(inv.currency) : null,
                });
                const invIdNotify = Number(inv?.id) || invId || null;
                void supabase.from('notifications').insert({
                  profile_id: buyerId,
                  type: 'po_invoiced',
                  title: `Invoice raised for PO #${sourcePoId}`,
                  body: `${sellerProf?.trading_name || 'Supplier'} invoiced your purchase order`,
                  metadata: {
                    poId: sourcePoId,
                    invoiceId: invIdNotify,
                    href: invIdNotify
                      ? `/dashboard/buyer/documents?invoiceId=${invIdNotify}`
                      : '/dashboard/buyer/documents',
                  },
                  read: false,
                });
              } catch (e) {
                console.warn('PO invoiced notify soft-fail', e);
              }
            })();
          }
        } catch {
          /* soft */
        }
      }
    }

    return NextResponse.json({
      success: true,
      document: inserted.data,
      type: kind,
      goldenPath,
      poMarkedInvoiced,
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
