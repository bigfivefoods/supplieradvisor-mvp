/**
 * POST { to? } — send branded design-sample emails.
 * Auth: CRON_SECRET (Bearer or x-cron-secret).
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import {
  EMAIL_DESIGN_SAMPLE_TO,
  sendEmailDesignSamples,
} from '@/lib/notifications/email-design-samples';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  let to = EMAIL_DESIGN_SAMPLE_TO;
  try {
    const body = (await request.json().catch(() => ({}))) as { to?: string };
    if (body.to && String(body.to).includes('@')) {
      to = String(body.to).trim();
    }
  } catch {
    /* default */
  }
  const result = await sendEmailDesignSamples({ to });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
