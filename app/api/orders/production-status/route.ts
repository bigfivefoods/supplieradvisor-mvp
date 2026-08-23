import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { cascadeFromPo } from '@/lib/orders/cascade';
import { notifyProductionCascade } from '@/lib/orders/notify-chain';
import {
  PRODUCTION_STATUS_OPTIONS,
  type ProductionStatus,
} from '@/lib/orders/order-links';

/**
 * POST /api/orders/production-status
 * Update production status on a PO; cascade + notify (Phase D).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyId = Number(body.companyId);
    const poId = Number(body.poId);
    const privyUserId = body.privyUserId as string | undefined;
    const buyerCompanyId = body.buyerCompanyId
      ? Number(body.buyerCompanyId)
      : companyId;
    const productionStatus = body.production_status as
      | ProductionStatus
      | string
      | undefined;
    const doCascade = body.cascade !== false;

    if (!companyId || !poId || !privyUserId) {
      return NextResponse.json(
        { error: 'companyId, poId and privyUserId are required' },
        { status: 400 }
      );
    }

    if (
      productionStatus &&
      !PRODUCTION_STATUS_OPTIONS.some((o) => o.value === productionStatus)
    ) {
      return NextResponse.json(
        {
          error: `Invalid production_status. Allowed: ${PRODUCTION_STATUS_OPTIONS.map((o) => o.value).join(', ')}`,
        },
        { status: 400 }
      );
    }

    const mem = await assertCompanyMember(privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();

    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select('id, buyer_profile_id, supplier_profile_id, status, metadata')
      .eq('id', poId)
      .maybeSingle();

    if (poErr || !po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const isBuyer = Number(po.buyer_profile_id) === companyId;
    const isSupplier = Number(po.supplier_profile_id) === companyId;

    if (!isBuyer && !isSupplier) {
      return NextResponse.json(
        { error: 'Only the buyer or supplier on this PO may update production status' },
        { status: 403 }
      );
    }

    // Use actual buyer when supplier is updating
    const cascadeOwnerId = isSupplier
      ? Number(po.buyer_profile_id) || buyerCompanyId
      : buyerCompanyId;

    const prevMeta =
      po.metadata && typeof po.metadata === 'object' && !Array.isArray(po.metadata)
        ? (po.metadata as Record<string, unknown>)
        : {};

    const poUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      cascade_updated_at: new Date().toISOString(),
    };
    if (productionStatus) poUpdate.production_status = productionStatus;
    if (body.confirmed_qty !== undefined && body.confirmed_qty !== null) {
      const qty = Number(body.confirmed_qty);
      if (!Number.isFinite(qty) || qty < 0) {
        return NextResponse.json({ error: 'Invalid confirmed_qty' }, { status: 400 });
      }
      poUpdate.confirmed_qty = qty;
    }
    if (body.promised_date) poUpdate.promised_date = String(body.promised_date).slice(0, 10);
    if (body.actual_completion_date) {
      poUpdate.actual_completion_date = String(body.actual_completion_date).slice(0, 10);
    }
    if (body.notes) {
      poUpdate.metadata = {
        ...prevMeta,
        production_notes: String(body.notes).slice(0, 2000),
      };
    }

    const { data: updatedPo, error: upErr } = await supabase
      .from('purchase_orders')
      .update(poUpdate)
      .eq('id', poId)
      .select('*')
      .single();

    if (upErr) {
      console.error('[orders/production-status] PO update', upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const batchesIn = Array.isArray(body.batches) ? body.batches : [];
    const insertedBatches: unknown[] = [];
    for (const b of batchesIn) {
      if (!b?.batch_number) continue;
      const { data: batchRow, error: bErr } = await supabase
        .from('order_batches')
        .insert({
          company_id: cascadeOwnerId,
          order_id: poId,
          order_type: 'purchase_order',
          batch_number: String(b.batch_number).trim().slice(0, 120),
          qty: Number(b.qty) || 0,
          uom: b.uom || 'ea',
          produced_at: b.produced_at || null,
          manufacturer_profile_id: isSupplier ? companyId : po.supplier_profile_id,
          notes: b.notes ? String(b.notes).slice(0, 500) : null,
          created_by: privyUserId,
        })
        .select('*')
        .single();
      if (!bErr && batchRow) insertedBatches.push(batchRow);
    }

    let cascadeResult = null;
    if (doCascade) {
      cascadeResult = await cascadeFromPo(supabase, cascadeOwnerId, poId, {
        production_status: productionStatus ?? undefined,
        confirmed_qty:
          body.confirmed_qty !== undefined && body.confirmed_qty !== null
            ? Number(body.confirmed_qty)
            : undefined,
        promised_date: body.promised_date ?? undefined,
        actual_completion_date: body.actual_completion_date ?? undefined,
      });

      void notifyProductionCascade(supabase, {
        buyerCompanyId: cascadeOwnerId,
        poId,
        soIds: cascadeResult.linkedSoIds,
        productionStatus: productionStatus ?? null,
        actorCompanyId: companyId,
        isSupplier,
      });
    }

    try {
      await supabase.from('activity_log').insert({
        profile_id: cascadeOwnerId,
        action: 'order.production_status.updated',
        entity_type: 'purchase_order',
        entity_id: String(poId),
        actor_id: privyUserId,
        metadata: {
          production_status: productionStatus,
          confirmed_qty: body.confirmed_qty,
          batches: insertedBatches.length,
          actor_company_id: companyId,
          is_supplier: isSupplier,
          cascaded: cascadeResult?.updated ?? 0,
        },
      });
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({
      ok: true,
      po: updatedPo,
      batches: insertedBatches,
      cascade: cascadeResult,
    });
  } catch (e: unknown) {
    console.error('[orders/production-status POST]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
