import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import {
  sendRegistrationReport,
  type ReportPeriod,
} from '@/lib/notifications/registration-report';

/**
 * GET /api/onboarding/registration-report/cron?period=daily|weekly
 * Optional: dryRun=1, from=, to= (ISO)
 * Auth: Authorization: Bearer $CRON_SECRET  (or x-cron-secret)
 *
 * Vercel crons:
 *   daily  — 06:30 UTC (previous calendar day)
 *   weekly — Monday 07:00 UTC (prior 7 days)
 */
export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;

  const sp = request.nextUrl.searchParams;
  const periodRaw = String(sp.get('period') || 'daily').toLowerCase();
  const period: ReportPeriod = periodRaw === 'weekly' ? 'weekly' : 'daily';
  const dryRun =
    sp.get('dryRun') === '1' ||
    sp.get('dryRun') === 'true' ||
    sp.get('dry') === '1';
  const from = sp.get('from') || undefined;
  const to = sp.get('to') || undefined;

  const result = await sendRegistrationReport({
    period,
    dryRun,
    from,
    to,
  });

  return NextResponse.json({
    success: result.ok,
    ...result,
  });
}

export async function POST(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;

  const body = await request.json().catch(() => ({}));
  const periodRaw = String(body.period || 'daily').toLowerCase();
  const period: ReportPeriod = periodRaw === 'weekly' ? 'weekly' : 'daily';

  const result = await sendRegistrationReport({
    period,
    dryRun: Boolean(body.dryRun),
    from: body.from ? String(body.from) : undefined,
    to: body.to ? String(body.to) : undefined,
  });

  return NextResponse.json({
    success: result.ok,
    ...result,
  });
}
