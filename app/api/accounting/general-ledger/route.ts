import { NextRequest, NextResponse } from 'next/server';
import { parseCompanyId } from '@/lib/accounting/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { buildGeneralLedger } from '@/lib/accounting/general-ledger';

/**
 * GET ?companyId=&from=&to=&accountId=
 * Posted general ledger for the period (opening + movements + closing).
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(
      request.nextUrl.searchParams.get('companyId')
    );
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const acc = await assertAccountingAccess(gate.userId, companyId, 'view');
    if (!acc.ok) {
      return NextResponse.json({ error: acc.error }, { status: acc.status });
    }

    const from =
      request.nextUrl.searchParams.get('from') ||
      `${new Date().getFullYear()}-01-01`;
    const to =
      request.nextUrl.searchParams.get('to') ||
      new Date().toISOString().slice(0, 10);
    const accountRaw = request.nextUrl.searchParams.get('accountId');
    const accountId = accountRaw ? Number(accountRaw) : null;

    const ledger = await buildGeneralLedger({
      profileId: companyId,
      from,
      to,
      accountId: accountId != null && Number.isFinite(accountId) ? accountId : null,
    });

    return NextResponse.json({
      success: true,
      ledger,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Ledger failed' },
      { status: 500 }
    );
  }
}
