import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { getPaystackSecretKey } from '@/lib/billing/paystack';
import { clawbackReferralForSourceRef } from '@/lib/billing/referral-controls';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { recordPaystackWebhookPulse } from '@/lib/system/paystack-pulse';

export const runtime = 'nodejs';

/**
 * POST /api/paystack/webhook
 * Verify Paystack signature; on charge.success run CIPC; always record pulse.
 *
 * Configure in Paystack Dashboard → Settings → Webhooks:
 *   https://www.supplieradvisor.com/api/paystack/webhook
 *
 * Must stay public (no Privy) — middleware allows paths containing /webhook.
 */
export async function POST(request: NextRequest) {
  try {
    const secret = getPaystackSecretKey();
    const raw = await request.text();
    const signature = request.headers.get('x-paystack-signature') || '';

    if (secret) {
      const hash = createHmac('sha512', secret).update(raw).digest('hex');
      const a = Buffer.from(hash);
      const b = Buffer.from(signature);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else if (
      process.env.NODE_ENV === 'production' ||
      process.env.VERCEL_ENV === 'production'
    ) {
      return NextResponse.json(
        { error: 'PAYSTACK_SECRET_KEY not configured' },
        { status: 503 }
      );
    }

    const event = JSON.parse(raw || '{}') as {
      event?: string;
      data?: Record<string, unknown>;
    };
    const eventName = String(event.event || '').toLowerCase();
    const data = event.data || {};

    const reference = String(
      data.reference ||
        data.transaction_reference ||
        (data.transaction as { reference?: string } | undefined)?.reference ||
        ''
    ).trim();

    // Heartbeat: every accepted webhook updates ops pulse (even ignored events)
    void recordPaystackWebhookPulse({
      event: eventName || 'unknown',
      reference: reference || null,
      handled: 'received',
      summary: `Paystack webhook received: ${eventName || 'unknown'}`,
      action: 'billing.paystack_webhook_received',
      metadata: {
        status: data.status != null ? String(data.status) : null,
        amount: data.amount != null ? Number(data.amount) : null,
        currency: data.currency != null ? String(data.currency) : null,
      },
    });

    // Refund / reverse paths from Paystack
    const isRefund =
      eventName.includes('refund') ||
      eventName === 'charge.dispute.create' ||
      (eventName === 'charge.success' &&
        String(data.status || '').toLowerCase() === 'reversed');

    if (isRefund && reference) {
      const claw = await clawbackReferralForSourceRef({
        sourceRef: reference,
        reason: `Paystack webhook: ${eventName}`,
        actorUserId: 'paystack:webhook',
      });

      void recordPaystackWebhookPulse({
        event: eventName,
        reference,
        handled: 'referral_clawback',
        action: 'billing.paystack_refund_webhook',
        summary: `Refund webhook ${eventName}: voided ${claw.voided}, clawbacks ${claw.clawbacksOpened}`,
        metadata: { claw },
      });

      try {
        const supabase = getSupabaseServer();
        await supabase.from('activity_log').insert({
          actor_user_id: 'paystack:webhook',
          action: 'billing.paystack_refund_webhook',
          entity_type: 'paystack',
          entity_id: reference,
          summary: `Refund webhook ${eventName}: voided ${claw.voided}, clawbacks ${claw.clawbacksOpened}`,
          metadata: { event: eventName, claw, reference },
        });
      } catch {
        /* soft */
      }

      return NextResponse.json({
        received: true,
        handled: 'referral_clawback',
        reference,
        ...claw,
      });
    }

    // R69 CIPC company verification — run even if browser closed after Paystack
    if (
      (eventName === 'charge.success' || String(data.status || '') === 'success') &&
      reference
    ) {
      const {
        isCipcVerificationCharge,
        companyIdFromPaystackCharge,
        runCipcAfterPayment,
      } = await import('@/lib/business/cipc-after-payment');

      if (isCipcVerificationCharge(data)) {
        const companyId = companyIdFromPaystackCharge(data);
        if (companyId) {
          // Confirm with Paystack API when secret available
          try {
            const { verifyPaystackTransaction } = await import(
              '@/lib/billing/paystack'
            );
            const v = await verifyPaystackTransaction(reference, {
              expectedAmountCents: 6900,
              expectedCurrency: 'ZAR',
            });
            if (!v.ok && process.env.NODE_ENV === 'production') {
              void recordPaystackWebhookPulse({
                event: eventName,
                reference,
                companyId,
                handled: 'cipc_verify_skipped',
                action: 'billing.paystack_cipc_webhook',
                summary: `CIPC skipped: ${v.error}`,
              });
              return NextResponse.json({
                received: true,
                handled: 'cipc_verify_skipped',
                reason: v.error,
                reference,
                companyId,
              });
            }
          } catch {
            /* soft — still attempt CIPC if webhook sig was valid */
          }

          const result = await runCipcAfterPayment({
            companyId,
            paystackReference: reference,
            actorUserId: 'paystack:webhook',
            source: 'paystack_webhook',
          });

          void recordPaystackWebhookPulse({
            event: eventName,
            reference,
            companyId,
            handled: 'cipc_after_payment',
            action: 'billing.paystack_cipc_webhook',
            summary: `Paystack charge.success → CIPC ${result.status}: ${result.message}`,
            metadata: { result },
          });

          try {
            const supabase = getSupabaseServer();
            await supabase.from('activity_log').insert({
              profile_id: companyId,
              actor_user_id: 'paystack:webhook',
              action: 'billing.paystack_cipc_webhook',
              entity_type: 'profiles',
              entity_id: String(companyId),
              summary: `Paystack charge.success → CIPC ${result.status}: ${result.message}`,
              metadata: { reference, result, event: eventName },
            });
          } catch {
            /* soft */
          }

          return NextResponse.json({
            received: true,
            handled: 'cipc_after_payment',
            reference,
            companyId,
            cipc: result,
          });
        }
      }
    }

    return NextResponse.json({
      received: true,
      handled: 'ignored',
      event: eventName,
      pulse: true,
    });
  } catch (e: unknown) {
    console.error('Paystack webhook error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Webhook error' },
      { status: 500 }
    );
  }
}

/** GET — Paystack dashboard "Test webhook" / ops probe without signature */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'paystack-webhook',
    path: '/api/paystack/webhook',
    configure:
      'Paystack Dashboard → Settings → Webhooks → https://www.supplieradvisor.com/api/paystack/webhook',
    events: ['charge.success', 'refund.*'],
    public: true,
  });
}
