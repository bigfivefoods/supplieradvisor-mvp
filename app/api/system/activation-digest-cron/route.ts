import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { loadOpsBoard } from '@/lib/system/ops-board';
import { getResend, getResendFrom } from '@/lib/resend';

/**
 * GET/POST — Weekly ops digest: activation funnel + P0 readiness.
 * Auth: CRON_SECRET. Emails OPS_ALERT_EMAIL.
 */
export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  return run();
}

export async function POST(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  return run();
}

async function run() {
  try {
    const board = await loadOpsBoard();
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
    if (opsEmail.length && process.env.RESEND_API_KEY) {
      const a = board.analytics;
      const r = board.readiness;
      const resend = getResend();
      await resend.emails.send({
        from: getResendFrom(),
        to: opsEmail.slice(0, 5),
        subject: `[SupplierAdvisor] Weekly ops digest · p0=${
          r.ok ? 'ok' : 'blockers'
        } · claims ${a.claimsConfirmed24h} confirmed`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
            <h2>Activation & settle digest (24h)</h2>
            <ul>
              <li>First-trade bootstrap: <strong>${a.firstTradeBootstrap24h}</strong></li>
              <li>First-trade sent: <strong>${a.firstTradeSent24h}</strong></li>
              <li>Claims confirmed: <strong>${a.claimsConfirmed24h}</strong></li>
              <li>Claims open: <strong>${a.claimsPending}</strong></li>
              <li>Connections accepted: <strong>${a.connectionAccepted24h}</strong></li>
              <li>Request-to-trade: <strong>${a.requestToTrade24h}</strong></li>
              <li>Ratings published: <strong>${a.ratingsPublished24h}</strong></li>
              <li>Invites 24h: <strong>${board.invites24h}</strong></li>
              <li>CIPC SLA breaches: <strong>${board.cipc.slaBreaches}</strong></li>
              <li>Paystack webhook age h: <strong>${
                board.paystack.ageHours ?? '—'
              }</strong></li>
            </ul>
            <h3>P0 readiness</h3>
            <p><strong>${r.ok ? 'OK' : 'BLOCKERS'}</strong></p>
            <ul>${(r.blockers || [])
              .map((b) => `<li style="color:#b91c1c">${b}</li>`)
              .join('')}${(r.warnings || [])
          .map((w) => `<li style="color:#b45309">${w}</li>`)
          .join('')}</ul>
            <p>Deploy: <code>${
              board.deploy.commitShort || board.deploy.commit || '—'
            }</code></p>
            <p><a href="https://www.supplieradvisor.com/dashboard/my-business/ops">Open ops plane →</a></p>
          </div>
        `,
      });
      emailed = true;
    }

    return NextResponse.json({
      ok: true,
      emailed,
      opsRecipients: opsEmail.length,
      readiness: board.readiness,
      analytics: board.analytics,
      at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
