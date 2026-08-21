/**
 * GET  ?companyId=&from=&to= — review posted journals for likely wrong GL.
 * POST { companyId, action: 'keep', ... } — confirm posted account is correct.
 */
import { NextRequest, NextResponse } from 'next/server';
import { parseCompanyId } from '@/lib/accounting/server';
import {
  requireCompanyAccess,
  requireCompanyPermission,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { reviewPostedJournals } from '@/lib/accounting/journal-review';
import { confirmAllocationKeep } from '@/lib/accounting/allocation-keep';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');
    const report = await reviewPostedJournals({
      companyId,
      from,
      to,
    });
    return NextResponse.json({ success: true, ...report });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Review failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
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

    const action = String(body.action || 'keep');
    if (action !== 'keep' && action !== 'confirm') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const keeps = await confirmAllocationKeep(companyId, {
      journal_id: Number(body.journal_id),
      line_id: body.line_id != null ? Number(body.line_id) : null,
      gl_account_id: Number(body.posted_account_id || body.gl_account_id),
      description: body.description || body.merchant_key || null,
    });

    return NextResponse.json({
      success: true,
      message: 'Kept — the OS will treat this account as correct for similar lines',
      keeps,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not save' },
      { status: 400 }
    );
  }
}
