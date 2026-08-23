import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { cascadeFromPo } from '@/lib/orders/cascade';
import {
  PRODUCTION_STATUS_OPTIONS,
  type ProductionStatus,
} from '@/lib/orders/order-links';

/**
 * POST /api/orders/production-status
 * Update production status on a PO (BFF or manufacturer side).
 * Optionally writes batches and cascades to linked SOs.
 *
 * Body: {
 *   companyId,           // company performing the update (BFF or Kelpack workspace)
 *   privyUserId,
 *   poId,
 *   buyerCompanyId?,     // when manufacturer updates: the BFF company that owns the link
 *   production_status,   // released | in_progress | completed | on_hold | cancelled
 *   confirmed_qty?,
 *   promised_date?,
 *   actual_completion_date?,
 *   batches?: [{ batch_number, qty, uom?, produced_at?, notes? }],
 *   notes?,
 *   cascade?: boolean    // default true when buyerCompanyId or company is buyer
 * }
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
    const productionStatus = body.production_status as ProductionStatus | string | undefined;
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
      .select('id, buyer_profile_id, supplier_profile_id, status')
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

    const poUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      cascade_updated_at: new Date().toISOString(),
    };
    if (productionStatus) poUpdate.production_status = productionStatus;
    if (body.confirmed_qty !== undefined && body.confirmed_qty !== null) {
      poUpdate.confirmed_qty = Number(body.confirmed_qty);
    }
    if (body.promised_date) poUpdate.promised_date = body.promised_date;
    if (body.actual_completion_date) {
      poUpdate.actual_completion_date = body.actual_completion_date;
    }
    if (body.notes) {
      // merge into metadata.notes rather than overwriting description
      poUpdate.metadata = { production_notes: String(body.notes) };
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

    // Optional batches
    const batchesIn = Array.isArray(body.batches) ? body.batches : [];
    const insertedBatches: unknown[] = [];
    for (const b of batchesIn) {
      if (!b?.batch_number) continue;
      const { data: batchRow, error: bErr } = await supabase
        .from('order_batches')
        .insert({
          company_id: buyerCompanyId,
          order_id: poId,
          order_type: 'purchase_order',
          batch_number: String(b.batch_number),
          qty: Number(b.qty) || 0,
          uom: b.uom || 'ea',
          produced_at: b.produced_at || null,
          manufacturer_profile_id: isSupplier ? companyId : po.supplier_profile_id,
          notes: b.notes || null,
          created_by: privyUserId,
        })
        .select('*')
        .single();
      if (!bErr && batchRow) insertedBatches.push(batchRow);
    }

    // Cascade to linked SOs (owned by buyer company)
    let cascadeResult = null;
    if (doCascade) {
      cascadeResult = await cascadeFromPo(supabase, buyerCompanyId, poId, {
        production_status: productionStatus ?? undefined,
        confirmed_qty:
          body.confirmed_qty !== undefined && body.confirmed_qty !== null
            ? Number(body.confirmed_qty)
            : undefined,
        promised_date: body.promised_date ?? undefined,
        actual_completion_date: body.actual_completion_date ?? undefined,
      });
    }

    try {
      await supabase.from('activity_log').insert({
        profile_id: buyerCompanyId,
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
        },
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json({
      ok: true,
      po: updatedPo,
      batches: insertedBatches,
      cascade: cascadeResult,
    });
  } catch (e: any) {
    console.error('[orders/production-status POST]', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
