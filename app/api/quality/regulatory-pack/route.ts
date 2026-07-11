import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { findLotHolds } from '@/lib/quality/holds';

/**
 * GET ?companyId=&days=90
 * Exportable quality/regulatory operating pack (JSON) for auditors.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const days = Math.min(365, Math.max(7, Number(sp.get('days')) || 90));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const since = new Date(Date.now() - days * 86400000).toISOString();
    const supabase = getSupabaseServer();

    const [profile, inspections, plans, ccps, logs, lots] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, trading_name, legal_name, country, city, industry, verification_status')
        .eq('id', companyId)
        .maybeSingle(),
      supabase
        .from('quality_inspections')
        .select('*')
        .eq('profile_id', companyId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('haccp_plans')
        .select('*')
        .eq('profile_id', companyId)
        .limit(100),
      supabase
        .from('haccp_ccps')
        .select('*')
        .eq('profile_id', companyId)
        .limit(300),
      supabase
        .from('haccp_monitoring_logs')
        .select('*')
        .eq('profile_id', companyId)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: false })
        .limit(500),
      supabase
        .from('inventory_lots')
        .select('id, lot_number, product_id, expiry_date, status, quantity')
        .eq('profile_id', companyId)
        .limit(300),
    ]);

    const insp = inspections.data || [];
    const logRows = logs.data || [];
    const planRows = plans.data || [];
    const lotRows = lots.data || [];

    const passed = insp.filter((i) => i.status === 'passed').length;
    const failed = insp.filter((i) => i.status === 'failed').length;
    const open = insp.filter((i) => i.status === 'open').length;
    const breaches = logRows.filter(
      (l) => l.result === 'breach' || l.within_limit === false
    ).length;

    const lotNums = lotRows.map((l) => l.lot_number).filter(Boolean) as string[];
    const holds = await findLotHolds(companyId, lotNums);

    const pack = {
      schema_version: '1.0',
      pack_type: 'quality_regulatory_operating_pack',
      generated_at: new Date().toISOString(),
      period_days: days,
      company: profile.data,
      summary: {
        inspections_total: insp.length,
        inspections_passed: passed,
        inspections_failed: failed,
        inspections_open: open,
        pass_rate: insp.length ? Math.round((passed / insp.length) * 1000) / 10 : null,
        haccp_plans: planRows.length,
        haccp_plans_approved: planRows.filter((p) => p.status === 'approved').length,
        haccp_ccps: (ccps.data || []).length,
        haccp_logs: logRows.length,
        haccp_breaches: breaches,
        lots: lotRows.length,
        lots_on_hold: holds.length,
      },
      holds,
      haccp_plans: planRows,
      haccp_ccps: ccps.data || [],
      recent_inspections: insp.slice(0, 100),
      recent_haccp_logs: logRows.slice(0, 100),
      disclaimer:
        'Operational quality pack generated from SupplierAdvisor live data. Not a third-party certification or formal legal audit opinion.',
    };

    return NextResponse.json({
      success: true,
      pack,
      download_name: `quality-regulatory-pack-${companyId}-${new Date().toISOString().slice(0, 10)}.json`,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
