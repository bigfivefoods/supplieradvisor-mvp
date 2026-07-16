import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { getPaystackSecretKey } from '@/lib/billing/paystack';
import { clawbackReferralForSourceRef } from '@/lib/billing/referral-controls';
import { getSupabaseServer } from '@/lib/supabase/server-client';

export const runtime = 'nodejs';

/**
 * POST /api/paystack/webhook
 * Verify Paystack signature; on charge.refund / refund.processed claw back referral fees.
 *
 * Configure in Paystack Dashboard → Settings → Webhooks:
 *   https://www.supplieradvisor.com/api/paystack/webhook
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

    // Refund / reverse paths from Paystack
    const isRefund =
      eventName.includes('refund') ||
      eventName === 'charge.dispute.create' ||
      (eventName === 'charge.success' &&
        String(data.status || '').toLowerCase() === 'reversed');

    const reference = String(
      data.reference ||
        data.transaction_reference ||
        (data.transaction as { reference?: string } | undefined)?.reference ||
        ''
    ).trim();

    if (isRefund && reference) {
      const claw = await clawbackReferralForSourceRef({
        sourceRef: reference,
        reason: `Paystack webhook: ${eventName}`,
        actorUserId: 'paystack:webhook',
      });

      try {
        const supabase = getSupabaseServer();
        await supabase.from('audit_activity').insert({
          action: 'billing.paystack_refund_webhook',
          entity_type: 'paystack',
          entity_id: reference,
          summary: `Refund webhook ${eventName}: voided ${claw.voided}, clawbacks ${claw.clawbacksOpened}`,
          metadata: { event: eventName, claw, data },
          created_at: new Date().toISOString(),
        });
      } catch {
        /* audit table optional */
      }

      return NextResponse.json({
        received: true,
        handled: 'referral_clawback',
        reference,
        ...claw,
      });
    }

    return NextResponse.json({ received: true, handled: 'ignored', event: eventName });
  } catch (e: unknown) {
    console.error('Paystack webhook error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Webhook error' },
      { status: 500 }
    );
  }
}
