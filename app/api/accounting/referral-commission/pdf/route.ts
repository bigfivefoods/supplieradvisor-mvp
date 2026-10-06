import { NextRequest, NextResponse } from 'next/server';
import { parseCompanyId } from '@/lib/accounting/server';
import { assertAccountingAccess } from '@/lib/accounting/access';
import {
  loadPartnerCommission,
  loadSellerCommission,
} from '@/lib/accounting/referral-commission-store';
import { buildReferralStatementPdf } from '@/lib/accounting/referral-statement-pdf';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import type { PartnerCommissionStatement } from '@/lib/accounting/referral-commission';

export const runtime = 'nodejs';

/** PDF of one partner statement. The signed-in company must be the seller or the partner. */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const sellerId = Number(request.nextUrl.searchParams.get('sellerId'));
    const partnerId = Number(request.nextUrl.searchParams.get('partnerId'));
    const from = request.nextUrl.searchParams.get('from') || '';
    const to = request.nextUrl.searchParams.get('to') || '';
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
      return NextResponse.json({ error: 'from and to must be YYYY-MM-DD' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const view = await assertAccountingAccess(gate.userId, companyId, 'view');
    if (!view.ok) {
      return NextResponse.json({ error: view.error }, { status: view.status });
    }
    let statement: PartnerCommissionStatement | undefined;
    if (companyId === sellerId) {
      const book = await loadSellerCommission({ sellerId: companyId, from, to });
      statement = book.partners.find((row) => row.partner_profile_id === partnerId);
    } else if (companyId === partnerId) {
      const incoming = await loadPartnerCommission({ partnerId: companyId, from, to });
      statement = incoming.find((row) => row.seller_profile_id === sellerId);
    } else {
      return NextResponse.json({ error: 'That statement is not for this company' }, { status: 403 });
    }
    if (!statement) {
      return NextResponse.json({ error: 'No commission statement for that company' }, { status: 404 });
    }
    const pdf = await buildReferralStatementPdf({
      statement,
      periodLabel: `${from} to ${to}`,
    });
    const filename = `referral-commission-${statement.partner_profile_id}-${from}-${to}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not build the statement' },
      { status: 500 }
    );
  }
}
