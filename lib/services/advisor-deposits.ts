/**
 * Booking deposit / card-hold rules for Advisor modules.
 * Integrates with Paystack initialize when secret is configured.
 */

export type DepositPolicy = {
  enabled: boolean;
  /** Fixed deposit amount in ZAR */
  amount_zar: number;
  /** Require deposit when person is soft-blocked for no-shows */
  require_after_soft_block?: boolean;
  /** Require deposit for all public/website bookings */
  require_on_public_book?: boolean;
  /** Require deposit for all desk bookings */
  require_on_desk_book?: boolean;
  currency?: string;
};

export type DepositPaymentState = {
  required: boolean;
  amount_zar: number;
  status: 'none' | 'pending' | 'paid' | 'waived' | 'refunded' | 'failed';
  paystack_reference?: string | null;
  authorization_url?: string | null;
  paid_at?: string | null;
};

export const DEFAULT_DEPOSIT_POLICY: DepositPolicy = {
  enabled: false,
  amount_zar: 150,
  require_after_soft_block: true,
  require_on_public_book: false,
  require_on_desk_book: false,
  currency: 'ZAR',
};

export function normalizeDepositPolicy(
  raw?: Partial<DepositPolicy> | null
): DepositPolicy {
  return {
    ...DEFAULT_DEPOSIT_POLICY,
    ...(raw || {}),
    amount_zar: Math.max(0, Number(raw?.amount_zar ?? DEFAULT_DEPOSIT_POLICY.amount_zar) || 0),
    enabled: raw?.enabled === true,
  };
}

export function depositRequiredForBooking(opts: {
  policy: DepositPolicy | null | undefined;
  source?: string;
  personSoftBlocked?: boolean;
  existing?: DepositPaymentState | null;
}): { required: boolean; amount_zar: number; reason?: string } {
  const policy = normalizeDepositPolicy(opts.policy);
  if (opts.existing?.status === 'paid' || opts.existing?.status === 'waived') {
    return { required: false, amount_zar: 0 };
  }
  if (!policy.enabled || policy.amount_zar <= 0) {
    return { required: false, amount_zar: 0 };
  }
  if (opts.personSoftBlocked && policy.require_after_soft_block !== false) {
    return {
      required: true,
      amount_zar: policy.amount_zar,
      reason: 'no_show_soft_block',
    };
  }
  const src = String(opts.source || 'desk');
  if (
    policy.require_on_public_book &&
    (src === 'website' || src === 'member' || src === 'patient_portal' || src === 'member_portal')
  ) {
    return {
      required: true,
      amount_zar: policy.amount_zar,
      reason: 'public_book',
    };
  }
  if (policy.require_on_desk_book && (src === 'desk' || src === 'owner')) {
    return {
      required: true,
      amount_zar: policy.amount_zar,
      reason: 'desk_book',
    };
  }
  return { required: false, amount_zar: 0 };
}

export function newDepositPending(
  amountZar: number,
  reference?: string
): DepositPaymentState {
  return {
    required: true,
    amount_zar: amountZar,
    status: 'pending',
    paystack_reference: reference || null,
    authorization_url: null,
  };
}

export function markDepositPaid(
  dep: DepositPaymentState | null | undefined,
  now = new Date().toISOString()
): DepositPaymentState {
  return {
    required: false,
    amount_zar: dep?.amount_zar || 0,
    status: 'paid',
    paystack_reference: dep?.paystack_reference || null,
    authorization_url: null,
    paid_at: now,
  };
}

export function depositReference(opts: {
  module: string;
  companyId: number | string;
  bookingId: string;
}): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `advdep_${opts.module}_${opts.companyId}_${opts.bookingId}_${rand}`.slice(
    0,
    100
  );
}
