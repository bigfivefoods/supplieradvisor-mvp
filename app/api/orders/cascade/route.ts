import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { cascadeFromPo } from '@/lib/orders/cascade';

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
    const privyUserId = body.privyUserId as string | undefined;

    if (!companyId || !poId || !privyUserId) {
      return NextResponse.json(
        { error: 'companyId, poId and privyUserId are required' },
        { status: 400 }
      );
    }

    const mem = await assertCompanyMember(privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

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
