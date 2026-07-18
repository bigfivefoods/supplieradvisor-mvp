import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import {
  loadPaystackWebhookPulse,
  recordPaystackWebhookPulse,
} from '@/lib/system/paystack-pulse';

/**
 * GET  — current pulse (CRON_SECRET)
 * POST — write a synthetic heartbeat so ops can verify activity_log + pulse after deploy
 *        (does not call Paystack; use Dashboard "Send test webhook" for real delivery)
 */
export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  const pulse = await loadPaystackWebhookPulse();
  return NextResponse.json({
    ok: true,
    pulse,
    webhookUrl: 'https://www.supplieradvisor.com/api/paystack/webhook',
    publicGet: 'GET /api/paystack/webhook should return ok without auth',
  });
}

export async function POST(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;

  const body = await request.json().catch(() => ({}));
  const note = String(body.note || 'ops ping').slice(0, 200);

  await recordPaystackWebhookPulse({
    event: 'ops.ping',
    reference: `ping-${Date.now()}`,
    handled: 'ops_ping',
    action: 'billing.paystack_webhook_ping',
    summary: `Ops Paystack pulse ping: ${note}`,
    metadata: { source: 'paystack-webhook-ping', note },
  });

  const pulse = await loadPaystackWebhookPulse();
  return NextResponse.json({
    ok: true,
    written: true,
    pulse,
    next:
      pulse.status === 'ok'
        ? 'Pulse green — still configure Paystack Dashboard webhook for real charge.success'
        : 'If still never/stale, check activity_log permissions / service role',
  });
}
