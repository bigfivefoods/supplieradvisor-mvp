import { NextRequest, NextResponse } from 'next/server';
import {
  assertSalesPortalAccess,
  getOrCreateAgreement,
} from '@/lib/sales-contractor/access';
import {
  calculateCommission,
  ensureAscendingCommissionTiers,
} from '@/lib/sales-contractor/commission';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * GET ?companyId=&privyUserId=&amount=
 * Live commission preview for a deal amount (quotes / invoices UI).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const privyUserId = sp.get('privyUserId');
    const amount = Number(sp.get('amount') || 0);

    const ctx = await assertSalesPortalAccess(privyUserId, companyId);
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    let tiers = undefined;
    const agr = await getOrCreateAgreement({
      companyId,
      memberId: ctx.memberId,
      userId: ctx.userId,
      name: ctx.name,
      email: ctx.email,
    });
    if (agr.ok) tiers = ensureAscendingCommissionTiers(agr.agreement.commission_tiers);

    const result = calculateCommission(amount, { tiers });
    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
