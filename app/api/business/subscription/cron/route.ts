import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { sendSubscriptionLifecycleEmails } from '@/lib/billing/subscription-reminders';

/**
 * GET — daily trial/expiry reminder emails
 * Auth: Bearer CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;

  const result = await sendSubscriptionLifecycleEmails({ limit: 150 });
  return NextResponse.json({ success: result.ok, ...result });
}
