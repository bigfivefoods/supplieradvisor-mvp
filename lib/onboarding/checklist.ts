/**
 * Day 1–3 golden path for new companies.
 * Steps can be marked manually or inferred from live platform activity.
 */

import { getSupabaseServer } from '@/lib/supabase/server-client';
import { computeProfileCompleteness } from '@/lib/business/completeness';
import { normalizeProfileRow } from '@/lib/business/types';
import { computeCompanySubscription } from '@/lib/billing/company-subscription';

export type OnboardingStepId =
  | 'profile'
  | 'team'
  | 'invite_first_partner'
  | 'invite_partners'
  | 'first_trade'
  | 'billing'
  | 'rate_partner';

export type OnboardingStep = {
  id: OnboardingStepId;
  day: 1 | 2 | 3;
  title: string;
  body: string;
  href: string;
  cta: string;
};

/** Partner count threshold for the “3 partners” golden-path step */
export const INVITE_PARTNERS_GOAL = 3;

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: 'profile',
    day: 1,
    title: 'Complete company profile',
    body: 'Trading name, contacts, and industry so partners can find and trust you.',
    href: '/dashboard/my-business/profile',
    cta: 'Edit profile',
  },
  {
    id: 'team',
    day: 1,
    title: 'Invite your team',
    body: 'Add owners, ops, and finance with the right roles.',
    href: '/dashboard/my-business/team',
    cta: 'Open team',
  },
  {
    id: 'invite_first_partner',
    day: 2,
    title: 'Invite your first partner',
    body: 'Connect or invite one supplier, customer, or business partner.',
    href: '/dashboard/invite-business',
    cta: 'Invite business',
  },
  {
    id: 'invite_partners',
    day: 2,
    title: `Grow to ${INVITE_PARTNERS_GOAL} trading partners`,
    body: `Reach ${INVITE_PARTNERS_GOAL} connections or book entries — network density unlocks trade and trust.`,
    href: '/dashboard/invite-business',
    cta: 'Invite more',
  },
  {
    id: 'first_trade',
    day: 3,
    title: 'Create first quote, PO, or order',
    body: 'Put real commerce on the platform — 30-min path: customer → document → send → collect/rate.',
    href: '/dashboard',
    cta: 'First trade path',
  },
  {
    id: 'billing',
    day: 3,
    title: 'Review billing & trial',
    body: 'See your trial end date and prepaid options before you need to pay.',
    href: '/dashboard/my-business/billing',
    cta: 'Open billing',
  },
  {
    id: 'rate_partner',
    day: 3,
    title: 'Rate a partner after trade',
    body: 'Peer stars from suppliers and customers build OTIFEF and trust for everyone.',
    href: '/dashboard/suppliers/ratings',
    cta: 'Open ratings',
  },
] as const;

export function progressPercent(steps: Record<string, boolean>): number {
  const total = ONBOARDING_STEPS.length;
  const done = ONBOARDING_STEPS.filter((s) => steps[s.id]).length;
  return Math.round((done / total) * 100);
}

/** Count of trading partners (max of connections vs supplier+customer book). */
export async function getPartnerCount(companyId: number): Promise<number> {
  if (!Number.isFinite(companyId) || companyId <= 0) return 0;
  try {
    const supabase = getSupabaseServer();
    const [connRes, sInv, cInv] = await Promise.all([
      supabase
        .from('business_connections')
        .select('id', { count: 'exact', head: true })
        .or(
          `requester_profile_id.eq.${companyId},requestee_profile_id.eq.${companyId}`
        ),
      supabase
        .from('suppliers')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId),
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId),
    ]);
    const connCount = connRes.error ? 0 : connRes.count ?? 0;
    const bookCount = (sInv.count || 0) + (cInv.count || 0);
    return Math.max(connCount, bookCount);
  } catch {
    return 0;
  }
}

/**
 * Infer which golden-path steps are already true from live data.
 * Soft-fail each query — never throws for missing tables.
 */
export async function inferOnboardingSteps(
  companyId: number
): Promise<Record<OnboardingStepId, boolean>> {
  const empty: Record<OnboardingStepId, boolean> = {
    profile: false,
    team: false,
    invite_first_partner: false,
    invite_partners: false,
    first_trade: false,
    billing: false,
    rate_partner: false,
  };
  if (!Number.isFinite(companyId) || companyId <= 0) return empty;

  try {
    const supabase = getSupabaseServer();

    const [
      profileRes,
      teamRes,
      connRes,
      poBuyerRes,
      quoteRes,
      orderRes,
      invRes,
      ratingRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', companyId).maybeSingle(),
      supabase
        .from('business_users')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId),
      supabase
        .from('business_connections')
        .select('id', { count: 'exact', head: true })
        .or(
          `requester_profile_id.eq.${companyId},requestee_profile_id.eq.${companyId}`
        ),
      supabase
        .from('purchase_orders')
        .select('id', { count: 'exact', head: true })
        .eq('buyer_profile_id', companyId),
      supabase
        .from('customer_quotes')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId),
      supabase
        .from('sales_orders')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId),
      supabase
        .from('customer_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId),
      supabase
        .from('company_ratings')
        .select('id', { count: 'exact', head: true })
        .eq('rater_profile_id', companyId)
        .eq('status', 'published'),
    ]);

    const raw = profileRes.data as Record<string, unknown> | null;
    if (raw) {
      const profile = normalizeProfileRow(raw);
      const comp = computeProfileCompleteness(
        profile as Record<string, unknown>
      );
      empty.profile = comp.pct >= 60;

      const sub = computeCompanySubscription({
        subscription_status: raw.subscription_status as string | null,
        subscription_trial_ends_at: raw.subscription_trial_ends_at as
          | string
          | null,
        subscription_starts_at: raw.subscription_starts_at as string | null,
        subscription_ends_at: raw.subscription_ends_at as string | null,
        subscription_paystack_ref: raw.subscription_paystack_ref as
          | string
          | null,
        subscription_plan: raw.subscription_plan as string | null,
      });
      // Visited billing if they have any subscription status tracked (trial/active/lifetime)
      empty.billing =
        sub.status === 'trial' ||
        sub.status === 'active' ||
        sub.status === 'lifetime' ||
        Boolean(raw.subscription_trial_ends_at) ||
        Boolean(raw.subscription_paystack_ref);
    }

    // Team: more than just the owner, or at least 1 active member (owner counts as started)
    const teamCount = teamRes.count ?? 0;
    empty.team = teamCount >= 2;

    // Partners: max of connections vs supplier+customer book (dedupe-ish density signal)
    const connCount = connRes.error ? 0 : connRes.count ?? 0;
    let bookCount = 0;
    try {
      const { count: sInv } = await supabase
        .from('suppliers')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId);
      const { count: cInv } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId);
      bookCount = (sInv || 0) + (cInv || 0);
    } catch {
      /* optional */
    }
    const partnerCount = Math.max(connCount, bookCount);
    empty.invite_first_partner = partnerCount >= 1;
    empty.invite_partners = partnerCount >= INVITE_PARTNERS_GOAL;
    // partnerCount available via getPartnerCount() for UI meters

    const tradeCount =
      (poBuyerRes.error ? 0 : poBuyerRes.count || 0) +
      (quoteRes.error ? 0 : quoteRes.count || 0) +
      (orderRes.error ? 0 : orderRes.count || 0) +
      (invRes.error ? 0 : invRes.count || 0);
    empty.first_trade = tradeCount >= 1;

    empty.rate_partner =
      !ratingRes.error && (ratingRes.count || 0) >= 1;

    return empty;
  } catch (e) {
    console.warn('inferOnboardingSteps soft-fail:', e);
    return empty;
  }
}

/** Merge manual marks with inferred (OR — never un-complete a user mark). */
export function mergeOnboardingSteps(
  stored: Record<string, boolean>,
  inferred: Record<string, boolean>
): Record<OnboardingStepId, boolean> {
  const out: Record<OnboardingStepId, boolean> = {
    profile: false,
    team: false,
    invite_first_partner: false,
    invite_partners: false,
    first_trade: false,
    billing: false,
    rate_partner: false,
  };
  for (const s of ONBOARDING_STEPS) {
    out[s.id] = Boolean(stored[s.id] || inferred[s.id]);
  }
  // Completing 3-partners implies first partner
  if (out.invite_partners) out.invite_first_partner = true;
  return out;
}

/**
 * After any partner invite/connection: mark first partner and re-infer for the 3-goal.
 */
export async function afterPartnerNetworkEvent(
  companyId: number
): Promise<MarkOnboardingResult> {
  const id = Number(companyId);
  if (!Number.isFinite(id) || id <= 0) {
    return { newlyMarked: [], progressPercent: 0 };
  }
  // Always credit first partner on explicit invite action
  const first = await markOnboardingSteps(id, 'invite_first_partner');
  // Re-infer so count ≥ 3 flips invite_partners without manual mark
  try {
    const inferred = await inferOnboardingSteps(id);
    if (inferred.invite_partners) {
      const three = await markOnboardingSteps(id, 'invite_partners');
      return {
        newlyMarked: [...first.newlyMarked, ...three.newlyMarked],
        progressPercent: three.progressPercent || first.progressPercent,
      };
    }
  } catch {
    /* soft */
  }
  return first;
}

export type MarkOnboardingResult = {
  newlyMarked: OnboardingStepId[];
  progressPercent: number;
};

/**
 * Soft-mark one or more golden-path steps (never throws, never un-marks).
 * Returns which steps were newly flipped true (for client toasts).
 */
export async function markOnboardingSteps(
  companyId: number,
  stepIds: OnboardingStepId | OnboardingStepId[]
): Promise<MarkOnboardingResult> {
  const empty: MarkOnboardingResult = { newlyMarked: [], progressPercent: 0 };
  const id = Number(companyId);
  if (!Number.isFinite(id) || id <= 0) return empty;
  const list = (Array.isArray(stepIds) ? stepIds : [stepIds]).filter((s) =>
    ONBOARDING_STEPS.some((x) => x.id === s)
  ) as OnboardingStepId[];
  if (!list.length) return empty;

  try {
    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from('company_onboarding_progress')
      .select('steps')
      .eq('profile_id', id)
      .maybeSingle();

    const steps: Record<string, boolean> = {
      ...((existing?.steps || {}) as Record<string, boolean>),
    };
    const newlyMarked: OnboardingStepId[] = [];
    for (const s of list) {
      if (!steps[s]) {
        steps[s] = true;
        newlyMarked.push(s);
      }
    }
    if (!newlyMarked.length) {
      return { newlyMarked: [], progressPercent: progressPercent(steps) };
    }

    const pct = progressPercent(steps);
    await supabase.from('company_onboarding_progress').upsert(
      {
        profile_id: id,
        steps,
        completed_at: pct >= 100 ? now : null,
        updated_at: now,
        created_at: now,
      },
      { onConflict: 'profile_id' }
    );
    return { newlyMarked, progressPercent: pct };
  } catch (e) {
    console.warn('markOnboardingSteps soft-fail:', e);
    return empty;
  }
}

/** Step title for toast copy */
export function onboardingStepTitle(id: string): string {
  return ONBOARDING_STEPS.find((s) => s.id === id)?.title || id;
}

/**
 * Soft-complete rate_partner + matching rating_prompts after a peer rating is published.
 */
export async function afterPeerRatingPublished(opts: {
  companyId: number;
  rateeProfileId: number;
}): Promise<void> {
  const companyId = Number(opts.companyId);
  const ratee = Number(opts.rateeProfileId);
  if (!Number.isFinite(companyId) || !Number.isFinite(ratee)) return;

  try {
    const supabase = getSupabaseServer();
    const now = new Date().toISOString();

    // Complete pending prompts for this counterparty
    await supabase
      .from('rating_prompts')
      .update({
        status: 'completed',
        completed_at: now,
        updated_at: now,
      })
      .eq('profile_id', companyId)
      .eq('counterparty_profile_id', ratee)
      .eq('status', 'pending');

    await markOnboardingSteps(companyId, 'rate_partner');
  } catch (e) {
    console.warn('afterPeerRatingPublished soft-fail:', e);
  }
}
