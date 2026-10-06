import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { cascadeFromPo } from '@/lib/orders/cascade';
import { legacyPrivyFrom, requireCompanyAccess } from '@/lib/auth/api-auth';

/**
 * POST /api/orders/cascade
 * Body: {
 *   companyId, privyUserId, poId,
 *   production_status?, confirmed_qty?, promised_date?, actual_completion_date?
 * }
 * Propagates cascade-safe fields from a PO to all actively linked sales orders.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyId = Number(body.companyId);
    const poId = Number(body.poId);

    if (!Number.isFinite(companyId) || companyId <= 0 || !Number.isFinite(poId) || poId <= 0) {
      return NextResponse.json(
        { error: 'companyId and poId are required' },
        { status: 400 }
      );
    }

    const gate = await requireCompanyAccess(req, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(req, body),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();

    // Ensure PO belongs to this company (buyer)
    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select('id, buyer_profile_id')
      .eq('id', poId)
      .maybeSingle();

    if (poErr || !po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }
    if (Number(po.buyer_profile_id) !== companyId) {
      return NextResponse.json({ error: 'PO does not belong to this company' }, { status: 403 });
    }

    const result = await cascadeFromPo(supabase, companyId, poId, {
      production_status: body.production_status ?? undefined,
      confirmed_qty:
        body.confirmed_qty !== undefined && body.confirmed_qty !== null
          ? Number(body.confirmed_qty)
          : undefined,
      promised_date: body.promised_date ?? undefined,
      actual_completion_date: body.actual_completion_date ?? undefined,
    });

    return NextResponse.json({
      ok: result.errors.length === 0,
      ...result,
    });
  } catch (e: any) {
    console.error('[orders/cascade POST]', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
