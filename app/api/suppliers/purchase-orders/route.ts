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
import {
  allocatePurchaseOrderCost,
  hasCostObject,
  normalizePoCostFields,
} from '@/lib/procurement/allocate-po-cost';

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
    const profileIds = [
      ...new Set(
        pos
          .map((p) => Number(p.supplier_profile_id))
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
    ];
    const srmIds = [
      ...new Set(
        pos
          .map((p) => Number(p.supplier_id))
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
    ];
    const nameMap: Record<number, string> = {};
    const walletMap: Record<number, string | null> = {};
    const phoneBySrm: Record<number, string | null> = {};
    const contactBySrm: Record<number, string | null> = {};
    const nameBySrm: Record<number, string> = {};
    /** phone keyed by linked platform profile id (from srm book) */
    const phoneByLinkedProfile: Record<number, string | null> = {};

    if (profileIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, trading_name, wallet_address')
        .in('id', profileIds);
      for (const p of profiles || []) {
        nameMap[Number(p.id)] = p.trading_name || `Supplier ${p.id}`;
        walletMap[Number(p.id)] = p.wallet_address || null;
      }
    }

    if (srmIds.length) {
      const { data: srmRows } = await supabase
        .from('srm_suppliers')
        .select('id, trading_name, phone, contact_name, linked_profile_id')
        .in('id', srmIds);
      for (const s of srmRows || []) {
        const id = Number(s.id);
        nameBySrm[id] = s.trading_name || `Supplier ${id}`;
        phoneBySrm[id] = (s.phone as string) || null;
        contactBySrm[id] = (s.contact_name as string) || null;
        const lp = Number(s.linked_profile_id);
        if (lp > 0 && s.trading_name && !nameMap[lp]) {
          nameMap[lp] = s.trading_name;
        }
        if (lp > 0 && s.phone) {
          phoneByLinkedProfile[lp] = s.phone as string;
        }
      }
    }

    // Soft: invoice share state for invoiced POs (buyer awaiting-share UX)
    const poIds = pos.map((p) => Number(p.id)).filter((n) => Number.isFinite(n) && n > 0);
    const invByPoId = new Map<
      number,
      { id: number; visibility: string | null; invoice_number: string | null }
    >();
    if (poIds.length) {
      try {
        const { data: invRows } = await supabase
          .from('customer_invoices')
          .select('id, source_po_id, visibility, invoice_number, profile_id')
          .in('source_po_id', poIds.slice(0, 200))
          .limit(200);
        for (const inv of invRows || []) {
          const sp = Number(inv.source_po_id);
          if (!Number.isFinite(sp) || sp <= 0) continue;
          // Prefer shared row if multiple
          const prev = invByPoId.get(sp);
          const vis = String(inv.visibility || '');
          if (!prev || vis === 'shared') {
            invByPoId.set(sp, {
              id: Number(inv.id),
              visibility: inv.visibility ?? null,
              invoice_number: inv.invoice_number
                ? String(inv.invoice_number)
                : null,
            });
          }
        }
      } catch {
        /* soft — source_po_id column may be missing */
      }
    }

    const enriched = pos.map((p) => {
      const profileId = Number(p.supplier_profile_id);
      const srmId = Number(p.supplier_id);
      const inv = invByPoId.get(Number(p.id));
      const invoiceId =
        Number(p.invoice_id) > 0
          ? Number(p.invoice_id)
          : inv?.id && Number(inv.id) > 0
            ? Number(inv.id)
            : null;
      const invoiceShared =
        inv != null
          ? String(inv.visibility || '').toLowerCase() === 'shared'
          : String(p.status || '').toLowerCase() === 'invoiced'
            ? false
            : null;
      return {
        ...p,
        supplier_name:
          nameMap[profileId] || nameBySrm[srmId] || null,
        supplier_wallet: p.supplier_wallet || walletMap[profileId] || null,
        supplier_phone:
          phoneBySrm[srmId] || phoneByLinkedProfile[profileId] || null,
        supplier_contact_name: contactBySrm[srmId] || null,
        invoice_id: invoiceId ?? p.invoice_id ?? null,
        invoice_number: inv?.invoice_number ?? null,
        invoice_shared: invoiceShared,
      };
    });

    const counts = {
      total: enriched.length,
      draft: enriched.filter((p) => p.status === 'draft').length,
      open: enriched.filter((p) =>
        ['sent', 'accepted', 'funded', 'invoiced'].includes(String(p.status))
      ).length,
      completed: enriched.filter((p) =>
        ['completed', 'paid'].includes(String(p.status))
      ).length,
      invoiced: enriched.filter((p) => String(p.status) === 'invoiced').length,
      awaiting_invoice_share: enriched.filter(
        (p) =>
          String(p.status) === 'invoiced' && p.invoice_shared === false
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
 *       promised_date?, useEscrow?, supplier_wallet?, currency?, payment_terms?, status?,
 *       business_unit_id?, work_center_id?, work_station_id?, asset_id?, cost_category?,
 *       cost_allocations? (optional multi-split [{…, pct}])
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

    const costNorm = normalizePoCostFields(body as Record<string, unknown>);
    if (costNorm.error) {
      return NextResponse.json({ error: costNorm.error }, { status: 400 });
    }
    const costFields = costNorm.fields;
    const hasAlloc =
      hasCostObject(costFields as Parameters<typeof hasCostObject>[0]) ||
      (Array.isArray(costFields.cost_allocations) &&
        (costFields.cost_allocations as unknown[]).length > 0);

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
      ...costFields,
      metadata: {
        srm: true,
        srm_supplier_id: srmId,
        connection_id: conn?.id ?? null,
        use_escrow: body.useEscrow === true,
        cost_object: hasAlloc
          ? {
              business_unit_id: costFields.business_unit_id,
              work_center_id: costFields.work_center_id,
              work_station_id: costFields.work_station_id,
              asset_id: costFields.asset_id,
              cost_category: costFields.cost_category,
              cost_allocations: costFields.cost_allocations,
            }
          : null,
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

    // Soft notify supplier (never blocks create)
    if (data?.id && initialStatus !== 'draft') {
      void (async () => {
        try {
          const { data: buyerProf } = await supabase
            .from('profiles')
            .select('trading_name')
            .eq('id', companyId)
            .maybeSingle();
          const { notifyInboundPo } = await import(
            '@/lib/notifications/email-alerts'
          );
          const buyerName = buyerProf?.trading_name || null;
          await notifyInboundPo({
            supplierProfileId,
            buyerProfileId: companyId,
            buyerName,
            poId: Number(data.id),
            totalAmount: Number(data.total_amount ?? normalized.total),
            currency: String(data.currency || body.currency || 'ZAR'),
            lineCount: normalized.items.length,
            source: 'srm',
          });
          const { notifyInboundPoPush } = await import('@/lib/push/web-push');
          await notifyInboundPoPush({
            supplierProfileId,
            buyerName,
            poId: Number(data.id),
            totalAmount: Number(data.total_amount ?? normalized.total),
            currency: String(data.currency || body.currency || 'ZAR'),
          });
        } catch (e) {
          console.warn('inbound PO notify soft-fail', e);
        }
      })();
    }

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
 * PATCH — status transitions + OTIFEF delivery capture + receive stock + cost allocation.
 * Body: companyId, privyUserId, id, status?, promised_date?, actual_delivery_date?,
 *       delivered_quantity?, damaged_quantity?, order_quantity?, supplier_wallet?,
 *       business_unit_id?, work_center_id?, work_station_id?, asset_id?, cost_category?,
 *       cost_allocations?,
 *       action?: 'receive_inventory' | 'allocate_cost', warehouseId?
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    const privyUserId = body.privyUserId;
    const action = String(body.action || '').toLowerCase();

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

    // Receive PO lines into buyer warehouse
    if (action === 'receive_inventory' || action === 'receive_stock') {
      const { receivePurchaseOrderToInventory } = await import(
        '@/lib/procurement/receive-from-po'
      );
      const result = await receivePurchaseOrderToInventory({
        companyId,
        poId: id,
        warehouseId: body.warehouseId != null ? Number(body.warehouseId) : null,
      });
      if (!result.ok) {
        return NextResponse.json(
          {
            error: result.error || 'Receive failed',
            warnings: result.warnings,
            receivedLines: result.receivedLines,
            skippedLines: result.skippedLines,
          },
          { status: result.error === 'ALREADY_RECEIVED' ? 409 : 400 }
        );
      }
      await logActivity({
        profile_id: companyId,
        actor_user_id: member.userId,
        action: 'po.receive_inventory',
        entity_type: 'purchase_order',
        entity_id: String(id),
        summary: `Received ${result.receivedLines} PO lines into stock (qty ${result.qtyTotal})`,
        metadata: result,
      });
      // Soft: allocate cost objects → cost entries + GL when dims present
      let costAlloc: Awaited<ReturnType<typeof allocatePurchaseOrderCost>> | null =
        null;
      try {
        costAlloc = await allocatePurchaseOrderCost({
          companyId,
          poId: id,
          createdBy: member.userId || null,
        });
      } catch {
        /* soft */
      }
      const { data: refreshed } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      return NextResponse.json({
        success: true,
        receive: result,
        purchaseOrder: refreshed || po,
        costAllocation: costAlloc,
      });
    }

    // Explicit cost allocation (or re-post with force)
    if (action === 'allocate_cost' || action === 'post_cost') {
      // Allow updating cost dims first if provided
      if (
        body.business_unit_id !== undefined ||
        body.work_center_id !== undefined ||
        body.work_station_id !== undefined ||
        body.asset_id !== undefined ||
        body.cost_category !== undefined ||
        body.cost_allocations !== undefined
      ) {
        const costNorm = normalizePoCostFields(body as Record<string, unknown>);
        if (costNorm.error) {
          return NextResponse.json({ error: costNorm.error }, { status: 400 });
        }
        await supabase
          .from('purchase_orders')
          .update({
            ...costNorm.fields,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('buyer_profile_id', companyId);
      }
      const costAlloc = await allocatePurchaseOrderCost({
        companyId,
        poId: id,
        createdBy: member.userId || null,
        force: body.force === true,
      });
      if (!costAlloc.ok) {
        return NextResponse.json(
          { error: costAlloc.error || 'Cost allocation failed' },
          { status: 400 }
        );
      }
      await logActivity({
        profile_id: companyId,
        actor_user_id: member.userId,
        action: 'po.allocate_cost',
        entity_type: 'purchase_order',
        entity_id: String(id),
        summary: `Allocated PO #${id} cost to manufacturing cost objects / GL`,
        metadata: costAlloc,
      });
      const { data: refreshed } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      return NextResponse.json({
        success: true,
        purchaseOrder: refreshed || po,
        costAllocation: costAlloc,
      });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const nextStatus = body.status != null ? String(body.status).toLowerCase() : null;

    // Cost object updates on any PATCH
    if (
      body.business_unit_id !== undefined ||
      body.work_center_id !== undefined ||
      body.work_station_id !== undefined ||
      body.asset_id !== undefined ||
      body.cost_category !== undefined ||
      body.cost_allocations !== undefined
    ) {
      const costNorm = normalizePoCostFields(body as Record<string, unknown>);
      if (costNorm.error) {
        return NextResponse.json({ error: costNorm.error }, { status: 400 });
      }
      Object.assign(updates, costNorm.fields);
      const prevMeta =
        po.metadata && typeof po.metadata === 'object' && !Array.isArray(po.metadata)
          ? (po.metadata as Record<string, unknown>)
          : {};
      updates.metadata = {
        ...prevMeta,
        cost_object: {
          business_unit_id: costNorm.fields.business_unit_id,
          work_center_id: costNorm.fields.work_center_id,
          work_station_id: costNorm.fields.work_station_id,
          asset_id: costNorm.fields.asset_id,
          cost_category: costNorm.fields.cost_category,
          cost_allocations: costNorm.fields.cost_allocations,
        },
      };
    }

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

    // Completing requires OTIFEF capture (delivery date + quantities)
    if (updates.status === 'completed') {
      if (!updates.actual_delivery_date && !po.actual_delivery_date) {
        updates.actual_delivery_date = new Date().toISOString().slice(0, 10);
      }
      const delivered =
        updates.delivered_quantity != null
          ? Number(updates.delivered_quantity)
          : po.delivered_quantity != null
            ? Number(po.delivered_quantity)
            : null;
      if (delivered == null || !Number.isFinite(delivered)) {
        return NextResponse.json(
          {
            error:
              'Record delivered quantity (OTIFEF) before completing this PO',
            code: 'OTIFEF_REQUIRED',
          },
          { status: 400 }
        );
      }
      // Default order_quantity from lines if still missing (in-full baseline)
      if (
        updates.order_quantity == null &&
        (po.order_quantity == null || !Number.isFinite(Number(po.order_quantity)))
      ) {
        const items = Array.isArray(po.items) ? po.items : [];
        const sum = items.reduce(
          (s: number, it: { quantity?: number }) => s + (Number(it?.quantity) || 0),
          0
        );
        if (sum > 0) updates.order_quantity = sum;
      }
      if (updates.damaged_quantity == null && po.damaged_quantity == null) {
        updates.damaged_quantity = 0;
      }
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

    // Draft → sent: notify supplier (email + push)
    const prevStatus = String(po.status || '').toLowerCase();
    if (nextStatus === 'sent' && prevStatus === 'draft') {
      void (async () => {
        try {
          const supplierProfileId = Number(
            data?.supplier_profile_id ?? po.supplier_profile_id
          );
          if (!Number.isFinite(supplierProfileId) || supplierProfileId <= 0) return;
          const { data: buyerProf } = await supabase
            .from('profiles')
            .select('trading_name')
            .eq('id', companyId)
            .maybeSingle();
          const buyerName = buyerProf?.trading_name || null;
          const { notifyInboundPo } = await import(
            '@/lib/notifications/email-alerts'
          );
          await notifyInboundPo({
            supplierProfileId,
            buyerProfileId: companyId,
            buyerName,
            poId: id,
            totalAmount: Number(data?.total_amount ?? po.total_amount ?? 0),
            currency: String(data?.currency || po.currency || 'ZAR'),
            source: 'srm',
          });
          const { notifyInboundPoPush } = await import('@/lib/push/web-push');
          await notifyInboundPoPush({
            supplierProfileId,
            buyerName,
            poId: id,
            totalAmount: Number(data?.total_amount ?? po.total_amount ?? 0),
            currency: String(data?.currency || po.currency || 'ZAR'),
          });
        } catch (e) {
          console.warn('PO sent notify soft-fail', e);
        }
      })();
    }

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
      // Buyer rates supplier
      void promptAfterPoDelivered({
        buyerProfileId: companyId,
        supplierProfileId: Number.isFinite(supplierId) ? supplierId : null,
        supplierName: data?.supplier_name || po.supplier_name || null,
        poId: id,
        userId: member.userId,
      }).catch(() => undefined);
      // Supplier rates buyer (customer role) after delivery confirmed
      if (Number.isFinite(supplierId) && supplierId > 0) {
        void import('@/lib/ratings/create-prompt').then(({ createRatingPrompt }) =>
          createRatingPrompt({
            profileId: supplierId,
            counterpartyProfileId: companyId,
            counterpartyName: null,
            rateeRole: 'customer',
            contextType: 'po',
            contextId: String(id),
            userId: member.userId,
          }).catch(() => undefined)
        );
      }
    }

    // Auto-allocate to cost objects + GL when PO completes / paid
    let costAllocation: Awaited<
      ReturnType<typeof allocatePurchaseOrderCost>
    > | null = null;
    const shouldAllocate =
      nextStatus === 'completed' ||
      nextStatus === 'paid' ||
      nextStatus === 'delivered';
    if (shouldAllocate) {
      try {
        costAllocation = await allocatePurchaseOrderCost({
          companyId,
          poId: id,
          createdBy: member.userId || null,
        });
        if (costAllocation.ok && !costAllocation.skipped && costAllocation.costEntryIds?.length) {
          const { data: afterCost } = await supabase
            .from('purchase_orders')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (afterCost) {
            return NextResponse.json({
              success: true,
              purchaseOrder: afterCost,
              costAllocation,
            });
          }
        }
      } catch (e) {
        console.warn('PO cost allocate soft-fail', e);
      }
    }

    return NextResponse.json({
      success: true,
      purchaseOrder: data,
      costAllocation: costAllocation || undefined,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
