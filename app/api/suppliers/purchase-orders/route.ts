import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';
import {
  BUYER_PO_CANCEL_STATUSES,
  isSrmBuyerTransitionAllowed,
  normalizePoItems,
} from '@/lib/procurement/types';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';
import { promptAfterPoDelivered } from '@/lib/ratings/create-prompt';

/**
 * GET ?companyId=&privyUserId=&status=
 * List purchase orders raised by this buyer company (SRM).
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
    const member = await assertCompanyMember(privyUserId, companyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();
    let q = supabase
      .from('purchase_orders')
      .select('*')
      .eq('buyer_profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(300);
    if (status && status !== 'all') q = q.eq('status', status);

    const { data, error } = await q;
    if (error) {
      console.error('GET suppliers purchase-orders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const pos = data || [];
    const supplierIds = [
      ...new Set(
        pos
          .map((p) => Number(p.supplier_profile_id ?? p.supplier_id))
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
    ];
    const nameMap: Record<number, string> = {};
    const walletMap: Record<number, string | null> = {};
    if (supplierIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, trading_name, wallet_address')
        .in('id', supplierIds);
      for (const p of profiles || []) {
        nameMap[Number(p.id)] = p.trading_name || `Supplier ${p.id}`;
        walletMap[Number(p.id)] = p.wallet_address || null;
      }
    }

    const enriched = pos.map((p) => {
      const sid = Number(p.supplier_profile_id ?? p.supplier_id);
      return {
        ...p,
        supplier_name: nameMap[sid] || null,
        supplier_wallet: p.supplier_wallet || walletMap[sid] || null,
      };
    });

    const counts = {
      total: enriched.length,
      draft: enriched.filter((p) => p.status === 'draft').length,
      open: enriched.filter((p) =>
        ['sent', 'accepted', 'funded'].includes(String(p.status))
      ).length,
      completed: enriched.filter((p) =>
        ['completed', 'paid'].includes(String(p.status))
      ).length,
      onchain: enriched.filter((p) => p.onchain_po_id != null && p.onchain_po_id !== '').length,
      cancelled: enriched.filter((p) => p.status === 'cancelled').length,
    };

    return NextResponse.json({ success: true, purchaseOrders: enriched, counts });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST — raise PO against a supplier (book link or platform profile).
 * Body: companyId, privyUserId, supplierProfileId | srmSupplierId, items[], description?,
 *       promised_date?, useEscrow?, supplier_wallet?, currency?, payment_terms?, status?
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const privyUserId = body.privyUserId;
    let supplierProfileId = body.supplierProfileId
      ? Number(body.supplierProfileId)
      : null;
    const srmSupplierId = body.srmSupplierId ? Number(body.srmSupplierId) : null;

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const member = await assertCompanyMember(privyUserId, companyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();
    let srmId: number | null = null;
    let supplierWallet: string | null = body.supplier_wallet
      ? String(body.supplier_wallet).trim()
      : null;

    if (srmSupplierId && Number.isFinite(srmSupplierId)) {
      const { data: srm } = await supabase
        .from('srm_suppliers')
        .select('id, linked_profile_id, trading_name, wallet_address, invite_status, status')
        .eq('id', srmSupplierId)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (!srm) {
        return NextResponse.json({ error: 'Supplier not found in your book' }, { status: 404 });
      }
      if (srm.status === 'blocked') {
        return NextResponse.json({ error: 'Supplier is blocked' }, { status: 403 });
      }
      srmId = Number(srm.id);
      if (srm.linked_profile_id) supplierProfileId = Number(srm.linked_profile_id);
      if (!supplierWallet && srm.wallet_address) supplierWallet = srm.wallet_address;
    }

    if (!supplierProfileId || !Number.isFinite(supplierProfileId)) {
      return NextResponse.json(
        {
          error:
            'supplierProfileId or a linked srmSupplierId is required (connect/invite the supplier first)',
        },
        { status: 400 }
      );
    }

    // Prefer accepted connection in either direction; allow book-only with linked profile
    const { data: connRows } = await supabase
      .from('business_connections')
      .select('id, status, metadata, connection_type')
      .or(
        `and(requester_profile_id.eq.${companyId},requestee_profile_id.eq.${supplierProfileId}),and(requester_profile_id.eq.${supplierProfileId},requestee_profile_id.eq.${companyId})`
      )
      .eq('status', 'accepted')
      .limit(1);
    const conn = connRows?.[0] || null;

    const meta =
      conn?.metadata && typeof conn.metadata === 'object' && !Array.isArray(conn.metadata)
        ? (conn.metadata as Record<string, unknown>)
        : {};
    if (meta.suspended === true || meta.suspended === 'true') {
      return NextResponse.json(
        { error: 'Connection is suspended — cannot raise new POs' },
        { status: 403 }
      );
    }

    const normalized = normalizePoItems(body.items);
    if ('error' in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    // Sum quantities for OTIFEF order_quantity baseline
    const orderQty = normalized.items.reduce((s, i) => s + Number(i.quantity || 0), 0);
    const now = new Date().toISOString();
    const initialStatus =
      body.status === 'draft' ? 'draft' : body.status === 'sent' ? 'sent' : 'sent';

    if (supplierWallet && !/^0x[a-fA-F0-9]{40}$/.test(supplierWallet)) {
      return NextResponse.json(
        { error: 'supplier_wallet must be a valid 0x address' },
        { status: 400 }
      );
    }

    const payload: Record<string, unknown> = {
      buyer_profile_id: companyId,
      supplier_profile_id: supplierProfileId,
      supplier_id: supplierProfileId,
      total_amount: normalized.total,
      subtotal: normalized.total,
      currency: body.currency ? String(body.currency) : 'ZAR',
      description: body.description ? String(body.description) : null,
      items: normalized.items,
      status: initialStatus,
      payment_terms: body.payment_terms ? String(body.payment_terms) : null,
      incoterms: body.incoterms ? String(body.incoterms) : null,
      promised_date: body.promised_date ? String(body.promised_date).slice(0, 10) : null,
      order_quantity: orderQty,
      supplier_wallet: supplierWallet,
      source: 'srm',
      metadata: {
        srm: true,
        srm_supplier_id: srmId,
        connection_id: conn?.id ?? null,
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

    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      console.warn('SRM PO insert retry minimal:', error.message);
      const minimal = {
        buyer_profile_id: companyId,
        supplier_id: supplierProfileId,
        supplier_profile_id: supplierProfileId,
        total_amount: normalized.total,
        description: payload.description,
        items: normalized.items,
        status: initialStatus,
        supplier_wallet: supplierWallet,
        updated_at: now,
      };
      const retry = await supabase.from('purchase_orders').insert(minimal).select('*').single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('POST suppliers purchase-orders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: member.userId,
      action: 'po.created.srm',
      entity_type: 'purchase_order',
      entity_id: data?.id != null ? String(data.id) : undefined,
      summary: `SRM PO #${data?.id ?? '?'} raised against supplier ${supplierProfileId}`,
      metadata: {
        supplier_profile_id: supplierProfileId,
        srm_supplier_id: srmId,
        total_amount: normalized.total,
        use_escrow: body.useEscrow === true,
      },
    });

    const goldenPath = await import('@/lib/onboarding/checklist').then(
      ({ markOnboardingSteps }) => markOnboardingSteps(companyId, 'first_trade')
    );

    return NextResponse.json(
      { success: true, purchaseOrder: data, goldenPath },
      { status: 201 }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH — status transitions + OTIFEF delivery capture.
 * Body: companyId, privyUserId, id, status?, promised_date?, actual_delivery_date?,
 *       delivered_quantity?, damaged_quantity?, order_quantity?, supplier_wallet?
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    const privyUserId = body.privyUserId;

    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const member = await assertCompanyMember(privyUserId, companyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();
    const { data: po, error: loadErr } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .eq('buyer_profile_id', companyId)
      .maybeSingle();

    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const nextStatus = body.status != null ? String(body.status).toLowerCase() : null;

    if (nextStatus) {
      const from = String(po.status || 'draft').toLowerCase();
      if (nextStatus === 'cancelled') {
        if (!(BUYER_PO_CANCEL_STATUSES as readonly string[]).includes(from) && from !== 'accepted') {
          // allow cancel further for SRM except completed
          if (from === 'completed' || from === 'paid') {
            return NextResponse.json(
              { error: 'Cannot cancel a completed PO' },
              { status: 400 }
            );
          }
        }
      } else if (!isSrmBuyerTransitionAllowed(from, nextStatus)) {
        return NextResponse.json(
          { error: `Cannot transition from ${from} to ${nextStatus}` },
          { status: 400 }
        );
      }
      updates.status = nextStatus;
    }

    for (const f of [
      'promised_date',
      'actual_delivery_date',
      'payment_terms',
      'incoterms',
      'description',
      'supplier_wallet',
    ] as const) {
      if (body[f] !== undefined) updates[f] = body[f];
    }
    for (const f of ['order_quantity', 'delivered_quantity', 'damaged_quantity'] as const) {
      if (body[f] !== undefined) {
        const n = Number(body[f]);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json({ error: `Invalid ${f}` }, { status: 400 });
        }
        updates[f] = n;
      }
    }

    // Completing without delivery date → today
    if (updates.status === 'completed' && !updates.actual_delivery_date && !po.actual_delivery_date) {
      updates.actual_delivery_date = new Date().toISOString().slice(0, 10);
    }

    const { data, error } = await supabase
      .from('purchase_orders')
      .update(updates)
      .eq('id', id)
      .eq('buyer_profile_id', companyId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: member.userId,
      action: nextStatus ? `po.status.${nextStatus}` : 'po.updated.srm',
      entity_type: 'purchase_order',
      entity_id: String(id),
      summary: `SRM PO #${id} updated${nextStatus ? ` → ${nextStatus}` : ''}`,
      metadata: updates,
    });

    // Soft-fail rating prompt when PO is delivered / completed (buyer → supplier)
    const deliveredNow =
      Boolean(updates.actual_delivery_date) ||
      updates.status === 'completed' ||
      updates.status === 'delivered';
    const wasAlreadyDelivered =
      Boolean(po.actual_delivery_date) ||
      ['completed', 'delivered', 'paid'].includes(String(po.status || '').toLowerCase());
    if (deliveredNow && !wasAlreadyDelivered) {
      const supplierId = Number(
        data?.supplier_profile_id ?? data?.supplier_id ?? po.supplier_profile_id ?? po.supplier_id
      );
      void promptAfterPoDelivered({
        buyerProfileId: companyId,
        supplierProfileId: Number.isFinite(supplierId) ? supplierId : null,
        supplierName: data?.supplier_name || po.supplier_name || null,
        poId: id,
        userId: member.userId,
      }).catch(() => undefined);
    }

    return NextResponse.json({ success: true, purchaseOrder: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
