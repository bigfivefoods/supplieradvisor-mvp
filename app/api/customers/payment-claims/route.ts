import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  listClaimsForSeller,
  resolvePaymentClaim,
} from '@/lib/customers/payment-claims';

/**
 * Seller payment-claim queue.
 * GET  ?companyId=&status=pending
 * POST { companyId, action: 'confirm'|'reject', claimId, amount? }
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const status = request.nextUrl.searchParams.get('status') || 'pending';
    const { claims, tableMissing } = await listClaimsForSeller(companyId, {
      status: status === 'all' ? undefined : status,
      limit: Number(request.nextUrl.searchParams.get('limit') || 40),
    });
    return NextResponse.json({
      success: true,
      claims,
      tableMissing,
      warning: tableMissing
        ? 'Run 20260717_payment_claims_and_ledger_fx.sql'
        : undefined,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const action = String(body.action || '').toLowerCase();
    const claimId = Number(body.claimId || body.id);
    if (!['confirm', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be confirm or reject' },
        { status: 400 }
      );
    }
    if (!Number.isFinite(claimId) || claimId <= 0) {
      return NextResponse.json({ error: 'claimId required' }, { status: 400 });
    }

    const result = await resolvePaymentClaim({
      claimId,
      sellerProfileId: companyId,
      action: action as 'confirm' | 'reject',
      actorUserId: gate.userId,
      amountOverride:
        body.amount != null ? Number(body.amount) : undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      action,
      claim: result.claim,
      invoice: result.invoice || null,
      ledgerId: result.ledgerId ?? null,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
