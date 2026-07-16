import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getCompanyMembership } from '@/lib/business/access';
import { logActivity } from '@/lib/customers/access';
import {
  BILLING_TERMS,
  COMPANY_SUBSCRIPTION_MONTHLY_CENTS,
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_SUBSCRIPTION_PLAN,
  COMPANY_SUBSCRIPTION_PRODUCT,
  COMPANY_TRIAL_DAYS,
  SUBSCRIPTION_SELECT_FIELDS,
  addDays,
  addMonths,
  computeCompanySubscription,
  formatZar,
  getBillingTerm,
  resolveBillingTerm,
  type CompanySubscriptionInfo,
} from '@/lib/billing/company-subscription';
import {
  FOUNDING_FREE_COMPANY_LIMIT,
  isFounderLifetimeCompany,
  isLifetimeStatus,
  LIFETIME_PLAN_FOUNDER,
  LIFETIME_PLAN_FOUNDING,
} from '@/lib/billing/lifetime';
import { verifyPaystackTransaction } from '@/lib/billing/paystack';
import {
  creditSubscriptionReferralFees,
  ensureReferralCode,
  getReferralSummary,
  referralRatesSummary,
  referralSuggestedCopy,
} from '@/lib/billing/supply-chain-referral';

type ProfileSubRow = {
  id: number;
  trading_name?: string | null;
  legal_name?: string | null;
  email?: string | null;
  subscription_status?: string | null;
  subscription_trial_ends_at?: string | null;
  subscription_starts_at?: string | null;
  subscription_ends_at?: string | null;
  subscription_paystack_ref?: string | null;
  subscription_paystack_customer_code?: string | null;
  subscription_paystack_auth_code?: string | null;
  subscription_amount_zar?: number | null;
  subscription_plan?: string | null;
  created_at?: string | null;
};

function pricingPayload() {
  return {
    monthlyZar: COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
    monthlyCents: COMPANY_SUBSCRIPTION_MONTHLY_CENTS,
    trialDays: COMPANY_TRIAL_DAYS,
    currency: 'ZAR',
    product: COMPANY_SUBSCRIPTION_PRODUCT,
    plan: COMPANY_SUBSCRIPTION_PLAN,
    description: `SupplierAdvisor company plan — R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month after ${COMPANY_TRIAL_DAYS}-day free trial. Multi-year prepaid: 15% (1y), 25% (2y), 30% (3y).`,
    terms: BILLING_TERMS.map((t) => ({
      id: t.id,
      label: t.label,
      shortLabel: t.shortLabel,
      months: t.months,
      years: t.years,
      discountPercent: t.discountPercent,
      listZar: t.listZar,
      payZar: t.payZar,
      payCents: t.payCents,
      savingsZar: t.savingsZar,
      planCode: t.planCode,
      effectiveMonthlyZar: t.effectiveMonthlyZar,
      badge: t.badge || null,
    })),
  };
}

async function loadProfile(companyId: number): Promise<{
  ok: true;
  row: ProfileSubRow;
} | { ok: false; error: string; status: number; hint?: string }> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .select(SUBSCRIPTION_SELECT_FIELDS)
    .eq('id', companyId)
    .maybeSingle();

  if (error) {
    if (/column|subscription_/i.test(error.message)) {
      return {
        ok: false,
        error: error.message,
        status: 503,
        hint: 'Run supabase/migrations/20260712_company_subscription.sql',
      };
    }
    return { ok: false, error: error.message, status: 500 };
  }
  if (!data) {
    return { ok: false, error: 'Company not found', status: 404 };
  }
  return { ok: true, row: data as ProfileSubRow };
}

/**
 * Grant lifetime if founder company or within first N founding partners.
 * Idempotent.
 */
async function ensureLifetimeIfEligible(
  companyId: number,
  row: ProfileSubRow
): Promise<{ row: ProfileSubRow; subscription: CompanySubscriptionInfo; granted: boolean }> {
  const current = computeCompanySubscription(row);
  if (current.isLifetime || isLifetimeStatus(row.subscription_status)) {
    return { row, subscription: current, granted: false };
  }

  const founder = isFounderLifetimeCompany({
    id: companyId,
    tradingName: row.trading_name,
    legalName: row.legal_name,
  });

  let foundingSlot = false;
  if (!founder) {
    const supabase = getSupabaseServer();
    // First N companies by created_at (founding partners) get free lifetime
    const { data: earliest } = await supabase
      .from('profiles')
      .select('id')
      .order('created_at', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .limit(FOUNDING_FREE_COMPANY_LIMIT);
    foundingSlot = Boolean(earliest?.some((r) => Number(r.id) === companyId));
  }

  if (!founder && !foundingSlot) {
    return { row, subscription: current, granted: false };
  }

  const now = new Date().toISOString();
  const plan = founder ? LIFETIME_PLAN_FOUNDER : LIFETIME_PLAN_FOUNDING;
  const updates = {
    subscription_status: 'lifetime',
    subscription_plan: plan,
    subscription_amount_zar: 0,
    subscription_starts_at: row.subscription_starts_at || row.created_at || now,
    subscription_ends_at: null as string | null,
  };

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', companyId)
    .select(SUBSCRIPTION_SELECT_FIELDS)
    .single();

  if (error || !data) {
    // Soft: still expose lifetime in response for founder allowlist
    if (founder) {
      const synthetic: CompanySubscriptionInfo = {
        ...current,
        status: 'lifetime',
        hasAccess: true,
        isLifetime: true,
        isActive: true,
        isExpired: false,
        isTrial: false,
        monthlyZar: 0,
        daysRemaining: null,
        endsAt: null,
        plan,
      };
      return { row, subscription: synthetic, granted: false };
    }
    return { row, subscription: current, granted: false };
  }

  return {
    row: data as ProfileSubRow,
    subscription: computeCompanySubscription(data as ProfileSubRow),
    granted: true,
  };
}

/**
 * Ensure a 30-day trial is started once when the company has never subscribed.
 * Idempotent — does not restart if trial/paid/lifetime already set.
 */
async function ensureTrialStarted(
  companyId: number,
  row: ProfileSubRow
): Promise<{ row: ProfileSubRow; subscription: CompanySubscriptionInfo; started: boolean }> {
  // Lifetime first
  const life = await ensureLifetimeIfEligible(companyId, row);
  if (life.subscription.isLifetime || life.granted) {
    return { row: life.row, subscription: life.subscription, started: false };
  }
  row = life.row;

  const current = computeCompanySubscription(row);
  if (
    row.subscription_status &&
    row.subscription_status !== 'none' &&
    row.subscription_status !== ''
  ) {
    return { row, subscription: current, started: false };
  }
  if (row.subscription_trial_ends_at || row.subscription_ends_at) {
    return { row, subscription: current, started: false };
  }

  const now = new Date();
  const trialEnds = addDays(now, COMPANY_TRIAL_DAYS);
  const updates = {
    subscription_status: 'trial',
    subscription_trial_ends_at: trialEnds.toISOString(),
    subscription_starts_at: now.toISOString(),
    subscription_plan: COMPANY_SUBSCRIPTION_PLAN,
    subscription_amount_zar: COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  };

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', companyId)
    .select(SUBSCRIPTION_SELECT_FIELDS)
    .single();

  if (error || !data) {
    // Columns missing or race — return computed none
    return { row, subscription: current, started: false };
  }

  const next = data as ProfileSubRow;
  return {
    row: next,
    subscription: computeCompanySubscription(next),
    started: true,
  };
}

/**
 * GET ?companyId=
 * Returns subscription status. Auto-starts free trial on first visit if none.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const loaded = await loadProfile(companyId);
    if (!loaded.ok) {
      return NextResponse.json(
        { error: loaded.error, hint: loaded.hint },
        { status: loaded.status }
      );
    }

    const autoTrial =
      request.nextUrl.searchParams.get('autoTrial') !== '0' &&
      request.nextUrl.searchParams.get('autoTrial') !== 'false';

    let row = loaded.row;
    let subscription = computeCompanySubscription(row);
    let trialJustStarted = false;
    let lifetimeJustGranted = false;

    // Always try lifetime eligibility (founder + founding 50)
    if (!subscription.isLifetime) {
      const life = await ensureLifetimeIfEligible(companyId, row);
      row = life.row;
      subscription = life.subscription;
      lifetimeJustGranted = life.granted;
      if (life.granted) {
        void logActivity({
          profile_id: companyId,
          actor_user_id: gate.userId,
          action: 'billing.lifetime_granted',
          entity_type: 'profile',
          entity_id: String(companyId),
          summary: `Lifetime complimentary access granted (${subscription.plan})`,
          metadata: { plan: subscription.plan },
        });
      }
    }

    if (autoTrial && subscription.status === 'none') {
      const ensured = await ensureTrialStarted(companyId, row);
      row = ensured.row;
      subscription = ensured.subscription;
      trialJustStarted = ensured.started;
      if (ensured.started) {
        void logActivity({
          profile_id: companyId,
          actor_user_id: gate.userId,
          action: 'billing.trial_started',
          entity_type: 'profile',
          entity_id: String(companyId),
          summary: `${COMPANY_TRIAL_DAYS}-day free trial started`,
          metadata: {
            trialEndsAt: subscription.trialEndsAt,
            monthlyZar: COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
          },
        });
      }
    }

    const referral = await getReferralSummary(companyId);
    const referralCode = await ensureReferralCode(companyId);

    return NextResponse.json({
      success: true,
      companyId,
      companyName: row.trading_name || 'Your company',
      billingEmail: row.email || null,
      subscription,
      pricing: pricingPayload(),
      trialJustStarted,
      lifetimeJustGranted,
      foundingFreeSlots: FOUNDING_FREE_COMPANY_LIMIT,
      referral: {
        ...referral,
        code: referralCode,
        ratesSummary: referral.ratesSummary || referralRatesSummary(),
        suggestedCopy: referral.suggestedCopy || referralSuggestedCopy(),
        invitePath: referralCode
          ? `/onboarding?ref=${encodeURIComponent(referralCode)}`
          : `/onboarding?ref=${companyId}`,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST body:
 *   { companyId, action: 'start_trial' }
 *   { companyId, action: 'activate' | 'renew', paystackReference }
 *   { companyId, action: 'cancel' }  — marks cancelled at period end (status only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request) || body.privyUserId,
    });
    if (!gate.ok) return gate.response;

    const membership = await getCompanyMembership(gate.userId, companyId);
    if (!membership.ok) {
      return NextResponse.json({ error: membership.error }, { status: membership.status });
    }
    const role = String(membership.role || '').toLowerCase();
    const canManageBilling = ['owner', 'admin', 'finance'].includes(role);
    const action = String(body.action || 'activate').toLowerCase();

    if (['activate', 'renew', 'start_trial', 'cancel'].includes(action) && !canManageBilling) {
      return NextResponse.json(
        { error: 'Only owners, admins, or finance can manage billing.' },
        { status: 403 }
      );
    }

    const loaded = await loadProfile(companyId);
    if (!loaded.ok) {
      return NextResponse.json(
        { error: loaded.error, hint: loaded.hint },
        { status: loaded.status }
      );
    }
    let row = loaded.row;
    const supabase = getSupabaseServer();

    // ── start_trial ──────────────────────────────────────────
    if (action === 'start_trial') {
      const life = await ensureLifetimeIfEligible(companyId, row);
      if (life.subscription.isLifetime) {
        return NextResponse.json({
          success: true,
          started: false,
          lifetime: true,
          subscription: life.subscription,
          pricing: pricingPayload(),
        });
      }
      row = life.row;
      const ensured = await ensureTrialStarted(companyId, row);
      if (ensured.started) {
        void logActivity({
          profile_id: companyId,
          actor_user_id: gate.userId,
          action: 'billing.trial_started',
          entity_type: 'profile',
          entity_id: String(companyId),
          summary: `${COMPANY_TRIAL_DAYS}-day free trial started`,
          metadata: { trialEndsAt: ensured.subscription.trialEndsAt },
        });
      }
      return NextResponse.json({
        success: true,
        started: ensured.started,
        alreadyActive: ensured.subscription.hasAccess && !ensured.started,
        subscription: ensured.subscription,
        pricing: pricingPayload(),
      });
    }

    // ── cancel (soft — keep access until ends) ───────────────
    if (action === 'cancel') {
      const sub = computeCompanySubscription(row);
      if (!sub.hasAccess) {
        return NextResponse.json(
          { error: 'No active subscription to cancel.' },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from('profiles')
        .update({ subscription_status: 'cancelled' })
        .eq('id', companyId)
        .select(SUBSCRIPTION_SELECT_FIELDS)
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const next = computeCompanySubscription(data as ProfileSubRow);
      void logActivity({
        profile_id: companyId,
        actor_user_id: gate.userId,
        action: 'billing.cancelled',
        entity_type: 'profile',
        entity_id: String(companyId),
        summary: 'Subscription marked cancelled (access until period end)',
        metadata: { endsAt: next.endsAt || next.trialEndsAt },
      });
      return NextResponse.json({
        success: true,
        subscription: next,
        pricing: pricingPayload(),
      });
    }

    // ── activate / renew via Paystack ────────────────────────
    if (action === 'activate' || action === 'renew' || action === 'pay') {
      const life = await ensureLifetimeIfEligible(companyId, row);
      if (life.subscription.isLifetime) {
        return NextResponse.json({
          success: true,
          alreadyActive: true,
          lifetime: true,
          subscription: life.subscription,
          pricing: pricingPayload(),
          message: 'This company already has complimentary lifetime access.',
        });
      }
      row = life.row;

      const paystackReference = String(
        body.paystackReference || body.reference || ''
      ).trim();
      const claimedTerm = getBillingTerm(
        body.termId || body.term || body.billingTerm || 'monthly'
      );

      if (!paystackReference) {
        return NextResponse.json(
          {
            error: 'Payment reference required',
            hint: `Complete Paystack checkout (${claimedTerm.label} · ${formatZar(claimedTerm.payZar)}).`,
          },
          { status: 400 }
        );
      }

      // Idempotent same ref
      if (
        row.subscription_paystack_ref === paystackReference &&
        computeCompanySubscription(row).isActive
      ) {
        return NextResponse.json({
          success: true,
          alreadyActive: true,
          subscription: computeCompanySubscription(row),
          pricing: pricingPayload(),
        });
      }

      // Prevent double-use of reference on another company
      const { data: existingRef } = await supabase
        .from('profiles')
        .select('id')
        .eq('subscription_paystack_ref', paystackReference)
        .maybeSingle();
      if (existingRef && Number(existingRef.id) !== companyId) {
        return NextResponse.json(
          { error: 'This payment reference was already used.' },
          { status: 409 }
        );
      }

      // Verify paid amount is at least the cheapest monthly plan
      const verified = await verifyPaystackTransaction(paystackReference, {
        expectedAmountCents: COMPANY_SUBSCRIPTION_MONTHLY_CENTS,
        expectedCurrency: 'ZAR',
      });
      if (!verified.ok) {
        return NextResponse.json(
          { error: verified.error, hint: 'Paystack verification failed.' },
          { status: verified.status || 402 }
        );
      }

      // Resolve term from claimed id + actual paid amount
      const term = resolveBillingTerm({
        termId: claimedTerm.id,
        amountCents: verified.amount,
      });
      // If claimed multi-year but paid only monthly, fall back to amount-based term
      const finalTerm =
        verified.amount >= term.payCents
          ? term
          : resolveBillingTerm({ amountCents: verified.amount });

      if (verified.amount < finalTerm.payCents) {
        return NextResponse.json(
          {
            error: `Paid amount too low for ${finalTerm.label} plan (got ${verified.amount} cents, need ${finalTerm.payCents}).`,
          },
          { status: 402 }
        );
      }

      const now = new Date();
      const current = computeCompanySubscription(row);
      // Extend from remaining paid end if still active, else from now
      let periodStart = now;
      if (current.isActive && row.subscription_ends_at) {
        const existingEnd = new Date(row.subscription_ends_at);
        if (existingEnd.getTime() > now.getTime()) {
          periodStart = existingEnd;
        }
      }
      const periodEnd = addMonths(periodStart, finalTerm.months);
      const startsAt = row.subscription_starts_at || now.toISOString();

      const updates: Record<string, unknown> = {
        subscription_status: 'active',
        subscription_starts_at: startsAt,
        subscription_ends_at: periodEnd.toISOString(),
        subscription_paystack_ref: verified.reference,
        subscription_amount_zar: finalTerm.payZar,
        subscription_plan: finalTerm.planCode,
      };
      if (verified.customerCode) {
        updates.subscription_paystack_customer_code = verified.customerCode;
      }
      if (verified.authorizationCode) {
        updates.subscription_paystack_auth_code = verified.authorizationCode;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', companyId)
        .select(SUBSCRIPTION_SELECT_FIELDS)
        .single();

      if (error) {
        if (/column|subscription_/i.test(error.message)) {
          return NextResponse.json(
            {
              error: error.message,
              hint: 'Run supabase/migrations/20260712_company_subscription.sql',
            },
            { status: 503 }
          );
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      row = data as ProfileSubRow;
      const subscription = computeCompanySubscription(row);

      // Credit L1–L3 supply-chain referral fees (max 10% of payment)
      const referralResult = await creditSubscriptionReferralFees({
        sourceProfileId: companyId,
        baseAmountZar: finalTerm.payZar,
        sourceRef: verified.reference,
        termLabel: finalTerm.label,
        months: finalTerm.months,
      });

      void logActivity({
        profile_id: companyId,
        actor_user_id: gate.userId,
        action: 'billing.subscription_activated',
        entity_type: 'profile',
        entity_id: String(companyId),
        summary: `Company subscription activated (${finalTerm.label} · ${formatZar(finalTerm.payZar)} · ${finalTerm.months} mo)`,
        metadata: {
          paystackReference: verified.reference,
          termId: finalTerm.id,
          months: finalTerm.months,
          discountPercent: finalTerm.discountPercent,
          payZar: finalTerm.payZar,
          endsAt: periodEnd.toISOString(),
          amountCents: verified.amount,
          channel: verified.channel,
          referralPayouts:
            referralResult.ok
              ? referralResult.payouts.map((p) => ({
                  level: p.level,
                  earner: p.earnerProfileId,
                  rate: p.ratePct,
                  zar: p.commissionZar,
                }))
              : [],
        },
      });

      return NextResponse.json({
        success: true,
        subscription,
        pricing: pricingPayload(),
        term: finalTerm,
        periodEnd: periodEnd.toISOString(),
        referral:
          referralResult.ok
            ? {
                credited: referralResult.inserted,
                payouts: referralResult.payouts,
                ratesSummary: referralRatesSummary(),
              }
            : { error: referralResult.error },
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
