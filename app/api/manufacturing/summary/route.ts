import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();

    const [
      bomsRes,
      ordersRes,
      mpsRes,
      mrpRes,
      wcRes,
      stockRes,
    ] = await Promise.all([
      supabase
        .from('manufacturing_boms')
        .select('id, status')
        .eq('profile_id', companyId),
      supabase
        .from('manufacturing_production_orders')
        .select('id, status, qty_planned, qty_completed, qty_scrapped, priority')
        .eq('profile_id', companyId),
      supabase
        .from('manufacturing_mps_plans')
        .select('id, status')
        .eq('profile_id', companyId),
      supabase
        .from('manufacturing_mrp_runs')
        .select('id, status, run_number, completed_at, summary')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('manufacturing_work_centers')
        .select('id, status')
        .eq('profile_id', companyId),
      supabase
        .from('stock_levels')
        .select('qty_on_hand')
        .eq('profile_id', companyId),
    ]);

    const schemaWarning =
      bomsRes.error?.message ||
      ordersRes.error?.message ||
      mpsRes.error?.message ||
      null;

    const boms = bomsRes.data || [];
    const orders = ordersRes.data || [];
    const workCenters = wcRes.data || [];

    const byStatus = (status: string) => orders.filter((o) => o.status === status).length;

    const qtyPlanned = orders.reduce((s, o) => s + Number(o.qty_planned || 0), 0);
    const qtyCompleted = orders.reduce((s, o) => s + Number(o.qty_completed || 0), 0);
    const qtyScrapped = orders.reduce((s, o) => s + Number(o.qty_scrapped || 0), 0);
    const yieldPct =
      qtyCompleted + qtyScrapped > 0
        ? Math.round((qtyCompleted / (qtyCompleted + qtyScrapped)) * 1000) / 10
        : 100;

    const completionPct =
      qtyPlanned > 0 ? Math.round((qtyCompleted / qtyPlanned) * 1000) / 10 : 0;

    // Synthetic OEE-style availability proxy: active cells / all cells
    const activeCells = workCenters.filter((w) => w.status === 'active').length;
    const availability =
      workCenters.length > 0
        ? Math.round((activeCells / workCenters.length) * 1000) / 10
        : 100;
    const performance = Math.min(100, completionPct || 85);
    const quality = yieldPct;
    const oee = Math.round(((availability * performance * quality) / 10000) * 10) / 10;

    const unitsOnHand = (stockRes.data || []).reduce(
      (s, r) => s + Number(r.qty_on_hand || 0),
      0
    );

    const lastMrp = mrpRes.data?.[0] || null;

    return NextResponse.json({
      success: true,
      warning: schemaWarning || undefined,
      summary: {
        boms: boms.length,
        bomsActive: boms.filter((b) => b.status === 'active').length,
        orders: orders.length,
        ordersPlanned: byStatus('planned'),
        ordersReleased: byStatus('released'),
        ordersInProgress: byStatus('in_progress'),
        ordersHold: byStatus('hold'),
        ordersComplete: byStatus('complete'),
        qtyPlanned,
        qtyCompleted,
        qtyScrapped,
        yieldPct,
        completionPct,
        workCenters: workCenters.length,
        workCentersActive: activeCells,
        mpsPlans: (mpsRes.data || []).length,
        mpsActive: (mpsRes.data || []).filter((p) => p.status === 'active').length,
        oee,
        availability,
        performance,
        quality,
        unitsOnHand: Math.round(unitsOnHand * 100) / 100,
        lastMrp,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
