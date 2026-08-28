import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { jsonKpi } from '@/lib/http/response-cache';
import { withCompanyKpiCache } from '@/lib/dashboard/kpi-cache';
import { assembleDashboardSummary } from '@/lib/dashboard/assemble-home';

/**
 * Brief 10/11 — one dashboard first-paint payload (rollup RPCs only).
 * GET ?companyId=  (same body as POST /api/dashboard/summary)
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const payload = await withCompanyKpiCache(companyId, 'dashboard', () =>
      assembleDashboardSummary(companyId)
    );
    return jsonKpi(payload);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error';
    if (message === 'Company not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
