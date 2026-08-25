import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { loadIspSlaScorecard } from '@/lib/schools/isp-sla-scorecard';

/**
 * SP SLA + OTIFEF scorecard (school, SP, or agency network).
 * OTIFEF = On-Time · In-Full · Error-Free from deliveries/POs/GRNs.
 * Scope follows the caller’s role; period from the slicer (from/to).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const to = sp.get('to') || new Date().toISOString().slice(0, 10);
    const fromDefault = new Date();
    fromDefault.setMonth(fromDefault.getMonth() - 3);
    const from = sp.get('from') || fromDefault.toISOString().slice(0, 10);

    const supabase = getSupabaseServer();
    const card = await loadIspSlaScorecard(supabase, companyId, {
      from,
      to,
      persist: false,
    });

    return NextResponse.json({
      success: true,
      role: card.role,
      period: card.period,
      isps: card.isps,
      policy: card.policy,
      otifef_legend: card.otifef_legend,
      summary: card.summary,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
