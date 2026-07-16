import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_SUBSCRIPTION_PLAN,
  COMPANY_TRIAL_DAYS,
  addDays,
} from '@/lib/billing/company-subscription';
import {
  FOUNDING_FREE_COMPANY_LIMIT,
  isFounderLifetimeCompany,
  LIFETIME_PLAN_FOUNDER,
  LIFETIME_PLAN_FOUNDING,
} from '@/lib/billing/lifetime';
import { resolveReferrerFromCode } from '@/lib/billing/supply-chain-referral';

/**
 * POST /api/onboarding/register-business
 * Self-serve business registration after Privy authentication.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      privyUserId,
      trading_name,
      legal_name,
      registration_number,
      industry,
      business_type,
      country,
      city,
      website,
      contact_name,
      contact_email,
      contact_phone,
      short_description,
      // Supply-chain referral: code or company id of inviting company
      referralCode,
      referredBy,
      ref,
    } = body;

    const _auth = await requireVerifiedUser(request, { legacyPrivyUserId: privyUserId });
    if (!_auth.ok) return _auth.response;
    const userId = getCanonicalUserId(_auth.userId);
    if (!userId) {
      return NextResponse.json({ error: 'You must be signed in to register a business.' }, { status: 401 });
    }

    if (!trading_name || !String(trading_name).trim()) {
      return NextResponse.json({ error: 'Trading name is required.' }, { status: 400 });
    }

    if (!contact_email || !String(contact_email).trim()) {
      return NextResponse.json({ error: 'Contact email is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const trialEnds = addDays(nowDate, COMPANY_TRIAL_DAYS).toISOString();
    const email = String(contact_email).toLowerCase().trim();
    const tradingNameTrim = String(trading_name).trim();
    const legalNameTrim = legal_name
      ? String(legal_name).trim()
      : tradingNameTrim;

    // Founder names or remaining founding-50 slots → lifetime free
    let lifetimePlan: string | null = null;
    if (
      isFounderLifetimeCompany({
        tradingName: tradingNameTrim,
        legalName: legalNameTrim,
      })
    ) {
      lifetimePlan = LIFETIME_PLAN_FOUNDER;
    } else {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      if ((count ?? 999) < FOUNDING_FREE_COMPANY_LIMIT) {
        lifetimePlan = LIFETIME_PLAN_FOUNDING;
      }
    }

    // Resolve optional supply-chain referrer (company that invited this business)
    const refRaw = String(referralCode || referredBy || ref || '').trim();
    let referredByProfileId: number | null = null;
    if (refRaw) {
      referredByProfileId = await resolveReferrerFromCode(refRaw);
    }

    const baseInsert: Record<string, unknown> = {
      trading_name: tradingNameTrim,
      legal_name: legalNameTrim,
      registration_number: registration_number || null,
      industry: industry || null,
      business_type: business_type || 'business',
      country: country || 'South Africa',
      city: city || null,
      website: website || null,
      contact_name: contact_name || null,
      contact_phone: contact_phone || null,
      email,
      short_description: short_description || null,
      supplier_status: 'active',
      relationship_type: business_type === 'supplier' ? 'supplier' : 'business',
      is_discoverable: true,
      user_id: userId,
      created_at: now,
      claimed_at: now,
      ...(referredByProfileId
        ? { referred_by_profile_id: referredByProfileId }
        : {}),
      ...(lifetimePlan
        ? {
            subscription_status: 'lifetime',
            subscription_starts_at: now,
            subscription_ends_at: null,
            subscription_trial_ends_at: null,
            subscription_plan: lifetimePlan,
            subscription_amount_zar: 0,
          }
        : {
            // 30-day free trial starts on registration
            subscription_status: 'trial',
            subscription_trial_ends_at: trialEnds,
            subscription_starts_at: now,
            subscription_plan: COMPANY_SUBSCRIPTION_PLAN,
            subscription_amount_zar: COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
          }),
    };

    let profile: { id: number; trading_name: string } | null = null;
    let profileError: { message?: string } | null = null;

    {
      const res = await supabase
        .from('profiles')
        .insert(baseInsert)
        .select('id, trading_name')
        .single();
      profile = res.data;
      profileError = res.error;
    }

    // If subscription columns not migrated yet, retry without them
    if (profileError && /column|subscription_/i.test(String(profileError.message || ''))) {
      const {
        subscription_status: _s,
        subscription_trial_ends_at: _t,
        subscription_starts_at: _st,
        subscription_ends_at: _e,
        subscription_plan: _p,
        subscription_amount_zar: _a,
        ...withoutSub
      } = baseInsert;
      const res = await supabase
        .from('profiles')
        .insert(withoutSub)
        .select('id, trading_name')
        .single();
      profile = res.data;
      profileError = res.error;
    }

    if (profileError || !profile) {
      console.error('Register business profile error:', profileError);
      return NextResponse.json(
        {
          error: 'Failed to create company profile.',
          details: profileError?.message,
        },
        { status: 500 }
      );
    }

    const { error: membershipError } = await supabase.from('business_users').insert({
      user_id: userId,
      profile_id: profile.id,
      role: 'owner',
      status: 'active',
      name: contact_name || null,
      email,
      joined_at: now,
      created_at: now,
    });

    if (membershipError) {
      console.error('Register business membership error:', membershipError);
      return NextResponse.json(
        {
          error: 'Company created but ownership link failed.',
          details: membershipError.message,
          profileId: profile.id,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profileId: profile.id,
      tradingName: profile.trading_name,
      message: lifetimePlan
        ? 'Business registered with complimentary lifetime access.'
        : 'Business registered successfully.',
      trial: lifetimePlan
        ? null
        : {
            status: 'trial',
            days: COMPANY_TRIAL_DAYS,
            endsAt: trialEnds,
            monthlyZarAfterTrial: COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
          },
      lifetime: lifetimePlan
        ? { status: 'lifetime', plan: lifetimePlan }
        : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    console.error('Register business error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
