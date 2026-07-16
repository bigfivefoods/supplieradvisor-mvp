import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  assertCompanyMember,
  assertCustomerConnection,
  logActivity,
} from '@/lib/customers/access';
import {
  BUYER_PO_CANCEL_STATUSES,
  normalizePoItems,
} from '@/lib/procurement/types';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * GET /api/buyer/purchase-orders?buyerCompanyId=&privyUserId=
 * List POs raised by the buyer company.
 */
export async function GET(request: NextRequest) {
  try {
    const buyerCompanyId = Number(request.nextUrl.searchParams.get('buyerCompanyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');

    if (!Number.isFinite(buyerCompanyId) || buyerCompanyId <= 0) {
      return NextResponse.json({ error: 'buyerCompanyId is required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, buyerCompanyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const member = await assertCompanyMember(privyUserId, buyerCompanyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('buyer_profile_id', buyerCompanyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('GET buyer purchase-orders:', error);
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Run supabase/migrations/20260709_customer_purchase_orders.sql',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, purchaseOrders: data || [] });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/buyer/purchase-orders
 * Connected buyer raises a PO against a supplier (customer-type BC).
 * Body: { buyerCompanyId, supplierProfileId, privyUserId, items, description?, currency?, ... }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const buyerCompanyId = Number(body.buyerCompanyId);
    const supplierProfileId = Number(body.supplierProfileId);
    const privyUserId = body.privyUserId;

    if (!Number.isFinite(buyerCompanyId) || buyerCompanyId <= 0) {
      return NextResponse.json({ error: 'buyerCompanyId is required' }, { status: 400 });
    }
    if (!Number.isFinite(supplierProfileId) || supplierProfileId <= 0) {
      return NextResponse.json({ error: 'supplierProfileId is required' }, { status: 400 });
    }

    const member = await assertCompanyMember(privyUserId, buyerCompanyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    // New collaboration — reject suspended connections
    const conn = await assertCustomerConnection(buyerCompanyId, supplierProfileId, {
      allowSuspended: false,
    });
    if (!conn.ok) {
      return NextResponse.json({ error: conn.error }, { status: conn.status });
    }

    const normalized = normalizePoItems(body.items);
    if ('error' in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();

    // Resolve seller CRM customer row for bridge
    let sellerCustomerId: number | null = null;
    const { data: customers, error: custErr } = await supabase
      .from('customers')
      .select('id')
      .eq('profile_id', supplierProfileId)
      .eq('linked_profile_id', buyerCompanyId)
      .in('invite_status', ['accepted', 'suspended'])
      .order('id', { ascending: true })
      .limit(5);

    if (custErr) {
      console.warn('seller_customer_id resolve warning:', custErr.message);
    } else if (customers && customers.length > 0) {
      sellerCustomerId = Number(customers[0].id);
      if (customers.length > 1) {
        console.warn(
          `Multiple customers for seller ${supplierProfileId} / buyer ${buyerCompanyId}; using lowest id ${sellerCustomerId}`
        );
      }
    }

    const computedSum = normalized.total;
    const payload: Record<string, unknown> = {
      buyer_profile_id: buyerCompanyId,
      supplier_profile_id: supplierProfileId,
      supplier_id: supplierProfileId, // legacy dual-write (suppliers/po shape)
      total_amount: computedSum,
      subtotal: computedSum,
      currency: body.currency ? String(body.currency) : 'ZAR',
      description: body.description ? String(body.description) : null,
      items: normalized.items,
      status: 'sent',
      payment_terms: body.payment_terms ? String(body.payment_terms) : null,
      incoterms: body.incoterms ? String(body.incoterms) : null,
      promised_date: body.promised_date ? String(body.promised_date).slice(0, 10) : null,
      seller_customer_id: sellerCustomerId,
      source: 'customer_portal',
      metadata: {
        invitation_connection: true,
        connection_id: conn.connection.id,
        use_escrow: body.useEscrow === true,
      },
      created_at: now,
      updated_at: now,
    };

    let { data, error } = await supabase
      .from('purchase_orders')
      .insert(payload)
      .select('*')
      .single();

    // Retry without newer columns if schema cache is behind
    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      console.warn('PO insert retry without bridge columns:', error.message);
      const minimal = {
        buyer_profile_id: buyerCompanyId,
        supplier_id: supplierProfileId,
        supplier_profile_id: supplierProfileId,
        total_amount: computedSum,
        subtotal: computedSum,
        currency: payload.currency,
        description: payload.description,
        items: normalized.items,
        status: 'sent',
        updated_at: now,
      };
      const retry = await supabase.from('purchase_orders').insert(minimal).select('*').single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('POST buyer purchase-orders insert:', error);
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Run supabase/migrations/20260709_customer_purchase_orders.sql',
        },
        { status: 500 }
      );
    }

    await logActivity({
      profile_id: buyerCompanyId,
      actor_user_id: member.userId,
      action: 'po.created.by_customer',
      entity_type: 'purchase_order',
      entity_id: data?.id != null ? String(data.id) : undefined,
      summary: `Buyer raised PO #${data?.id ?? '?'} against supplier ${supplierProfileId}`,
      metadata: {
        supplier_profile_id: supplierProfileId,
        seller_customer_id: sellerCustomerId,
        total_amount: computedSum,
        source: 'customer_portal',
      },
    });

    // Soft email + push to supplier (inbound PO)
    if (data?.id && supplierProfileId) {
      void (async () => {
        try {
          const { data: buyerProf } = await supabase
            .from('profiles')
            .select('trading_name')
            .eq('id', buyerCompanyId)
            .maybeSingle();
          const buyerName = buyerProf?.trading_name || null;
          const { notifyInboundPo } = await import(
            '@/lib/notifications/email-alerts'
          );
          await notifyInboundPo({
            supplierProfileId,
            buyerProfileId: buyerCompanyId,
            buyerName,
            poId: Number(data.id),
            totalAmount: Number(data.total_amount ?? computedSum),
            currency: String(data.currency || payload.currency || 'ZAR'),
            lineCount: normalized.items.length,
            source: 'customer_portal',
          });
          const { notifyInboundPoPush } = await import('@/lib/push/web-push');
          await notifyInboundPoPush({
            supplierProfileId,
            buyerName,
            poId: Number(data.id),
            totalAmount: Number(data.total_amount ?? computedSum),
            currency: String(data.currency || payload.currency || 'ZAR'),
          });
        } catch (e) {
          console.warn('buyer PO inbound notify soft-fail', e);
        }
      })();
    }

    return NextResponse.json({ success: true, purchaseOrder: data }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/buyer/purchase-orders
 * Buyer cancel of own draft/sent POs.
 * Body: { buyerCompanyId, privyUserId, id, status: 'cancelled' }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const buyerCompanyId = Number(body.buyerCompanyId);
    const id = Number(body.id);
    const privyUserId = body.privyUserId;
    const nextStatus = String(body.status || '').toLowerCase();

    if (!Number.isFinite(buyerCompanyId) || buyerCompanyId <= 0) {
      return NextResponse.json({ error: 'buyerCompanyId is required' }, { status: 400 });
    }
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (nextStatus !== 'cancelled') {
      return NextResponse.json(
        { error: 'Buyers may only set status to cancelled on own draft/sent POs' },
        { status: 400 }
      );
    }

    const member = await assertCompanyMember(privyUserId, buyerCompanyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();
    const { data: po, error: loadErr } = await supabase
      .from('purchase_orders')
      .select('id, buyer_profile_id, status')
      .eq('id', id)
      .maybeSingle();

    if (loadErr) {
      console.error('PATCH buyer PO load:', loadErr);
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }
    if (Number(po.buyer_profile_id) !== buyerCompanyId) {
      return NextResponse.json(
        { error: 'You can only cancel purchase orders owned by your company' },
        { status: 403 }
      );
    }

    const statusAsLoaded = String(po.status ?? '');
    const current = statusAsLoaded.toLowerCase();
    if (!(BUYER_PO_CANCEL_STATUSES as readonly string[]).includes(current)) {
      return NextResponse.json(
        {
          error: `Cannot cancel PO in status "${current}". Only draft/sent may be cancelled by buyer.`,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: 'cancelled',
      updated_at: now,
      closed_at: now,
    };

    // Optimistic concurrency: only cancel if status is still the loaded value
    let { data, error } = await supabase
      .from('purchase_orders')
      .update(updates)
      .eq('id', id)
      .eq('status', statusAsLoaded)
      .select('*')
      .maybeSingle();

    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      const retry = await supabase
        .from('purchase_orders')
        .update({ status: 'cancelled', updated_at: now })
        .eq('id', id)
        .eq('status', statusAsLoaded)
        .select('*')
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        {
          error:
            'Purchase order status changed concurrently. Refresh and try again.',
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, purchaseOrder: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
