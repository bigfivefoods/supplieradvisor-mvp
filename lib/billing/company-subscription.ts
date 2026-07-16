/**
 * Company SaaS subscription — R299 / month after 30-day free trial.
 * Payments via Paystack (monthly or multi-year prepaid with discounts).
 * Lifetime complimentary: founder companies + first 50 founding partners.
 */

import {
  isLifetimePlan,
  isLifetimeStatus,
  LIFETIME_PLAN,
} from '@/lib/billing/lifetime';

export const COMPANY_SUBSCRIPTION_MONTHLY_ZAR = 299;
/** Paystack amount in cents (ZAR minor units). */
export const COMPANY_SUBSCRIPTION_MONTHLY_CENTS =
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR * 100;
export const COMPANY_TRIAL_DAYS = 30;
export const COMPANY_SUBSCRIPTION_PRODUCT = 'company_saas_monthly';
export const COMPANY_SUBSCRIPTION_PLAN = 'company_monthly';

/** Prepaid term options (monthly list price with multi-year discounts). */
export type BillingTermId = 'monthly' | '1y' | '2y' | '3y';

export type BillingTerm = {
  id: BillingTermId;
  label: string;
  shortLabel: string;
  months: number;
  years: number;
  /** Discount off full monthly×months list price */
  discountPercent: number;
  /** Undiscounted total for the term */
  listZar: number;
  /** Amount charged (ZAR, whole rands) */
  payZar: number;
  /** Paystack amount in cents */
  payCents: number;
  savingsZar: number;
  planCode: string;
  /** Effective price per month after discount */
  effectiveMonthlyZar: number;
  badge?: string;
};

function buildTerm(
  id: BillingTermId,
  months: number,
  discountPercent: number,
  opts: { label: string; shortLabel: string; planCode: string; badge?: string }
): BillingTerm {
  const years = months / 12;
  const listZar = COMPANY_SUBSCRIPTION_MONTHLY_ZAR * months;
  const payZar = Math.round(listZar * (1 - discountPercent / 100));
  const savingsZar = listZar - payZar;
  return {
    id,
    label: opts.label,
    shortLabel: opts.shortLabel,
    months,
    years: years < 1 ? 0 : years,
    discountPercent,
    listZar,
    payZar,
    payCents: payZar * 100,
    savingsZar,
    planCode: opts.planCode,
    effectiveMonthlyZar: Math.round((payZar / months) * 100) / 100,
    badge: opts.badge,
  };
}

export const BILLING_TERMS: BillingTerm[] = [
  buildTerm('monthly', 1, 0, {
    label: 'Monthly',
    shortLabel: '1 month',
    planCode: 'company_monthly',
  }),
  buildTerm('1y', 12, 15, {
    label: '1 year',
    shortLabel: '12 months',
    planCode: 'company_annual_1y',
    badge: 'Save 15%',
  }),
  buildTerm('2y', 24, 25, {
    label: '2 years',
    shortLabel: '24 months',
    planCode: 'company_annual_2y',
    badge: 'Save 25%',
  }),
  buildTerm('3y', 36, 30, {
    label: '3 years',
    shortLabel: '36 months',
    planCode: 'company_annual_3y',
    badge: 'Best value · Save 30%',
  }),
];

export function getBillingTerm(id: string | null | undefined): BillingTerm {
  const found = BILLING_TERMS.find((t) => t.id === id);
  return found || BILLING_TERMS[0];
}

/** Resolve term from plan code, months, or amount paid (cents). */
export function resolveBillingTerm(opts: {
  termId?: string | null;
  planCode?: string | null;
  months?: number | null;
  amountCents?: number | null;
}): BillingTerm {
  if (opts.termId) {
    const byId = BILLING_TERMS.find((t) => t.id === opts.termId);
    if (byId) return byId;
  }
  if (opts.planCode) {
    const byPlan = BILLING_TERMS.find((t) => t.planCode === opts.planCode);
    if (byPlan) return byPlan;
  }
  if (opts.months != null && Number.isFinite(opts.months)) {
    const byMonths = BILLING_TERMS.find((t) => t.months === Number(opts.months));
    if (byMonths) return byMonths;
  }
  if (opts.amountCents != null && Number.isFinite(opts.amountCents)) {
    const amt = Number(opts.amountCents);
    // Match exact prepaid term amounts first (multi-year)
    const exact = [...BILLING_TERMS]
      .reverse()
      .find((t) => t.payCents === amt);
    if (exact) return exact;
    // Allow small overpay tolerance
    const near = [...BILLING_TERMS]
      .sort((a, b) => b.payCents - a.payCents)
      .find((t) => amt >= t.payCents && amt < t.payCents + 100);
    if (near) return near;
  }
  return BILLING_TERMS[0];
}

export function formatZar(amount: number): string {
  return `R${amount.toLocaleString('en-ZA')}`;
}

export type CompanySubscriptionStatus =
  | 'none'
  | 'trial'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'
  | 'lifetime';

export type CompanySubscriptionInfo = {
  status: CompanySubscriptionStatus;
  monthlyZar: number;
  trialDays: number;
  trialEndsAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  paystackReference: string | null;
  daysRemaining: number | null;
  /** True when trial, paid, or lifetime access is currently valid */
  hasAccess: boolean;
  isTrial: boolean;
  isActive: boolean;
  isExpired: boolean;
  /** Permanent complimentary access (founder / founding 50) */
  isLifetime: boolean;
  plan: string;
};

export function addDays(isoOrDate: string | Date, days: number): Date {
  const d = new Date(isoOrDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function addMonths(isoOrDate: string | Date, months: number): Date {
  const d = new Date(isoOrDate);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

type SubRow = {
  subscription_status?: string | null;
  subscription_trial_ends_at?: string | null;
  subscription_starts_at?: string | null;
  subscription_ends_at?: string | null;
  subscription_paystack_ref?: string | null;
  subscription_plan?: string | null;
};

export function computeCompanySubscription(row: SubRow | null | undefined): CompanySubscriptionInfo {
  const now = Date.now();
  const trialEnds = row?.subscription_trial_ends_at
    ? new Date(row.subscription_trial_ends_at)
    : null;
  const startsAt = row?.subscription_starts_at
    ? new Date(row.subscription_starts_at)
    : null;
  const endsAt = row?.subscription_ends_at
    ? new Date(row.subscription_ends_at)
    : null;
  const raw = String(row?.subscription_status || 'none').toLowerCase();
  const plan = row?.subscription_plan
    ? String(row.subscription_plan)
    : COMPANY_SUBSCRIPTION_PLAN;

  let status: CompanySubscriptionStatus = 'none';

  // Lifetime / complimentary always wins
  if (isLifetimeStatus(raw) || isLifetimePlan(plan)) {
    status = 'lifetime';
  } else if (endsAt && endsAt.getTime() > now && (raw === 'active' || raw === 'paid')) {
    status = 'active';
  } else if (
    raw === 'cancelled' &&
    endsAt &&
    endsAt.getTime() > now
  ) {
    // Cancelled but paid period still open — keep access until endsAt
    status = 'cancelled';
  } else if (trialEnds && trialEnds.getTime() > now && (raw === 'trial' || raw === 'none')) {
    // Prefer explicit trial; also treat none+trial_ends as trial if still open
    status = 'trial';
  } else if (raw === 'cancelled') {
    status = 'cancelled';
  } else if (raw === 'trial' && trialEnds && trialEnds.getTime() <= now) {
    status = 'expired';
  } else if (endsAt && endsAt.getTime() <= now) {
    status = 'expired';
  } else if (raw === 'past_due') {
    status = 'past_due';
  } else if (raw === 'active' || raw === 'paid') {
    status = endsAt && endsAt.getTime() > now ? 'active' : 'expired';
  } else if (raw === 'trial') {
    status = trialEnds && trialEnds.getTime() > now ? 'trial' : 'expired';
  } else {
    status = 'none';
  }

  const isLifetime = status === 'lifetime';
  const hasAccess =
    isLifetime ||
    status === 'trial' ||
    status === 'active' ||
    (status === 'cancelled' && !!endsAt && endsAt.getTime() > now);
  const accessEnd = isLifetime
    ? null
    : status === 'active' || (status === 'cancelled' && endsAt && endsAt.getTime() > now)
      ? endsAt
      : status === 'trial'
        ? trialEnds
        : null;
  const daysRemaining =
    hasAccess && accessEnd
      ? Math.max(0, Math.ceil((accessEnd.getTime() - now) / (24 * 60 * 60 * 1000)))
      : isLifetime
        ? null
        : null;

  return {
    status,
    monthlyZar: isLifetime ? 0 : COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
    trialDays: COMPANY_TRIAL_DAYS,
    trialEndsAt: trialEnds ? trialEnds.toISOString() : null,
    startsAt: startsAt ? startsAt.toISOString() : null,
    endsAt: endsAt ? endsAt.toISOString() : null,
    paystackReference: row?.subscription_paystack_ref
      ? String(row.subscription_paystack_ref)
      : null,
    daysRemaining,
    hasAccess,
    isTrial: status === 'trial',
    isActive: status === 'active' || isLifetime,
    isExpired:
      !isLifetime &&
      (status === 'expired' || status === 'past_due' || status === 'cancelled'),
    isLifetime,
    plan: isLifetime && !isLifetimePlan(plan) ? LIFETIME_PLAN : plan,
  };
}

export const SUBSCRIPTION_SELECT_FIELDS =
  'id, trading_name, legal_name, email, subscription_status, subscription_trial_ends_at, subscription_starts_at, subscription_ends_at, subscription_paystack_ref, subscription_paystack_customer_code, subscription_paystack_auth_code, subscription_amount_zar, subscription_plan, created_at';
