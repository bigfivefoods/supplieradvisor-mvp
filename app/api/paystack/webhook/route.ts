import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { getPaystackSecretKey } from '@/lib/billing/paystack';
import { clawbackReferralForSourceRef } from '@/lib/billing/referral-controls';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  loadPaystackWebhookPulse,
  recordPaystackWebhookPulse,
} from '@/lib/system/paystack-pulse';

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

      // Core OS + Industry Pack payments (browser closed after Paystack / Apple Pay)
      try {
        const {
          companyIdFromPaystackData,
          packIdsFromPaystackData,
          productFromPaystackData,
          applyPaidIndustryPacks,
        } = await import('@/lib/billing/apply-paid-packs');
        const product = productFromPaystackData(data);
        const isSaaS =
          product.includes('company_saas') ||
          product.includes('industry_pack') ||
          product === 'packs' ||
          reference.startsWith('sa-co-sub-') ||
          reference.startsWith('sa-co-ap-') ||
          reference.startsWith('sa-packs-');

        if (isSaaS || packIdsFromPaystackData(data).length > 0) {
          let companyId = companyIdFromPaystackData(data);
          if (!companyId) {
            try {
              const { companyIdFromPaystackCharge: fromCharge } = await import(
                '@/lib/business/cipc-after-payment'
              );
              companyId = fromCharge(data);
            } catch {
              companyId = null;
            }
          }
          if (companyId) {
            const { verifyPaystackTransaction } = await import(
              '@/lib/billing/paystack'
            );
            const { addMonths } = await import(
              '@/lib/billing/company-subscription'
            );
            const v = await verifyPaystackTransaction(reference, {
              expectedCurrency: 'ZAR',
            });
            if (!v.ok && process.env.NODE_ENV === 'production') {
              void recordPaystackWebhookPulse({
                event: eventName,
                reference,
                companyId,
                handled: 'subscription_verify_failed',
                summary: v.error,
              });
              return NextResponse.json({
                received: true,
                handled: 'subscription_verify_failed',
                reason: v.error,
              });
            }

            const packIds = packIdsFromPaystackData(data);
            const packsOnly =
              product.includes('industry_pack') ||
              product === 'packs' ||
              reference.startsWith('sa-packs-');

            // Infer months from metadata term or default 1
            let months = 1;
            const meta = data.metadata as Record<string, unknown> | undefined;
            if (meta) {
              if (meta.months != null && Number(meta.months) > 0) {
                months = Number(meta.months);
              } else if (Array.isArray(meta.custom_fields)) {
                for (const f of meta.custom_fields as Array<
                  Record<string, unknown>
                >) {
                  if (String(f.variable_name) === 'months') {
                    const n = Number(f.value);
                    if (n > 0) months = n;
                  }
                  if (String(f.variable_name) === 'term_id') {
                    const t = String(f.value);
                    if (t === '1y') months = 12;
                    if (t === '2y') months = 24;
                    if (t === '3y') months = 36;
                  }
                }
              }
            }

            const supabase = getSupabaseServer();
            const periodEnd = addMonths(new Date(), months).toISOString();
            const channel = v.ok ? v.channel : String(data.channel || '');

            if (!packsOnly) {
              // Activate / extend Core subscription
              const paidZar = v.ok
                ? Math.round(v.amount / 100)
                : Number(data.amount || 0) / 100;
              await supabase
                .from('profiles')
                .update({
                  subscription_status: 'active',
                  subscription_ends_at: periodEnd,
                  subscription_paystack_ref: reference,
                  subscription_amount_zar: paidZar,
                  subscription_plan: packsOnly
                    ? 'packs'
                    : packIds.length
                      ? 'company_plus_packs'
                      : 'company_monthly',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', companyId);
            }

            let packResult = null;
            if (packIds.length) {
              packResult = await applyPaidIndustryPacks(supabase, {
                companyId,
                packIds,
                paidUntil: periodEnd,
                paystackReference: reference,
                channel,
              });
            }

            // Append billing ledger for receipt PDFs
            try {
              const { data: full } = await supabase
                .from('profiles')
                .select('metadata')
                .eq('id', companyId)
                .maybeSingle();
              const meta =
                full?.metadata && typeof full.metadata === 'object'
                  ? { ...(full.metadata as Record<string, unknown>) }
                  : {};
              const { appendBillingLedger } = await import(
                '@/lib/billing/billing-ledger'
              );
              const paidZar = v.ok
                ? Math.round(v.amount / 100)
                : Number(data.amount || 0) / 100;
              const amountCents = v.ok
                ? v.amount
                : Number(data.amount || 0);
              const { meta: nextMeta } = appendBillingLedger(
                meta,
                {
                  at: new Date().toISOString(),
                  kind: packsOnly
                    ? 'packs'
                    : packIds.length
                      ? 'core_plus_packs'
                      : 'core',
                  ref: reference,
                  amountZar: paidZar,
                  amountCents,
                  currency: 'ZAR',
                  months,
                  packIds,
                  channel,
                  note: 'Paystack webhook activation',
                },
                companyId
              );
              await supabase
                .from('profiles')
                .update({
                  metadata: nextMeta,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', companyId);
            } catch {
              /* soft */
            }

            void recordPaystackWebhookPulse({
              event: eventName,
              reference,
              companyId,
              handled: packsOnly
                ? 'packs_activated'
                : 'subscription_activated',
              summary: `Webhook → ${packsOnly ? 'packs' : 'subscription'}${packIds.length ? ` +${packIds.length} packs` : ''} · ${channel || 'channel?'}`,
              metadata: { packIds, packsOnly, packResult, channel },
            });

            return NextResponse.json({
              received: true,
              handled: packsOnly
                ? 'packs_activated'
                : 'subscription_activated',
              reference,
              companyId,
              packIds,
              channel,
              packResult,
            });
          }
        }
      } catch (e) {
        console.warn('[paystack webhook] subscription/packs soft-fail', e);
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

/** GET — Paystack dashboard probe / ops reachability (no signature). */
export async function GET(request: NextRequest) {
  // Optional: ?ping=1 records a soft heartbeat so health pulse leaves "never"
  const ping = request.nextUrl.searchParams.get('ping');
  if (ping === '1' || ping === 'true') {
    await recordPaystackWebhookPulse({
      event: 'http.get_probe',
      reference: `get-probe-${Date.now()}`,
      handled: 'get_probe',
      action: 'billing.paystack_webhook_ping',
      summary: 'Paystack webhook endpoint GET probe (public reachability)',
      metadata: { source: 'GET /api/paystack/webhook?ping=1' },
    });
  }
  const pulse = await loadPaystackWebhookPulse();
  return NextResponse.json({
    ok: true,
    service: 'paystack-webhook',
    path: '/api/paystack/webhook',
    configure:
      'Paystack Dashboard → Settings → Webhooks → https://www.supplieradvisor.com/api/paystack/webhook',
    events: ['charge.success', 'refund.*'],
    public: true,
    pulse,
    tip: 'Append ?ping=1 once after deploy to seed ops pulse without a real payment',
  });
}
