/**
 * Sales contractor platform access subscription.
 * R199 / month · minimum commitment 6 months · prepaid for full term via Paystack.
 */

export const SALES_SUBSCRIPTION_MONTHLY_ZAR = 199;
export const SALES_SUBSCRIPTION_TERM_MONTHS = 6;
/** Full term prepaid (R199 × 6). */
export const SALES_SUBSCRIPTION_TOTAL_ZAR =
  SALES_SUBSCRIPTION_MONTHLY_ZAR * SALES_SUBSCRIPTION_TERM_MONTHS;
/** Paystack amount in cents (ZAR minor units). */
export const SALES_SUBSCRIPTION_TOTAL_CENTS = SALES_SUBSCRIPTION_TOTAL_ZAR * 100;

export const SALES_SUBSCRIPTION_PRODUCT = 'sales_contractor_portal';

export type SubscriptionStatus = 'none' | 'active' | 'expired' | 'cancelled';

export type SalesSubscriptionInfo = {
  status: SubscriptionStatus;
  monthlyZar: number;
  termMonths: number;
  totalZar: number;
  startsAt: string | null;
  endsAt: string | null;
  paystackReference: string | null;
  daysRemaining: number | null;
  isActive: boolean;
};

export function addMonths(isoOrDate: string | Date, months: number): Date {
  const d = new Date(isoOrDate);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Handle month overflow (e.g. Jan 31 + 1 month)
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

export function computeSubscriptionInfo(row: {
  subscription_status?: string | null;
  subscription_starts_at?: string | null;
  subscription_ends_at?: string | null;
  subscription_paystack_ref?: string | null;
}): SalesSubscriptionInfo {
  const endsAt = row.subscription_ends_at ? new Date(row.subscription_ends_at) : null;
  const startsAt = row.subscription_starts_at ? new Date(row.subscription_starts_at) : null;
  const now = Date.now();
  let status: SubscriptionStatus = 'none';
  const raw = String(row.subscription_status || '').toLowerCase();

  if (raw === 'cancelled') {
    status = 'cancelled';
  } else if (endsAt && endsAt.getTime() > now && (raw === 'active' || raw === 'paid')) {
    status = 'active';
  } else if (endsAt && endsAt.getTime() <= now) {
    status = 'expired';
  } else if (raw === 'active' || raw === 'paid') {
    // Active flag but no end — treat as none for safety
    status = endsAt && endsAt.getTime() > now ? 'active' : 'none';
  }

  const isActive = status === 'active';
  const daysRemaining =
    isActive && endsAt
      ? Math.max(0, Math.ceil((endsAt.getTime() - now) / (24 * 60 * 60 * 1000)))
      : null;

  return {
    status,
    monthlyZar: SALES_SUBSCRIPTION_MONTHLY_ZAR,
    termMonths: SALES_SUBSCRIPTION_TERM_MONTHS,
    totalZar: SALES_SUBSCRIPTION_TOTAL_ZAR,
    startsAt: startsAt ? startsAt.toISOString() : null,
    endsAt: endsAt ? endsAt.toISOString() : null,
    paystackReference: row.subscription_paystack_ref
      ? String(row.subscription_paystack_ref)
      : null,
    daysRemaining,
    isActive,
  };
}
