/**
 * GET  ?companyId=&from=&to= — review posted journals for likely wrong GL.
 * POST { companyId, action: 'keep' | 'keep_many', ... } — confirm posted account(s).
 */
import { NextRequest, NextResponse } from 'next/server';
import { parseCompanyId } from '@/lib/accounting/server';
import {
  requireCompanyAccess,
  requireCompanyPermission,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { reviewPostedJournals } from '@/lib/accounting/journal-review';
import {
  confirmAllocationKeep,
  confirmAllocationKeeps,
  type AllocationKeepInput,
} from '@/lib/accounting/allocation-keep';

const KEEP_MANY_CAP = 200;

function keepItemFromBody(row: Record<string, unknown>): AllocationKeepInput {
  return {
    journal_id: Number(row.journal_id),
    line_id: row.line_id != null ? Number(row.line_id) : null,
    gl_account_id: Number(row.posted_account_id || row.gl_account_id),
    description:
      (row.description as string | null | undefined) ||
      (row.merchant_key as string | null | undefined) ||
      null,
  };
}

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
    const rawItems = Array.isArray(body.items) ? body.items : null;
    const isMany =
      action === 'keep_many' ||
      ((action === 'keep' || action === 'confirm') && rawItems);

    if (isMany) {
      const rows = (rawItems || []) as Record<string, unknown>[];
      if (!rows.length) {
        return NextResponse.json({ error: 'items required' }, { status: 400 });
      }
      if (rows.length > KEEP_MANY_CAP) {
        return NextResponse.json(
          { error: `At most ${KEEP_MANY_CAP} lines per keep` },
          { status: 400 }
        );
      }
      const items = rows.map(keepItemFromBody);
      const keeps = await confirmAllocationKeeps(companyId, items);
      const n = items.length;
      return NextResponse.json({
        success: true,
        kept: n,
        message:
          n === 1
            ? 'Kept — the OS will treat this account as correct for similar lines'
            : `Kept ${n} classifications — similar lines will stay on these accounts`,
        keeps,
      });
    }

    if (action !== 'keep' && action !== 'confirm') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const keeps = await confirmAllocationKeep(
      companyId,
      keepItemFromBody(body as Record<string, unknown>)
    );

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
