import { NextRequest, NextResponse } from 'next/server';
import { parseCompanyId } from '@/lib/accounting/server';
import {
  requireCompanyAccess,
  requireCompanyPermission,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  buildEclWorksheet,
  postEclAllowance,
  type EclBucket,
} from '@/lib/accounting/ecl';

/** GET ?companyId= — IFRS 9 simplified ECL worksheet */
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

    const sheet = await buildEclWorksheet({ profileId: companyId });
    return NextResponse.json({ success: true, ecl: sheet });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** POST { companyId, action: 'post', rates?, overrides?, entry_date? } */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyPermission(
      request,
      companyId,
      'accounting',
      'write',
      { legacyPrivyUserId: legacyPrivyFrom(request, body) }
    );
    if (!gate.ok) return gate.response;

    if (body.action === 'preview') {
      const sheet = await buildEclWorksheet({
        profileId: companyId,
        rates: body.rates as Partial<Record<EclBucket, number>> | undefined,
        overrides: body.overrides as Record<string, number> | undefined,
      });
      return NextResponse.json({ success: true, ecl: sheet });
    }

    const result = await postEclAllowance({
      profileId: companyId,
      rates: body.rates as Partial<Record<EclBucket, number>> | undefined,
      overrides: body.overrides as Record<string, number> | undefined,
      createdBy: gate.userId || null,
      entryDate: body.entry_date || body.entryDate || null,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
