import { NextRequest, NextResponse } from 'next/server';
import { parseCompanyId } from '@/lib/accounting/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { buildIas7CashFlow } from '@/lib/accounting/cash-flow-ias7';

/**
 * GET ?companyId=&from=&to=
 * IAS 7 / ASC 230 statement of cash flows (direct + indirect reconciliation).
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

    const statement = await buildIas7CashFlow({
      profileId: companyId,
      from,
      to,
    });
    const { buildCashFlowBudget } = await import(
      '@/lib/accounting/cash-flow-budget'
    );
    const budget = await buildCashFlowBudget({
      profileId: companyId,
      from,
      to,
    });

    return NextResponse.json({
      success: true,
      statement: { ...statement, budget },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Cash flow failed' },
      { status: 500 }
    );
  }
}
