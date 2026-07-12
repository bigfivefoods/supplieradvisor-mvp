/**
 * Company SaaS subscription — R499 / month after 30-day free trial.
 * Payments via Paystack (monthly prepaid period).
 */

export const COMPANY_SUBSCRIPTION_MONTHLY_ZAR = 499;
/** Paystack amount in cents (ZAR minor units). */
export const COMPANY_SUBSCRIPTION_MONTHLY_CENTS =
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR * 100;
export const COMPANY_TRIAL_DAYS = 30;
export const COMPANY_SUBSCRIPTION_PRODUCT = 'company_saas_monthly';
export const COMPANY_SUBSCRIPTION_PLAN = 'company_monthly';

export type CompanySubscriptionStatus =
  | 'none'
  | 'trial'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired';

export type CompanySubscriptionInfo = {
  status: CompanySubscriptionStatus;
  monthlyZar: number;
  trialDays: number;
  trialEndsAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  paystackReference: string | null;
  daysRemaining: number | null;
  /** True when trial or paid period is currently valid */
  hasAccess: boolean;
  isTrial: boolean;
  isActive: boolean;
  isExpired: boolean;
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

  let status: CompanySubscriptionStatus = 'none';

  if (endsAt && endsAt.getTime() > now && (raw === 'active' || raw === 'paid')) {
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

  const hasAccess =
    status === 'trial' ||
    status === 'active' ||
    (status === 'cancelled' && !!endsAt && endsAt.getTime() > now);
  const accessEnd =
    status === 'active' || (status === 'cancelled' && endsAt && endsAt.getTime() > now)
      ? endsAt
      : status === 'trial'
        ? trialEnds
        : null;
  const daysRemaining =
    hasAccess && accessEnd
      ? Math.max(0, Math.ceil((accessEnd.getTime() - now) / (24 * 60 * 60 * 1000)))
      : null;

  return {
    status,
    monthlyZar: COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
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
    isActive: status === 'active',
    isExpired: status === 'expired' || status === 'past_due' || status === 'cancelled',
    plan: row?.subscription_plan
      ? String(row.subscription_plan)
      : COMPANY_SUBSCRIPTION_PLAN,
  };
}

export const SUBSCRIPTION_SELECT_FIELDS =
  'id, trading_name, email, subscription_status, subscription_trial_ends_at, subscription_starts_at, subscription_ends_at, subscription_paystack_ref, subscription_paystack_customer_code, subscription_paystack_auth_code, subscription_amount_zar, subscription_plan';
