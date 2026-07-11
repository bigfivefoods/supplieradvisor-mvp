import { NextRequest, NextResponse } from 'next/server';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId } from '@/lib/accounting/server';
import { runAutoMatch, seedDefaultMatchRules } from '@/lib/banking/match-engine';
import {
  requireCompanyPermission,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { auditLog } from '@/lib/audit/log';

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

    const _gate = await requireCompanyPermission(
      request,
      companyId,
      'accounting',
      'write',
      { legacyPrivyUserId: legacyPrivyFrom(request, body) }
    );
    if (!_gate.ok) return _gate.response;

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
      privyUserId: _gate.userId || privyUserId,
      bankAccountId: body.bank_account_id ? Number(body.bank_account_id) : null,
      minConfidence: body.minConfidence != null ? Number(body.minConfidence) : 80,
      dryRun,
      limit: body.limit != null ? Number(body.limit) : 200,
      txnIds: Array.isArray(body.ids) ? body.ids : undefined,
    });

    if (!dryRun) {
      void auditLog({
        companyId,
        actorUserId: _gate.userId,
        action: 'bank.auto_match',
        entityType: 'bank_transactions',
        summary: `Bank auto-match applied (min conf ${body.minConfidence ?? 80})`,
        metadata: { dryRun, seeded, role: _gate.role },
      });
    }

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
