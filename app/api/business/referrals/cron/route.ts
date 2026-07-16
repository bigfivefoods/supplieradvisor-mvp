import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import {
  autoApproveEligibleEarnings,
  clawbackReferralForSourceRef,
  requireReferralOps,
} from '@/lib/billing/referral-controls';

/**
 * GET — Vercel cron: auto-approve earnings past hold period
 * Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;

  const result = await autoApproveEligibleEarnings(500);
  return NextResponse.json({
    success: result.ok,
    autoApproved: result.count,
    error: result.error || null,
  });
}

/**
 * POST — ops actions for clawback / auto-approve
 * Body: { action: 'auto_approve' | 'clawback', sourceRef?, reason? }
 * Auth: CRON_SECRET or REFERRAL_OPS_SECRET or root owner
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'auto_approve').toLowerCase();

    const ops = await requireReferralOps(request, {
      legacyPrivyUserId: body.privyUserId || null,
    });
    if (!ops.ok) return ops.response;

    if (action === 'auto_approve') {
      const result = await autoApproveEligibleEarnings(
        Number(body.limit) > 0 ? Number(body.limit) : 500
      );
      return NextResponse.json({
        success: result.ok,
        autoApproved: result.count,
        error: result.error || null,
      });
    }

    if (action === 'clawback') {
      const sourceRef = String(body.sourceRef || body.paystackReference || '').trim();
      if (!sourceRef) {
        return NextResponse.json(
          { error: 'sourceRef (Paystack reference) required' },
          { status: 400 }
        );
      }
      const result = await clawbackReferralForSourceRef({
        sourceRef,
        reason: body.reason
          ? String(body.reason)
          : 'Payment refunded / reversed',
        actorUserId: ops.userId,
      });
      return NextResponse.json({
        success: result.ok,
        ...result,
      });
    }

    return NextResponse.json(
      { error: 'Unknown action. Use auto_approve | clawback' },
      { status: 400 }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
