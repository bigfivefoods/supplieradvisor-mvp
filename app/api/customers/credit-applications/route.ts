import { NextRequest, NextResponse } from 'next/server';
import { parseCompanyId } from '@/lib/accounting/server';
import { assertCustomersAccess } from '@/lib/customers/access';
import {
  CreditApplicationError,
  decideCreditApplication,
  getCreditApplication,
  listCreditApplications,
} from '@/lib/customers/credit-application-store';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';

export const runtime = 'nodejs';

function fail(error: unknown) {
  if (error instanceof CreditApplicationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : 'Credit application failed',
    },
    { status: 500 }
  );
}

/** Seller review of trade-credit applications. Bank numbers are masked on the list. */
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
    const view = await assertCustomersAccess(gate.userId, companyId, 'view');
    if (!view.ok) {
      return NextResponse.json({ error: view.error }, { status: view.status });
    }
    const write = await assertCustomersAccess(gate.userId, companyId, 'write');
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (Number.isFinite(id) && id > 0) {
      const application = await getCreditApplication({ companyId, id });
      if (!application) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        can_write: write.ok,
        application,
      });
    }
    const applications = await listCreditApplications({ companyId });
    return NextResponse.json({
      success: true,
      can_write: write.ok,
      applications,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const companyId = parseCompanyId(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;
    const write = await assertCustomersAccess(gate.userId, companyId, 'write');
    if (!write.ok) {
      return NextResponse.json({ error: write.error }, { status: write.status });
    }
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Application id required' }, { status: 400 });
    }
    const application = await decideCreditApplication({
      companyId,
      id,
      decision: body.decision,
      approvedLimit: body.approved_limit,
      approvedTerms: body.approved_terms,
      notes: body.decision_notes,
      reviewedBy: write.name || write.email || write.userId,
    });
    return NextResponse.json({ success: true, application });
  } catch (error) {
    return fail(error);
  }
}
