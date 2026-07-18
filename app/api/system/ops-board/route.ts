import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { requireReferralOps } from '@/lib/billing/referral-controls';
import { loadOpsBoard } from '@/lib/system/ops-board';

/**
 * GET — Ops control plane snapshot.
 * Auth: CRON_SECRET or referral ops.
 */
export async function GET(request: NextRequest) {
  try {
    const cron = assertCronSecret(request);
    if (!cron.ok) {
      const ops = await requireReferralOps(request, {
        legacyPrivyUserId: legacyPrivyFrom(request),
      });
      if (!ops.ok) return ops.response;
    }
    const board = await loadOpsBoard();
    return NextResponse.json({ success: true, board });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
