import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { loadBuyerMoneyHub } from '@/lib/customers/money-hub';

/**
 * GET ?buyerCompanyId= — buyer Money hub (open shared invoices + claims)
 */
export async function GET(request: NextRequest) {
  try {
    const buyerCompanyId = Number(
      request.nextUrl.searchParams.get('buyerCompanyId') ||
        request.nextUrl.searchParams.get('companyId')
    );
    if (!Number.isFinite(buyerCompanyId) || buyerCompanyId <= 0) {
      return NextResponse.json(
        { error: 'buyerCompanyId required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, buyerCompanyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const hub = await loadBuyerMoneyHub(buyerCompanyId);
    return NextResponse.json({ success: true, hub });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
