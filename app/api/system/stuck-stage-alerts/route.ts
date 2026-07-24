import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import {
  maybeSendStuckStageAlert,
  runStuckStageAlertSweep,
} from '@/lib/notifications/stuck-stage-alerts';

/**
 * POST — cron: sweep companies with open POs and email stuck-stage alerts.
 * GET ?companyId= — single-company dry check (cron secret or local).
 * Header: Authorization: Bearer CRON_SECRET or x-cron-secret
 */
export async function POST(request: NextRequest) {
  const cron = assertCronSecret(request);
  if (!cron.ok) return cron.response;

  try {
    const body = await request.json().catch(() => ({}));
    const companyId = Number(body.companyId);
    if (Number.isFinite(companyId) && companyId > 0) {
      const result = await maybeSendStuckStageAlert(companyId, {
        force: Boolean(body.force),
        minStuck: Number(body.minStuck) || 1,
      });
      return NextResponse.json({ success: true, result });
    }

    const sweep = await runStuckStageAlertSweep({
      limit: Number(body.limit) || 40,
      force: Boolean(body.force),
    });
    return NextResponse.json({ success: true, ...sweep });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const cron = assertCronSecret(request);
  if (!cron.ok) return cron.response;

  const companyId = Number(request.nextUrl.searchParams.get('companyId'));
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return NextResponse.json(
      { error: 'companyId required for GET (or POST sweep)' },
      { status: 400 }
    );
  }
  const result = await maybeSendStuckStageAlert(companyId, {
    force: request.nextUrl.searchParams.get('force') === '1',
  });
  return NextResponse.json({ success: true, result });
}
