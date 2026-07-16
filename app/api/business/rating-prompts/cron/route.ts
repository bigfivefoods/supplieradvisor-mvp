import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { requireReferralOps } from '@/lib/billing/referral-controls';
import { sendPendingRatingDigests } from '@/lib/ratings/digest';

/**
 * GET — Vercel cron: email digest of pending rating prompts
 * Auth: Bearer CRON_SECRET
 *
 * POST — same with optional body { minAgeHours, limitCompanies }
 * Auth: CRON_SECRET or referral ops
 */
export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;

  const result = await sendPendingRatingDigests({
    minAgeHours: 20,
    limitCompanies: 100,
  });
  return NextResponse.json({ success: result.ok, ...result });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const ops = await requireReferralOps(request, {
      legacyPrivyUserId: body.privyUserId || null,
    });
    // Also allow pure cron secret via header
    if (!ops.ok) {
      const cron = assertCronSecret(request);
      if (!cron.ok) return ops.response;
    }

    const result = await sendPendingRatingDigests({
      minAgeHours:
        Number(body.minAgeHours) > 0 ? Number(body.minAgeHours) : 20,
      limitCompanies:
        Number(body.limitCompanies) > 0 ? Number(body.limitCompanies) : 100,
    });
    return NextResponse.json({ success: result.ok, ...result });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
