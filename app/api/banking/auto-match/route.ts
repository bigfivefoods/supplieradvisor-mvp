import { NextRequest, NextResponse } from 'next/server';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId } from '@/lib/accounting/server';
import { runAutoMatch, seedDefaultMatchRules } from '@/lib/banking/match-engine';

/**
 * POST — score and optionally apply auto-matches for unallocated bank lines
 *
 * body: {
 *   companyId, privyUserId,
 *   dryRun?: boolean,          // default true for safety
 *   minConfidence?: number,    // default 80
 *   bank_account_id?: number,
 *   ids?: (string|number)[],
 *   seedRules?: boolean,       // seed default fee/interest rules first
 *   limit?: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;
    // Default dryRun=true so UI preview is safe; pass dryRun:false to apply
    const dryRun = body.dryRun !== false && body.dryRun !== 'false' && body.apply !== true;

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'write');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    let seeded = 0;
    if (body.seedRules) {
      try {
        seeded = await seedDefaultMatchRules(companyId);
      } catch {
        seeded = 0;
      }
    }

    const result = await runAutoMatch({
      companyId,
      privyUserId,
      bankAccountId: body.bank_account_id ? Number(body.bank_account_id) : null,
      minConfidence: body.minConfidence != null ? Number(body.minConfidence) : 80,
      dryRun,
      limit: body.limit != null ? Number(body.limit) : 200,
      txnIds: Array.isArray(body.ids) ? body.ids : undefined,
    });

    return NextResponse.json({
      success: true,
      dryRun,
      seeded,
      ...result,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'Auto-match failed',
        hint: 'Ensure bank_match_rules migration is applied and chart of accounts is seeded',
      },
      { status: 500 }
    );
  }
}
