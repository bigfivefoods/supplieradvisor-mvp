/**
 * POST /api/services/advisor/deposit
 * Initialize Paystack deposit for an Advisor booking.
 * Body: companyId, module, booking_id, email?, amount_zar?
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { initializePaystackTransaction } from '@/lib/billing/paystack-plans';
import {
  depositReference,
  markDepositPaid,
  newDepositPending,
  normalizeDepositPolicy,
} from '@/lib/services/advisor-deposits';
import { appendAdvisorEvent } from '@/lib/services/advisor-events';
import { getAppUrl } from '@/lib/resend';
import {
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
} from '@/lib/fitness/fitgraph';
import {
  readDentalgraphFromMetadata,
  writeDentalgraphToMetadata,
} from '@/lib/dental/dentalgraph';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const module = String(body.module || 'fitgraph');
    const bookingId = String(body.booking_id || '');
    if (!Number.isFinite(companyId) || !bookingId) {
      return NextResponse.json(
        { error: 'companyId and booking_id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: prof } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', companyId)
      .maybeSingle();
    let meta =
      prof?.metadata && typeof prof.metadata === 'object'
        ? { ...(prof.metadata as Record<string, unknown>) }
        : {};

    const action = String(body.action || 'initialize');

    if (module === 'fitgraph') {
      const store = readFitgraphFromMetadata(meta);
      const booking = store.bookings.find((b) => b.id === bookingId);
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      const client = store.clients.find((c) => c.id === booking.client_id);
      const policy = normalizeDepositPolicy(
        (store.settings as { deposit_policy?: Parameters<typeof normalizeDepositPolicy>[0] })
          ?.deposit_policy
      );
      const amount =
        Number(body.amount_zar) > 0
          ? Number(body.amount_zar)
          : policy.amount_zar || 150;

      if (action === 'mark_paid' || action === 'waive') {
        (booking as { deposit?: ReturnType<typeof markDepositPaid> }).deposit =
          action === 'waive'
            ? {
                required: false,
                amount_zar: amount,
                status: 'waived',
                paid_at: new Date().toISOString(),
              }
            : markDepositPaid(
                (booking as { deposit?: ReturnType<typeof markDepositPaid> }).deposit
              );
        const ev = appendAdvisorEvent(meta, {
          module: 'fitgraph',
          company_id: companyId,
          type: action === 'waive' ? 'deposit.required' : 'deposit.paid',
          person_id: booking.client_id,
          booking_id: booking.id,
          amount_zar: amount,
          meta: { action },
        });
        meta = writeFitgraphToMetadata(ev.metadata, store);
        await supabase
          .from('profiles')
          .update({ metadata: meta, updated_at: new Date().toISOString() })
          .eq('id', companyId);
        return NextResponse.json({
          success: true,
          deposit: (booking as { deposit?: unknown }).deposit,
        });
      }

      const email = String(body.email || client?.email || '').trim();
      if (!email) {
        return NextResponse.json(
          { error: 'Client email required for Paystack deposit' },
          { status: 400 }
        );
      }
      const ref = depositReference({
        module: 'fitgraph',
        companyId,
        bookingId,
      });
      const init = await initializePaystackTransaction({
        email,
        amountCents: Math.round(amount * 100),
        currency: policy.currency || 'ZAR',
        reference: ref,
        callbackUrl: `${getAppUrl()}/dashboard/fitgraph/bookings?deposit=1`,
        metadata: {
          advisor_module: 'fitgraph',
          company_id: companyId,
          booking_id: bookingId,
          client_id: booking.client_id,
          purpose: 'advisor_deposit',
        },
      });
      const pending = newDepositPending(amount, ref);
      if (init.ok) {
        pending.authorization_url = init.authorizationUrl;
        pending.paystack_reference = init.reference;
      }
      (booking as { deposit?: typeof pending }).deposit = pending;
      const ev = appendAdvisorEvent(meta, {
        module: 'fitgraph',
        company_id: companyId,
        type: 'deposit.required',
        person_id: booking.client_id,
        booking_id: booking.id,
        amount_zar: amount,
        meta: { reference: ref, paystack_ok: init.ok },
      });
      meta = writeFitgraphToMetadata(ev.metadata, store);
      await supabase
        .from('profiles')
        .update({ metadata: meta, updated_at: new Date().toISOString() })
        .eq('id', companyId);

      if (!init.ok) {
        return NextResponse.json({
          success: true,
          deposit: pending,
          warning: init.error,
          message:
            'Deposit recorded as pending. Configure PAYSTACK_SECRET_KEY to collect card payments.',
        });
      }
      return NextResponse.json({
        success: true,
        deposit: pending,
        authorization_url: init.authorizationUrl,
        access_code: init.accessCode,
        reference: init.reference,
      });
    }

    if (module === 'dentalgraph') {
      const store = readDentalgraphFromMetadata(meta);
      const booking = store.bookings.find((b) => b.id === bookingId);
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      const patient = store.patients.find((p) => p.id === booking.patient_id);
      const policy = normalizeDepositPolicy(
        (store.settings as { deposit_policy?: Parameters<typeof normalizeDepositPolicy>[0] })
          ?.deposit_policy
      );
      const amount =
        Number(body.amount_zar) > 0
          ? Number(body.amount_zar)
          : policy.amount_zar || 150;
      const email = String(body.email || patient?.email || '').trim();
      if (!email) {
        return NextResponse.json(
          { error: 'Patient email required for deposit' },
          { status: 400 }
        );
      }
      const ref = depositReference({
        module: 'dentalgraph',
        companyId,
        bookingId,
      });
      const init = await initializePaystackTransaction({
        email,
        amountCents: Math.round(amount * 100),
        currency: 'ZAR',
        reference: ref,
        callbackUrl: `${getAppUrl()}/dashboard/dentalgraph/bookings?deposit=1`,
        metadata: {
          advisor_module: 'dentalgraph',
          company_id: companyId,
          booking_id: bookingId,
          purpose: 'advisor_deposit',
        },
      });
      const pending = newDepositPending(amount, ref);
      if (init.ok) {
        pending.authorization_url = init.authorizationUrl;
        pending.paystack_reference = init.reference;
      }
      (booking as { deposit?: typeof pending }).deposit = pending;
      meta = writeDentalgraphToMetadata(meta, store);
      await supabase
        .from('profiles')
        .update({ metadata: meta, updated_at: new Date().toISOString() })
        .eq('id', companyId);
      return NextResponse.json({
        success: true,
        deposit: pending,
        authorization_url: init.ok ? init.authorizationUrl : null,
        warning: init.ok ? undefined : init.error,
      });
    }

    return NextResponse.json(
      { error: `Module ${module} deposit not wired yet` },
      { status: 400 }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
