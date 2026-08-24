import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { computeCustomerOtifef } from '@/lib/customers/otifef';

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

    const to =
      request.nextUrl.searchParams.get('to') ||
      new Date().toISOString().slice(0, 10);
    const fromDefault = new Date();
    fromDefault.setFullYear(fromDefault.getFullYear() - 1);
    const from =
      request.nextUrl.searchParams.get('from') ||
      fromDefault.toISOString().slice(0, 10);

    const pack = await computeCustomerOtifef({
      sellerProfileId: companyId,
      fromDate: from,
      toDate: to,
    });
    return NextResponse.json({
      success: true,
      from,
      to,
      summary: pack.summary,
      rows: pack.rows,
      warning: pack.warning,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
