import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { jsonKpi } from '@/lib/http/response-cache';
import { withCompanyKpiCache } from '@/lib/dashboard/kpi-cache';
import { assembleDashboardSummary } from '@/lib/dashboard/assemble-home';

export type {
  DashboardActivity,
  DashboardAlert,
} from '@/lib/dashboard/assemble-home';
export { assembleDashboardSummary } from '@/lib/dashboard/assemble-home';

/**
 * POST /api/dashboard/summary
 * Live command-center metrics — same assembler as GET /api/dashboard/home.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = body.companyId != null ? Number(body.companyId) : NaN;

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!_gate.ok) return _gate.response;

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
