import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import {
  loadPaystackWebhookPulse,
  recordPaystackWebhookPulse,
} from '@/lib/system/paystack-pulse';
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

    // Soft reachability heartbeat (does not count as "real" delivery for stale)
    try {
      await recordPaystackWebhookPulse({
        event: 'cron.pulse',
        reference: `cron-probe-${Date.now()}`,
        handled: 'cron_probe',
        action: 'billing.paystack_webhook_ping',
        summary: 'Paystack pulse cron reachability probe',
        metadata: { source: 'paystack-pulse-cron' },
      });
    } catch {
      /* soft */
    }

    const pulse = await loadPaystackWebhookPulse();
    // Quiet paid traffic (no CIPC for a few days) is not an outage.
    // Email on missing secret, SLA breaches, or PAYSTACK_WARN_QUIET=1.
    const warnQuiet =
      String(process.env.PAYSTACK_WARN_QUIET || '').toLowerCase() === '1' ||
      String(process.env.PAYSTACK_WARN_QUIET || '').toLowerCase() === 'true';
    const quietHours =
      pulse.lastRealAgeHours != null && pulse.lastRealAgeHours >= threshold;
    const stale =
      force ||
      !secretOk ||
      (warnQuiet && (pulse.stale || quietHours));

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

    const replayed: Array<{ reference: string; handled: string | null; replay?: string }> =
      [];
    try {
      const supabase = getSupabaseServer();
      const failedQ = supabase
        .from('paystack_webhook_events')
        .select('reference, event, handled')
        .eq('event', 'charge.success')
        .in('handled', [
          'gym_sale_verify_failed',
          'gym_sale_failed',
          'member_account_verify_failed',
          'member_account_failed',
          'subscription_verify_failed',
          'cipc_verify_failed',
        ])
        .limit(rerunLimit);
      const openQ = supabase
        .from('paystack_webhook_events')
        .select('reference, event, handled')
        .eq('event', 'charge.success')
        .is('handled', null)
        .limit(rerunLimit);
      const [failedRes, openRes] = await Promise.all([failedQ, openQ]);
      const failedWh = [
        ...(failedRes.data || []),
        ...(openRes.data || []),
      ].slice(0, rerunLimit);
      if (failedWh?.length) {
        const { verifyPaystackTransaction } = await import('@/lib/billing/paystack');
        for (const row of failedWh) {
          const ref = String(row.reference || '');
          if (!ref) continue;
          const v = await verifyPaystackTransaction(ref, { expectedCurrency: 'ZAR' });
          if (!v.ok) {
            replayed.push({ reference: ref, handled: String(row.handled), replay: 'still_unverified' });
            continue;
          }
          const raw =
            v.raw && typeof v.raw === 'object'
              ? (v.raw as Record<string, unknown>)
              : {};
          const data: Record<string, unknown> = {
            ...raw,
            reference: ref,
            metadata: v.metadata,
            amount: v.amount,
          };
          let replay = 'skipped';
          try {
            if (ref.startsWith('gym-sale-') || String(row.handled).includes('gym')) {
              const { applyGymSalePaystack } = await import(
                '@/lib/b2c/gym-sale-apply-paystack'
              );
              const applied = await applyGymSalePaystack({ data, reference: ref });
              replay = applied.ok ? 'gym_sale_paid' : applied.error || 'gym_failed';
            } else if (String(row.handled).includes('member')) {
              const { applyMemberAccountPaystack } = await import(
                '@/lib/b2c/member-account-apply-paystack'
              );
              const applied = await applyMemberAccountPaystack({
                data,
                reference: ref,
                amountCents: v.amount,
              });
              replay = applied.ok ? 'member_account_paid' : applied.error || 'member_failed';
            } else if (
              ref.startsWith('sa-co-') ||
              ref.startsWith('sa-packs-') ||
              String(row.handled).includes('subscription')
            ) {
              replay = 'subscription_needs_webhook_payload';
            } else if (String(row.handled).includes('cipc')) {
              replay = 'cipc_via_sla_loop';
            }
          } catch (e) {
            replay = e instanceof Error ? e.message : 'replay_error';
          }
          replayed.push({ reference: ref, handled: String(row.handled), replay });
        }
      }
    } catch {
      /* table may be missing */
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
      replayed: replayed.slice(0, 20),
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
