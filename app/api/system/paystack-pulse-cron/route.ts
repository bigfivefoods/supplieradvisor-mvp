import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { loadPaystackWebhookPulse } from '@/lib/system/paystack-pulse';
import { getResend, getResendFrom } from '@/lib/resend';

/**
 * GET/POST — Alert ops if Paystack webhook activity is stale.
 * Emails OPS_ALERT_EMAIL (or PAYSTACK_OPS_EMAIL) when ageHours >= threshold (default 72).
 */
export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  return run(request);
}

export async function POST(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  return run(request);
}

async function run(request: NextRequest) {
  try {
    const threshold = Number(
      request.nextUrl.searchParams.get('thresholdHours') ||
        process.env.PAYSTACK_WEBHOOK_STALE_HOURS ||
        72
    );
    const force = ['1', 'true'].includes(
      String(request.nextUrl.searchParams.get('force') || '').toLowerCase()
    );
    const secretOk = Boolean(
      process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET
    );
    const pulse = await loadPaystackWebhookPulse();
    const stale =
      force ||
      !secretOk ||
      pulse.stale ||
      (pulse.ageHours != null && pulse.ageHours >= threshold) ||
      (!pulse.lastAt && secretOk);

    const opsEmail = (
      process.env.OPS_ALERT_EMAIL ||
      process.env.PAYSTACK_OPS_EMAIL ||
      process.env.RESEND_REPLY_TO ||
      ''
    )
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));

    let emailed = false;
    if (stale && opsEmail.length && process.env.RESEND_API_KEY) {
      const resend = getResend();
      await resend.emails.send({
        from: getResendFrom(),
        to: opsEmail.slice(0, 5),
        subject: `[SupplierAdvisor] Paystack webhook ${
          !secretOk ? 'secret missing' : 'stale'
        }`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#b91c1c">Paystack webhook attention</h2>
            <ul>
              <li>Secret configured: <strong>${secretOk ? 'yes' : 'no'}</strong></li>
              <li>Last event: <strong>${pulse.lastAt || 'never'}</strong></li>
              <li>Age hours: <strong>${pulse.ageHours ?? '—'}</strong></li>
              <li>Last 24h count: <strong>${pulse.last24hCount}</strong></li>
              <li>Last summary: ${pulse.lastSummary || '—'}</li>
            </ul>
            <p>Webhook URL: <code>https://www.supplieradvisor.com/api/paystack/webhook</code></p>
            <p>Events: <code>charge.success</code> (CIPC R69). Check Paystack Dashboard → Webhooks.</p>
          </div>
        `,
      });
      emailed = true;
    }

    return NextResponse.json({
      ok: true,
      stale,
      secretOk,
      thresholdHours: threshold,
      pulse,
      emailed,
      opsRecipients: opsEmail.length,
      at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
