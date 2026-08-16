/**
 * Advisor card / Apple Pay settlement.
 *
 * Money is collected on SupplierAdvisor’s Paystack merchant and split:
 * 1% admin fee to SA, the rest to the Advisor subaccount. The Advisor
 * bears Paystack card fees (`bearer: subaccount`). Members are not
 * surcharged. SaaS subscriptions stay on the main account (no split).
 */
export const ADVISOR_PLATFORM_FEE_PCT = 1;
export const ADVISOR_PAYSTACK_BEARER = 'subaccount' as const;
export const ADVISOR_PAYOUT_META_KEY = 'advisor_payout';

export const ADVISOR_PAYOUT_REQUIRED_DESK =
  'Connect a payout bank on Accounts before taking card or Apple Pay. Members pay the listed price; you pay a 1% admin fee plus Paystack card fees.';

export const ADVISOR_PAYOUT_REQUIRED_MEMBER =
  'This Advisor has not connected card / Apple Pay yet. Send proof of payment or pay at the desk.';

export type AdvisorPayoutRecord = {
  subaccount_code: string;
  business_name: string;
  settlement_bank: string;
  settlement_bank_name: string;
  account_last4: string;
  account_name: string | null;
  percentage_charge: number;
  bearer: typeof ADVISOR_PAYSTACK_BEARER;
  active: boolean;
  connected_at: string;
  updated_at: string;
};

export type AdvisorPayoutPublic = {
  ready: boolean;
  active: boolean;
  business_name: string | null;
  settlement_bank_name: string | null;
  account_last4: string | null;
  account_name: string | null;
  percentage_charge: number;
  bearer: typeof ADVISOR_PAYSTACK_BEARER;
  connected_at: string | null;
};

export type AdvisorPayoutSplit = {
  amount_zar: number;
  member_pays_zar: number;
  platform_fee_pct: number;
  platform_fee_zar: number;
  advisor_gross_zar: number;
  bearer: typeof ADVISOR_PAYSTACK_BEARER;
};

export function accountLast4(accountNumber: string): string {
  const digits = String(accountNumber || '').replace(/\D/g, '');
  return digits.slice(-4);
}

export function normalizeAccountNumber(accountNumber: string): string {
  return String(accountNumber || '').replace(/\s+/g, '').trim();
}

export function previewAdvisorPayoutSplit(amountZar: number): AdvisorPayoutSplit {
  const amountCents = Math.round(Math.max(0, Number(amountZar) || 0) * 100);
  const platformCents = Math.round(
    (amountCents * ADVISOR_PLATFORM_FEE_PCT) / 100
  );
  const advisorCents = amountCents - platformCents;
  const amount = amountCents / 100;
  return {
    amount_zar: amount,
    member_pays_zar: amount,
    platform_fee_pct: ADVISOR_PLATFORM_FEE_PCT,
    platform_fee_zar: platformCents / 100,
    advisor_gross_zar: advisorCents / 100,
    bearer: ADVISOR_PAYSTACK_BEARER,
  };
}

export function emptyAdvisorPayoutPublic(): AdvisorPayoutPublic {
  return {
    ready: false,
    active: false,
    business_name: null,
    settlement_bank_name: null,
    account_last4: null,
    account_name: null,
    percentage_charge: ADVISOR_PLATFORM_FEE_PCT,
    bearer: ADVISOR_PAYSTACK_BEARER,
    connected_at: null,
  };
}

export function readAdvisorPayout(
  meta: Record<string, unknown> | null | undefined
): AdvisorPayoutRecord | null {
  const raw = meta?.[ADVISOR_PAYOUT_META_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const code = String(r.subaccount_code || '').trim();
  if (!code) return null;
  return {
    subaccount_code: code,
    business_name: String(r.business_name || '').trim(),
    settlement_bank: String(r.settlement_bank || '').trim(),
    settlement_bank_name: String(r.settlement_bank_name || '').trim(),
    account_last4: String(r.account_last4 || '').trim(),
    account_name: r.account_name ? String(r.account_name) : null,
    percentage_charge: ADVISOR_PLATFORM_FEE_PCT,
    bearer: ADVISOR_PAYSTACK_BEARER,
    active: r.active !== false,
    connected_at: String(r.connected_at || r.updated_at || ''),
    updated_at: String(r.updated_at || r.connected_at || ''),
  };
}

export function isAdvisorPayoutReady(
  payout: AdvisorPayoutRecord | null | undefined
): payout is AdvisorPayoutRecord {
  return Boolean(payout?.active && String(payout.subaccount_code || '').trim());
}

export function publicAdvisorPayout(
  payout: AdvisorPayoutRecord | null | undefined
): AdvisorPayoutPublic {
  if (!payout) return emptyAdvisorPayoutPublic();
  return {
    ready: isAdvisorPayoutReady(payout),
    active: payout.active,
    business_name: payout.business_name || null,
    settlement_bank_name: payout.settlement_bank_name || null,
    account_last4: payout.account_last4 || null,
    account_name: payout.account_name,
    percentage_charge: ADVISOR_PLATFORM_FEE_PCT,
    bearer: ADVISOR_PAYSTACK_BEARER,
    connected_at: payout.connected_at || null,
  };
}

export function writeAdvisorPayout(
  meta: Record<string, unknown>,
  payout: AdvisorPayoutRecord
): Record<string, unknown> {
  return {
    ...meta,
    [ADVISOR_PAYOUT_META_KEY]: payout,
  };
}

export function advisorPaystackSplitFromMeta(
  meta: Record<string, unknown> | null | undefined,
  audience: 'desk' | 'member'
):
  | { ok: true; subaccount: string; bearer: typeof ADVISOR_PAYSTACK_BEARER }
  | { ok: false; error: string } {
  const payout = readAdvisorPayout(meta);
  if (!isAdvisorPayoutReady(payout)) {
    return {
      ok: false,
      error:
        audience === 'desk'
          ? ADVISOR_PAYOUT_REQUIRED_DESK
          : ADVISOR_PAYOUT_REQUIRED_MEMBER,
    };
  }
  return {
    ok: true,
    subaccount: payout.subaccount_code,
    bearer: ADVISOR_PAYSTACK_BEARER,
  };
}

export function advisorSplitMetadata(
  payout: AdvisorPayoutRecord | { subaccount: string }
): Record<string, unknown> {
  const code =
    'subaccount_code' in payout ? payout.subaccount_code : payout.subaccount;
  return {
    advisor_split: true,
    platform_fee_pct: ADVISOR_PLATFORM_FEE_PCT,
    subaccount_code: code,
    bearer: ADVISOR_PAYSTACK_BEARER,
  };
}
