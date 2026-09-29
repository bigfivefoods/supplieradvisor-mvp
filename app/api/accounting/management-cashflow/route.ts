import { NextRequest, NextResponse } from 'next/server';
import { parseCompanyId } from '@/lib/accounting/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { assertAccountingAccess } from '@/lib/accounting/access';
import {
  buildManagementCashflow,
  parseBankTxnId,
  saveBankCashComment,
} from '@/lib/accounting/management-cashflow';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** GET ?companyId=&from=&to= — bank actual cash versus the 12-month budget. */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
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

    const from = request.nextUrl.searchParams.get('from') || '';
    const to = request.nextUrl.searchParams.get('to') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json(
        { error: 'from and to must be YYYY-MM-DD' },
        { status: 400 }
      );
    }
    if (from > to) {
      return NextResponse.json(
        { error: 'from must be on or before to' },
        { status: 400 }
      );
    }

    const statement = await buildManagementCashflow({
      profileId: companyId,
      from,
      to,
    });
    return NextResponse.json({ success: true, statement });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Cash flow failed' },
      { status: 500 }
    );
  }
}

/** PATCH { companyId, id, comment } — save an explanation on one bank line. */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const txnId = parseBankTxnId(body.id);
    if (!Number.isFinite(companyId) || !txnId) {
      return NextResponse.json(
        { error: 'companyId and transaction id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: body.privyUserId || legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const acc = await assertAccountingAccess(gate.userId, companyId, 'write');
    if (!acc.ok) {
      return NextResponse.json({ error: acc.error }, { status: acc.status });
    }
    const saved = await saveBankCashComment({
      profileId: companyId,
      txnId,
      comment: body.comment,
    });
    if (!saved.ok) {
      const missing = /notes|42703|column/i.test(saved.error);
      return NextResponse.json(
        {
          error: missing
            ? 'Comments need the notes column on bank transactions.'
            : saved.error,
        },
        { status: missing ? 400 : saved.error === 'Transaction not found' ? 404 : 400 }
      );
    }
    return NextResponse.json({ success: true, id: txnId, comment: saved.comment });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not save comment' },
      { status: 500 }
    );
  }
}
