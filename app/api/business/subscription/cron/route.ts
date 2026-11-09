import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { sendSubscriptionLifecycleEmails } from '@/lib/billing/subscription-reminders';

/**
 * GET — daily trial/expiry reminder emails.
 * Vercel Cron sends Authorization: Bearer $CRON_SECRET.
 * The handler only reads companies inside the 1–7 day window.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;

  const result = await sendSubscriptionLifecycleEmails({ limit: 150 });
  return NextResponse.json(
    { success: result.ok, ...result },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
