/**
 * Paystack plan helpers — optional recurring Core OS (+ packs).
 * Plan codes can be pre-created in Paystack Dashboard and set via env,
 * or created on first use via the Plans API.
 */
import { getPaystackSecretKey } from '@/lib/billing/paystack';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_CENTS,
  type BillingTermId,
} from '@/lib/billing/company-subscription';
import { INDUSTRY_PACK_MONTHLY_ZAR } from '@/lib/product/architecture';

export type PaystackPlanInterval = 'monthly' | 'annually' | 'biannually' | 'quarterly';

function planEnvKey(termId: BillingTermId, packCount: number): string {
  if (packCount <= 0) {
    if (termId === 'monthly') return 'PAYSTACK_PLAN_CORE_MONTHLY';
    if (termId === '1y') return 'PAYSTACK_PLAN_CORE_1Y';
    if (termId === '2y') return 'PAYSTACK_PLAN_CORE_2Y';
    if (termId === '3y') return 'PAYSTACK_PLAN_CORE_3Y';
  }
  return `PAYSTACK_PLAN_CORE_P${packCount}_${termId.toUpperCase()}`;
}

export function envPaystackPlanCode(
  termId: BillingTermId,
  packCount = 0
): string | null {
  const k = planEnvKey(termId, packCount);
  const v = process.env[k]?.trim();
  return v || null;
}

export type PaystackInitializeOpts = {
  email: string;
  amountCents: number;
  currency?: string;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  channels?: string[];
  /** Existing Paystack plan code for subscription-style first charge */
  planCode?: string | null;
  /** Advisor member/till sales only — never set on SA SaaS billing */
  subaccount?: string | null;
  /** Who bears Paystack card fees. Advisor sales use `subaccount`. */
  bearer?: 'account' | 'subaccount';
};

/** Pure initialize body — used by checkout and unit tests. */
export function buildPaystackInitializeBody(
  opts: PaystackInitializeOpts
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    email: opts.email,
    amount: opts.amountCents,
    currency: opts.currency || 'ZAR',
    reference: opts.reference,
    metadata: opts.metadata || {},
    channels: opts.channels || [
      'apple_pay',
      'card',
      'bank',
      'ussd',
      'qr',
      'mobile_money',
      'bank_transfer',
      'eft',
    ],
  };
  if (opts.callbackUrl) body.callback_url = opts.callbackUrl;
  if (opts.planCode) body.plan = opts.planCode;
  const subaccount = String(opts.subaccount || '').trim();
  if (subaccount) {
    body.subaccount = subaccount;
    body.bearer = opts.bearer || 'subaccount';
  }
  return body;
}

/**
 * Initialize a Paystack transaction (server-side).
 * Returns authorization_url + access_code for Popup resumeTransaction / redirect.
 */
export async function initializePaystackTransaction(
  opts: PaystackInitializeOpts
): Promise<
  | {
      ok: true;
      authorizationUrl: string;
      accessCode: string;
      reference: string;
    }
  | { ok: false; error: string }
> {
  const secret = getPaystackSecretKey();
  if (!secret) {
    return { ok: false, error: 'PAYSTACK_SECRET_KEY not configured' };
  }

  const body = buildPaystackInitializeBody(opts);

  try {
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: {
        authorization_url?: string;
        access_code?: string;
        reference?: string;
      };
    };
    if (!res.ok || !json.status || !json.data?.authorization_url) {
      return {
        ok: false,
        error: json.message || `Initialize failed (${res.status})`,
      };
    }
    return {
      ok: true,
      authorizationUrl: String(json.data.authorization_url),
      accessCode: String(json.data.access_code || ''),
      reference: String(json.data.reference || opts.reference),
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Initialize request failed',
    };
  }
}

/**
 * Create a Paystack plan (or return existing by code via list).
 * Interval monthly; amount in kobo/cents.
 */
export async function ensurePaystackPlan(opts: {
  name: string;
  amountCents: number;
  interval: PaystackPlanInterval;
  planCode: string;
}): Promise<{ ok: true; planCode: string } | { ok: false; error: string }> {
  const secret = getPaystackSecretKey();
  if (!secret) {
    return { ok: false, error: 'PAYSTACK_SECRET_KEY not configured' };
  }

  // Try create
  try {
    const res = await fetch('https://api.paystack.co/plan', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: opts.name,
        amount: opts.amountCents,
        interval: opts.interval,
        currency: 'ZAR',
        plan_code: opts.planCode,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: { plan_code?: string };
    };
    if (json.status && json.data?.plan_code) {
      return { ok: true, planCode: String(json.data.plan_code) };
    }
    // Already exists — use requested code
    if (/exist|duplicate|already/i.test(String(json.message || ''))) {
      return { ok: true, planCode: opts.planCode };
    }
    return { ok: false, error: json.message || 'Plan create failed' };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Plan create failed',
    };
  }
}

/** Suggested plan amount for Core + N packs monthly */
export function monthlyPlanAmountCents(packCount: number): number {
  return (
    COMPANY_SUBSCRIPTION_MONTHLY_CENTS +
    Math.max(0, packCount) * INDUSTRY_PACK_MONTHLY_ZAR * 100
  );
}

/**
 * After first successful payment with authorization, create a Paystack subscription
 * for auto-renew (optional; requires customer + authorization codes).
 */
export async function createPaystackSubscription(opts: {
  customerCode: string;
  planCode: string;
  authorizationCode: string;
  startDate?: string;
}): Promise<{ ok: true; subscriptionCode: string } | { ok: false; error: string }> {
  const secret = getPaystackSecretKey();
  if (!secret) {
    return { ok: false, error: 'PAYSTACK_SECRET_KEY not configured' };
  }
  try {
    const res = await fetch('https://api.paystack.co/subscription', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer: opts.customerCode,
        plan: opts.planCode,
        authorization: opts.authorizationCode,
        start_date: opts.startDate,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: { subscription_code?: string };
    };
    if (!json.status || !json.data?.subscription_code) {
      return {
        ok: false,
        error: json.message || 'Subscription create failed',
      };
    }
    return {
      ok: true,
      subscriptionCode: String(json.data.subscription_code),
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Subscription create failed',
    };
  }
}
