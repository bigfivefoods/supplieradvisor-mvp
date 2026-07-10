import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { computeBuyerOtifef } from '@/lib/suppliers/otifef';

/**
 * GET ?companyId= — SRM hub KPIs
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();

    const [{ data: suppliers, error }, openRiad, pendingInvites] = await Promise.all([
      supabase.from('srm_suppliers').select('id, status, invite_status, otifef_pct, trust_score, verified, linked_profile_id').eq('profile_id', companyId),
      supabase
        .from('riad_logs')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId)
        .in('status', ['open', 'active', 'in_progress', 'on_hold']),
      supabase
        .from('supplier_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId)
        .eq('status', 'pending'),
    ]);

    if (error) {
      return NextResponse.json({
        success: true,
        summary: emptySummary(),
        warning: error.message,
        hint: 'Run 20260709_srm_supplier_module.sql',
      });
    }

    const list = suppliers || [];
    const to = new Date();
    const from = new Date();
    from.setFullYear(from.getFullYear() - 1);
    const otifef = await computeBuyerOtifef({
      buyerProfileId: companyId,
      fromDate: from.toISOString().slice(0, 10),
      toDate: to.toISOString().slice(0, 10),
    });

    const connected = list.filter((s) => s.invite_status === 'accepted' || s.linked_profile_id).length;
    const preferred = list.filter((s) => s.status === 'preferred').length;
    const active = list.filter((s) => s.status === 'active' || s.status === 'preferred').length;
    const invited = list.filter((s) => s.invite_status === 'invited').length;
    const verified = list.filter((s) => s.verified).length;
    const avgTrust =
      list.length > 0
        ? list.reduce((a, s) => a + Number(s.trust_score || 0), 0) / list.length
        : 0;

    return NextResponse.json({
      success: true,
      summary: {
        total: list.length,
        active,
        preferred,
        connected,
        invited,
        invitePending: pendingInvites.count || invited,
        verified,
        openRiads: openRiad.count || 0,
        avgTrust: Math.round(avgTrust * 10) / 10,
        otifef: otifef.summary,
        topSuppliers: otifef.rows.slice(0, 5),
      },
      warning: otifef.warning,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

function emptySummary() {
  return {
    total: 0,
    active: 0,
    preferred: 0,
    connected: 0,
    invited: 0,
    invitePending: 0,
    verified: 0,
    openRiads: 0,
    avgTrust: 0,
    otifef: {
      overall: 0,
      onTime: 0,
      inFull: 0,
      errorFree: 0,
      totalPOs: 0,
      supplierCount: 0,
    },
    topSuppliers: [],
  };
}
