import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { loadPaystackWebhookPulse } from '@/lib/system/paystack-pulse';
import { getResend, getResendFrom } from '@/lib/resend';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { buildVerificationSla } from '@/lib/business/verification-sla';
import { runCipcAfterPayment } from '@/lib/business/cipc-after-payment';

/**
 * GET/POST — Paystack ops reliability:
 * 1) Alert if webhook activity is stale
 * 2) Auto-replay paid-not-badged dead letters (SLA)
 * 3) Email ops on SLA breaches (paid > 24h, still not terminal)
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
    const autoRerun = !['0', 'false'].includes(
      String(
        request.nextUrl.searchParams.get('autoRerun') ||
          process.env.PAYSTACK_SLA_AUTO_RERUN ||
          '1'
      ).toLowerCase()
    );
    const rerunLimit = Math.min(
      15,
      Math.max(
        1,
        Number(
          request.nextUrl.searchParams.get('rerunLimit') ||
            process.env.PAYSTACK_SLA_RERUN_LIMIT ||
            8
        )
      )
    );

    const secretOk = Boolean(
      process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET
    );
    const pulse = await loadPaystackWebhookPulse();
    // Never-seen is a config warning (status=never), not an infinite "broken" firehose
    // once secret is set — still alert until first webhook lands.
    const stale =
      force ||
      !secretOk ||
      pulse.status === 'stale' ||
      (pulse.ageHours != null && pulse.ageHours >= threshold) ||
      (pulse.status === 'never' && secretOk);

    // ── Dead-letter auto-replay + SLA breach scan ──────────────────────────
    const deadLetter: Array<{
      companyId: number;
      name: string | null;
      status: string;
      hoursSincePaid: number | null;
      slaBreached: boolean;
      rerun?: string;
    }> = [];
    const breaches: typeof deadLetter = [];

    if (autoRerun || force) {
      const supabase = getSupabaseServer();
      const { data: rows } = await supabase
        .from('profiles')
        .select(
          'id, trading_name, legal_name, verification_status, verification_payment_ref, metadata, updated_at'
        )
        .in('verification_status', [
          'pending',
          'failed',
          'mismatch',
          'unverified',
        ])
        .order('updated_at', { ascending: false })
        .limit(60);

      let rerunBudget = rerunLimit;
      for (const p of rows || []) {
        const sla = buildVerificationSla(p as Record<string, unknown>);
        if (!sla.hasPayment || !sla.paystackReference) continue;
        if (sla.phase === 'verified') continue;

        const item = {
          companyId: Number(p.id),
          name: (p.trading_name || p.legal_name || null) as string | null,
          status: sla.verificationStatus,
          hoursSincePaid: sla.hoursSincePaid,
          slaBreached: sla.slaBreached,
        };
        deadLetter.push(item);
        if (sla.slaBreached) breaches.push(item);

        // Auto re-run pending/failed (not mismatch — needs human name apply)
        if (
          autoRerun &&
          rerunBudget > 0 &&
          (sla.phase === 'paid_pending' || sla.phase === 'failed') &&
          (sla.slaAtRisk || sla.slaBreached || force)
        ) {
          const result = await runCipcAfterPayment({
            companyId: item.companyId,
            paystackReference: sla.paystackReference,
            actorUserId: 'ops:paystack-pulse-cron',
            source: 'paystack_sla_auto_rerun',
          });
          (item as { rerun?: string }).rerun = result.status;
          rerunBudget -= 1;
          try {
            await supabase.from('activity_log').insert({
              profile_id: item.companyId,
              actor_user_id: 'ops:paystack-pulse-cron',
              action: 'billing.paystack_dead_letter',
              entity_type: 'profiles',
              entity_id: String(item.companyId),
              summary: `SLA auto-rerun → ${result.status}: ${result.message}`,
              metadata: { result, hoursSincePaid: sla.hoursSincePaid },
            });
          } catch {
            /* soft */
          }
        }
      }
    }

    const { getOpsAlertEmails } = await import('@/lib/system/ops-alert-email');
    const opsEmail = getOpsAlertEmails();

    let emailed = false;
    const shouldEmail =
      (stale || breaches.length > 0 || force) &&
      opsEmail.length > 0 &&
      Boolean(process.env.RESEND_API_KEY);

    if (shouldEmail) {
      const resend = getResend();
      const breachHtml = breaches.length
        ? `<h3 style="color:#b91c1c">CIPC SLA breaches (paid ≥ 24h, not terminal)</h3>
           <ul>${breaches
             .slice(0, 20)
             .map(
               (b) =>
                 `<li>#${b.companyId} ${b.name || ''} — ${b.status} · ${b.hoursSincePaid ?? '?'}h · rerun=${b.rerun || '—'}</li>`
             )
             .join('')}</ul>`
        : '';
      await resend.emails.send({
        from: getResendFrom(),
        to: opsEmail.slice(0, 5),
        subject: `[SupplierAdvisor] Paystack ${
          !secretOk
            ? 'secret missing'
            : breaches.length
              ? `CIPC SLA ${breaches.length} breach(es)`
              : 'webhook stale'
        }`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#b91c1c">Paystack / CIPC attention</h2>
            <ul>
              <li>Secret configured: <strong>${secretOk ? 'yes' : 'no'}</strong></li>
              <li>Last webhook: <strong>${pulse.lastAt || 'never'}</strong></li>
              <li>Age hours: <strong>${pulse.ageHours ?? '—'}</strong></li>
              <li>Last 24h count: <strong>${pulse.last24hCount}</strong></li>
              <li>Dead-letter candidates: <strong>${deadLetter.length}</strong></li>
              <li>SLA breaches: <strong>${breaches.length}</strong></li>
              <li>Last summary: ${pulse.lastSummary || '—'}</li>
            </ul>
            ${breachHtml}
            <p>Webhook: <code>https://www.supplieradvisor.com/api/paystack/webhook</code></p>
            <p>Replay: <code>POST /api/system/paystack-dead-letter</code> or Verifications ops UI.</p>
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
      deadLetterCount: deadLetter.length,
      slaBreaches: breaches.length,
      autoRerun,
      rerunSample: deadLetter.filter((d) => d.rerun).slice(0, 10),
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
