import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { buildInventoryReportPack } from '@/lib/inventory/report-pack';

/** GET ?companyId= — inventory metrics pack */
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

    const pack = await buildInventoryReportPack({ profileId: companyId });
    return NextResponse.json({ success: true, report: pack });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
