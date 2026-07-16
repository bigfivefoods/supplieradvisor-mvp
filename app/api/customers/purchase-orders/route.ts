import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCustomersAccess, logActivity } from '@/lib/customers/access';
import {
  isSellerTransitionAllowed,
  SELLER_PO_TRANSITIONS,
} from '@/lib/procurement/types';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

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

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const member = await assertCustomersAccess(privyUserId, companyId, 'view');
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

    const pos = data || [];
    const buyerIds = [
      ...new Set(
        pos
          .map((p) => Number(p.buyer_profile_id))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];
    const buyerMap: Record<number, string> = {};
    if (buyerIds.length) {
      const { data: buyers } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name')
        .in('id', buyerIds);
      for (const b of buyers || []) {
        buyerMap[Number(b.id)] =
          b.trading_name || b.legal_name || `Buyer ${b.id}`;
      }
    }

    const enriched = pos.map((p) => {
      const items = Array.isArray(p.items) ? p.items : [];
      const bid = Number(p.buyer_profile_id);
      return {
        ...p,
        buyer_name: Number.isFinite(bid) ? buyerMap[bid] || null : null,
        line_count: items.length,
      };
    });

    const counts = {
      total: enriched.length,
      sent: enriched.filter((p) => String(p.status) === 'sent').length,
      accepted: enriched.filter((p) => String(p.status) === 'accepted').length,
      open: enriched.filter((p) =>
        ['sent', 'accepted', 'funded'].includes(String(p.status))
      ).length,
      completed: enriched.filter((p) =>
        ['completed', 'paid'].includes(String(p.status))
      ).length,
      cancelled: enriched.filter((p) => String(p.status) === 'cancelled')
        .length,
    };

    return NextResponse.json({
      success: true,
      purchaseOrders: enriched,
      counts,
    });
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
 * Body: { companyId, privyUserId, id, status?: 'accepted'|'paid'|'completed'|'cancelled',
 *         fulfilmentStatus?: 'preparing'|'shipped'|'ready' }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    const privyUserId = body.privyUserId;
    const nextStatus = body.status
      ? String(body.status || '').toLowerCase().trim()
      : '';
    const fulfilmentStatus = body.fulfilmentStatus
      ? String(body.fulfilmentStatus).toLowerCase().trim()
      : body.fulfilment_status
        ? String(body.fulfilment_status).toLowerCase().trim()
        : '';

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (!nextStatus && !fulfilmentStatus) {
      return NextResponse.json(
        { error: 'status or fulfilmentStatus required' },
        { status: 400 }
      );
    }

    const member = await assertCustomersAccess(privyUserId, companyId, 'write');
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();
    const { data: po, error: loadErr } = await supabase
      .from('purchase_orders')
      .select(
        'id, supplier_profile_id, supplier_id, status, buyer_profile_id, metadata'
      )
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

    const statusAsLoaded = String(po.status ?? '');
    const current = statusAsLoaded.toLowerCase();
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      updated_at: now,
    };

    // Fulfilment cue without full status change (preparing / shipped)
    if (fulfilmentStatus) {
      const allowedFulfil = ['preparing', 'ready', 'shipped'];
      if (!allowedFulfil.includes(fulfilmentStatus)) {
        return NextResponse.json(
          { error: 'fulfilmentStatus must be preparing | ready | shipped' },
          { status: 400 }
        );
      }
      if (!['accepted', 'funded', 'paid'].includes(current)) {
        return NextResponse.json(
          { error: 'Accept the PO before updating fulfilment' },
          { status: 409 }
        );
      }
      const meta =
        po.metadata && typeof po.metadata === 'object' && !Array.isArray(po.metadata)
          ? { ...(po.metadata as Record<string, unknown>) }
          : {};
      meta.fulfilment_status = fulfilmentStatus;
      meta.fulfilment_updated_at = now;
      if (fulfilmentStatus === 'shipped') {
        meta.shipped_at = now;
      }
      updates.metadata = meta;
    }

    if (nextStatus) {
      if (!isSellerTransitionAllowed(current, nextStatus)) {
        return NextResponse.json(
          {
            error: `Invalid transition: ${current} → ${nextStatus}`,
            allowed: SELLER_PO_TRANSITIONS[current] || [],
          },
          { status: 409 }
        );
      }
      updates.status = nextStatus;
      // paid / completed / cancelled close the PO when column exists
      if (nextStatus === 'paid' || nextStatus === 'completed' || nextStatus === 'cancelled') {
        updates.closed_at = now;
      }
      if (nextStatus === 'accepted') {
        updates.approved_at = now;
        updates.approved_by = member.userId;
        const meta =
          (updates.metadata as Record<string, unknown>) ||
          (po.metadata && typeof po.metadata === 'object'
            ? { ...(po.metadata as Record<string, unknown>) }
            : {});
        meta.fulfilment_status = meta.fulfilment_status || 'preparing';
        updates.metadata = meta;
      }
    }

    // Optimistic concurrency: only transition if status is still the loaded value
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
        .update({ status: nextStatus, updated_at: now })
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

    await logActivity({
      profile_id: companyId,
      actor_user_id: member.userId,
      action: nextStatus
        ? `po.status.${nextStatus}`
        : `po.fulfilment.${fulfilmentStatus || 'update'}`,
      entity_type: 'purchase_order',
      entity_id: String(id),
      summary: nextStatus
        ? `Seller set PO #${id} ${current} → ${nextStatus}`
        : `Seller fulfilment PO #${id} → ${fulfilmentStatus}`,
      metadata: {
        from: current,
        to: nextStatus || undefined,
        fulfilmentStatus: fulfilmentStatus || undefined,
        buyer_profile_id: po.buyer_profile_id,
      },
    });

    // Soft email + web push buyer when supplier accepts
    if (nextStatus === 'accepted' && po.buyer_profile_id) {
      void (async () => {
        try {
          const { data: supplierProf } = await supabase
            .from('profiles')
            .select('trading_name')
            .eq('id', companyId)
            .maybeSingle();
          const supplierName = supplierProf?.trading_name || null;
          const { notifyPoAccepted } = await import(
            '@/lib/notifications/email-alerts'
          );
          await notifyPoAccepted({
            buyerProfileId: Number(po.buyer_profile_id),
            supplierName,
            poId: id,
          });
          const { notifyPoAcceptedPush } = await import('@/lib/push/web-push');
          await notifyPoAcceptedPush({
            buyerProfileId: Number(po.buyer_profile_id),
            supplierName,
            poId: id,
          });
        } catch (e) {
          console.warn('PO accepted notify soft-fail', e);
        }
      })();
    }

    // Buyer push when supplier marks ready / shipped
    if (
      fulfilmentStatus &&
      (fulfilmentStatus === 'shipped' || fulfilmentStatus === 'ready') &&
      po.buyer_profile_id
    ) {
      void (async () => {
        try {
          const { data: supplierProf } = await supabase
            .from('profiles')
            .select('trading_name')
            .eq('id', companyId)
            .maybeSingle();
          const { notifyPoFulfilmentPush } = await import('@/lib/push/web-push');
          await notifyPoFulfilmentPush({
            buyerProfileId: Number(po.buyer_profile_id),
            supplierName: supplierProf?.trading_name || null,
            poId: id,
            fulfilmentStatus,
          });
        } catch (e) {
          console.warn('PO fulfilment push soft-fail', e);
        }
      })();
    }

    return NextResponse.json({ success: true, purchaseOrder: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
