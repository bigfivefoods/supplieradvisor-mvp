import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  assertSalesPortalAccess,
  getOrCreateAgreement,
  mapAgreementRow,
} from '@/lib/sales-contractor/access';
import {
  SALES_SUBSCRIPTION_MONTHLY_ZAR,
  SALES_SUBSCRIPTION_PRODUCT,
  SALES_SUBSCRIPTION_TERM_MONTHS,
  SALES_SUBSCRIPTION_TOTAL_CENTS,
  SALES_SUBSCRIPTION_TOTAL_ZAR,
  addMonths,
  computeSubscriptionInfo,
} from '@/lib/sales-contractor/subscription';
import { logActivity } from '@/lib/customers/access';
import { DEFAULT_COMMISSION_TIERS } from '@/lib/sales-contractor/commission';

/**
 * GET ?companyId=&privyUserId=
 * Subscription status + pricing for sales contractor portal.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const ctx = await assertSalesPortalAccess(privyUserId, companyId);
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const agr = await getOrCreateAgreement({
      companyId,
      memberId: ctx.memberId,
      userId: ctx.userId,
      name: ctx.name,
      email: ctx.email,
    });
    if (!agr.ok) {
      return NextResponse.json({ error: agr.error }, { status: agr.status });
    }

    const sub = agr.agreement.subscription || computeSubscriptionInfo({});
    const effectiveSub = ctx.subscriptionExempt
      ? {
          ...sub,
          status: 'active' as const,
          isActive: true,
          daysRemaining: null,
        }
      : sub;

    return NextResponse.json({
      success: true,
      companyName: ctx.companyName,
      isSalesContractor: ctx.isSalesContractor,
      subscriptionExempt: ctx.subscriptionExempt,
      agreementSigned:
        ctx.subscriptionExempt || agr.agreement.status === 'signed',
      subscription: effectiveSub,
      pricing: {
        monthlyZar: SALES_SUBSCRIPTION_MONTHLY_ZAR,
        termMonths: SALES_SUBSCRIPTION_TERM_MONTHS,
        totalZar: SALES_SUBSCRIPTION_TOTAL_ZAR,
        totalCents: SALES_SUBSCRIPTION_TOTAL_CENTS,
        currency: 'ZAR',
        product: SALES_SUBSCRIPTION_PRODUCT,
        description: `Sales Contractor Portal — R${SALES_SUBSCRIPTION_MONTHLY_ZAR}/mo × ${SALES_SUBSCRIPTION_TERM_MONTHS} months`,
      },
      agreementId: agr.agreement.id,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST — activate subscription after successful Paystack payment.
 * Body: { companyId, privyUserId, paystackReference }
 *
 * Charges the full 6-month term (R199 × 6 = R1,194) prepaid.
 * Owners/admins are not required to subscribe (portal for contractors).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const ctx = await assertSalesPortalAccess(body.privyUserId, companyId);
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const paystackReference = String(
      body.paystackReference || body.reference || ''
    ).trim();
    if (!paystackReference) {
      return NextResponse.json(
        {
          error: 'Payment reference required',
          hint: 'Complete Paystack checkout for the 6-month Sales Contractor subscription.',
        },
        { status: 400 }
      );
    }

    const agr = await getOrCreateAgreement({
      companyId,
      memberId: ctx.memberId,
      userId: ctx.userId,
      name: ctx.name,
      email: ctx.email,
    });
    if (!agr.ok) {
      return NextResponse.json({ error: agr.error }, { status: agr.status });
    }

    // Idempotent: same ref already applied
    if (
      agr.agreement.subscription_paystack_ref === paystackReference &&
      agr.agreement.subscription?.isActive
    ) {
      return NextResponse.json({
        success: true,
        alreadyActive: true,
        agreement: agr.agreement,
        subscription: agr.agreement.subscription,
      });
    }

    if (agr.agreement.subscription?.isActive) {
      return NextResponse.json({
        success: true,
        alreadyActive: true,
        agreement: agr.agreement,
        subscription: agr.agreement.subscription,
      });
    }

    const supabase = getSupabaseServer();

    // Prevent double-use of a payment reference across rows
    const { data: existingRef } = await supabase
      .from('sales_contractor_agreements')
      .select('id')
      .eq('subscription_paystack_ref', paystackReference)
      .maybeSingle();
    if (existingRef && Number(existingRef.id) !== agr.agreement.id) {
      return NextResponse.json(
        { error: 'This payment reference was already used.' },
        { status: 409 }
      );
    }

    const starts = new Date();
    const ends = addMonths(starts, SALES_SUBSCRIPTION_TERM_MONTHS);
    const now = starts.toISOString();

    const { data, error } = await supabase
      .from('sales_contractor_agreements')
      .update({
        subscription_status: 'active',
        subscription_starts_at: now,
        subscription_ends_at: ends.toISOString(),
        subscription_paystack_ref: paystackReference,
        subscription_amount_zar: SALES_SUBSCRIPTION_TOTAL_ZAR,
        subscription_term_months: SALES_SUBSCRIPTION_TERM_MONTHS,
        commission_tiers: DEFAULT_COMMISSION_TIERS,
        updated_at: now,
      })
      .eq('id', agr.agreement.id)
      .select('*')
      .single();

    if (error) {
      if (/column|subscription_/i.test(error.message)) {
        return NextResponse.json(
          {
            error: error.message,
            hint: 'Run supabase/migrations/20260710_sales_contractor_subscription.sql',
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const mapped = mapAgreementRow(data as Record<string, unknown>);

    void logActivity({
      profile_id: companyId,
      actor_user_id: ctx.userId,
      action: 'sales_contractor.subscription_activated',
      entity_type: 'sales_contractor_agreement',
      entity_id: String(agr.agreement.id),
      summary: `Sales contractor portal subscription activated (${SALES_SUBSCRIPTION_TERM_MONTHS} mo · R${SALES_SUBSCRIPTION_TOTAL_ZAR})`,
      metadata: {
        paystackReference,
        monthlyZar: SALES_SUBSCRIPTION_MONTHLY_ZAR,
        totalZar: SALES_SUBSCRIPTION_TOTAL_ZAR,
        endsAt: ends.toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      agreement: mapped,
      subscription: mapped.subscription,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
