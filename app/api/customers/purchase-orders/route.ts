import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';
import {
  isSellerTransitionAllowed,
  SELLER_PO_TRANSITIONS,
} from '@/lib/procurement/types';

/**
 * GET /api/customers/purchase-orders?companyId=&privyUserId=
 * Seller inbound list: POs where this company is the supplier.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const status = request.nextUrl.searchParams.get('status');

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    const member = await assertCompanyMember(privyUserId, companyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();

    // Dual column match: supplier_profile_id OR supplier_id
    let query = supabase
      .from('purchase_orders')
      .select('*')
      .or(`supplier_profile_id.eq.${companyId},supplier_id.eq.${companyId}`)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('GET customers purchase-orders:', error);
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
 * PATCH /api/customers/purchase-orders
 * Seller status transitions for inbound POs.
 * Body: { companyId, privyUserId, id, status: 'accepted'|'paid'|'completed'|'cancelled' }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    const privyUserId = body.privyUserId;
    const nextStatus = String(body.status || '').toLowerCase().trim();

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (!nextStatus) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const member = await assertCompanyMember(privyUserId, companyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();
    const { data: po, error: loadErr } = await supabase
      .from('purchase_orders')
      .select('id, supplier_profile_id, supplier_id, status, buyer_profile_id')
      .eq('id', id)
      .maybeSingle();

    if (loadErr) {
      console.error('PATCH customers PO load:', loadErr);
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const supplierProfileId = Number(po.supplier_profile_id ?? 0);
    const supplierId = Number(po.supplier_id ?? 0);
    if (supplierProfileId !== companyId && supplierId !== companyId) {
      return NextResponse.json(
        { error: 'You are not the supplier on this purchase order' },
        { status: 403 }
      );
    }

    const current = String(po.status || '');
    if (!isSellerTransitionAllowed(current, nextStatus)) {
      return NextResponse.json(
        {
          error: `Invalid transition: ${current} → ${nextStatus}`,
          allowed: SELLER_PO_TRANSITIONS[current] || [],
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: nextStatus,
      updated_at: now,
    };

    // paid / completed / cancelled close the PO when column exists
    if (nextStatus === 'paid' || nextStatus === 'completed' || nextStatus === 'cancelled') {
      updates.closed_at = now;
    }
    if (nextStatus === 'accepted') {
      updates.approved_at = now;
      updates.approved_by = member.userId;
    }

    let { data, error } = await supabase
      .from('purchase_orders')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      const retry = await supabase
        .from('purchase_orders')
        .update({ status: nextStatus, updated_at: now })
        .eq('id', id)
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: member.userId,
      action: `po.status.${nextStatus}`,
      entity_type: 'purchase_order',
      entity_id: String(id),
      summary: `Seller set PO #${id} ${current} → ${nextStatus}`,
      metadata: {
        from: current,
        to: nextStatus,
        buyer_profile_id: po.buyer_profile_id,
      },
    });

    return NextResponse.json({ success: true, purchaseOrder: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
