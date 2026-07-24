import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { loadGoldenPath } from '@/lib/business/golden-path';
import { loadSettleFunnel } from '@/lib/business/settle-funnel';
import { getSupabaseServer } from '@/lib/supabase/server-client';

/**
 * GET ?companyId= — board pack v1: golden path + settle + company identity snapshot.
 * JSON export for leadership; not a formal audit opinion.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const [profileRes, golden, funnel] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id, trading_name, legal_name, country, city, industry, verification_status, trust_score, primary_currency'
        )
        .eq('id', companyId)
        .maybeSingle(),
      loadGoldenPath(companyId, 50),
      loadSettleFunnel(companyId),
    ]);

    const pack = {
      schema_version: '1.0',
      generated_at: new Date().toISOString(),
      company: profileRes.data || { id: companyId },
      golden_path: {
        summary: golden.summary,
        funnel: golden.funnel,
        next_actions: golden.next_actions,
        open_trades: golden.trades
          .filter((t) => !t.stages.settled || !t.stages.reviewed)
          .slice(0, 20)
          .map((t) => ({
            id: t.id,
            po_number: t.po_number,
            status: t.status,
            role: t.role,
            next: t.next_label,
            escrow: t.escrow.enabled
              ? {
                  complete: t.escrow.complete,
                  next: t.escrow.nextLabel,
                  mode: t.escrow.mode,
                }
              : null,
          })),
      },
      settle: {
        claims_pending: funnel.claimsPending,
        open_ar: funnel.openAr,
        overdue: funnel.overdueInvoices,
        open_escrows: funnel.openEscrows,
        funded_escrows: funnel.fundedEscrows,
        stages: funnel.stages,
      },
      narrative: {
        headline: `${profileRes.data?.trading_name || 'Company'} — board pack`,
        bullets: [
          `Open POs: ${golden.summary.open_pos} · path complete ${golden.summary.pct_complete}%`,
          `Claims pending: ${funnel.claimsPending} · open AR lines: ${funnel.openAr}`,
          `Open escrows: ${golden.summary.open_escrows} (await ship ${golden.summary.escrow_awaiting_ship}, release ${golden.summary.escrow_awaiting_release})`,
          `Stuck receive: ${golden.summary.stuck_receive} · stuck settle: ${golden.summary.stuck_settle}`,
        ],
      },
      disclaimer:
        'Operational board pack from live system data — not a formal audit, legal, or financial statement.',
    };

    return NextResponse.json({
      success: true,
      pack,
      download_name: `board-pack-${companyId}-${new Date().toISOString().slice(0, 10)}.json`,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
