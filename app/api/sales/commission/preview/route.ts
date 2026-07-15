import { NextRequest, NextResponse } from 'next/server';
import {
  assertSalesPortalAccess,
  getOrCreateAgreement,
} from '@/lib/sales-contractor/access';
import { calculateCommission } from '@/lib/sales-contractor/commission';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  liveCommissionTiers,
  resolveProgramSettings,
} from '@/lib/sales-program';

/**
 * GET ?companyId=&privyUserId=&amount=
 * Live commission preview for a deal amount (quotes / invoices UI).
 * Uses company sales program rates unless the contractor has e-signed a freeze.
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

    const program = await resolveProgramSettings(companyId);
    let agreement = null;
    const agr = await getOrCreateAgreement({
      companyId,
      memberId: ctx.memberId,
      userId: ctx.userId,
      name: ctx.name,
      email: ctx.email,
    });
    if (agr.ok) agreement = agr.agreement;

    const tiers = liveCommissionTiers(program, agreement);
    const result = calculateCommission(amount, { tiers });
    return NextResponse.json({
      success: true,
      ...result,
      tiers,
      source:
        agreement?.status === 'signed'
          ? 'signed_agreement'
          : program.using_defaults
            ? 'platform_default'
            : 'company_sales_program',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
