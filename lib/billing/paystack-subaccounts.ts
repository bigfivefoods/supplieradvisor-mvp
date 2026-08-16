/**
 * Paystack Subaccounts API — Advisor settlement banks.
 * @see https://paystack.com/docs/api/subaccount/
 */
import { getPaystackSecretKey } from '@/lib/billing/paystack';
import {
  ADVISOR_PLATFORM_FEE_PCT,
  normalizeAccountNumber,
} from '@/lib/billing/advisor-payout';

export type PaystackBank = {
  name: string;
  code: string;
  slug?: string;
  currency?: string;
};

export type PaystackResolvedAccount = {
  account_number: string;
  account_name: string;
};

export type PaystackSubaccount = {
  subaccount_code: string;
  business_name: string;
  settlement_bank: string;
  account_number: string;
  percentage_charge: number;
  active?: boolean;
};

type PaystackJson<T> = {
  status?: boolean;
  message?: string;
  data?: T;
};

async function paystackRequest<T>(
  path: string,
  init?: { method?: string; body?: Record<string, unknown> }
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const secret = getPaystackSecretKey();
  if (!secret) {
    return { ok: false, error: 'PAYSTACK_SECRET_KEY not configured' };
  }
  try {
    const res = await fetch(`https://api.paystack.co${path}`, {
      method: init?.method || 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => ({}))) as PaystackJson<T>;
    if (!res.ok || json.status === false || json.data == null) {
      return {
        ok: false,
        error: json.message || `Paystack request failed (${res.status})`,
      };
    }
    return { ok: true, data: json.data };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Paystack request failed',
    };
  }
}

let banksCache: { at: number; banks: PaystackBank[] } | null = null;
const BANKS_TTL_MS = 60 * 60 * 1000;

export async function listPaystackZaBanks(): Promise<
  { ok: true; banks: PaystackBank[] } | { ok: false; error: string }
> {
  if (banksCache && Date.now() - banksCache.at < BANKS_TTL_MS) {
    return { ok: true, banks: banksCache.banks };
  }
  const res = await paystackRequest<Array<Record<string, unknown>>>(
    '/bank?country=south africa&currency=ZAR&perPage=200'
  );
  if (!res.ok) return res;
  const banks = (Array.isArray(res.data) ? res.data : [])
    .filter((b) => b && b.active !== false && b.is_deleted !== true)
    .map((b) => ({
      name: String(b.name || '').trim(),
      code: String(b.code || '').trim(),
      slug: b.slug ? String(b.slug) : undefined,
      currency: b.currency ? String(b.currency) : 'ZAR',
    }))
    .filter((b) => b.name && b.code)
    .sort((a, b) => a.name.localeCompare(b.name));
  banksCache = { at: Date.now(), banks };
  return { ok: true, banks };
}

export async function resolvePaystackAccount(opts: {
  accountNumber: string;
  bankCode: string;
}): Promise<
  { ok: true; account: PaystackResolvedAccount } | { ok: false; error: string }
> {
  const accountNumber = normalizeAccountNumber(opts.accountNumber);
  const bankCode = String(opts.bankCode || '').trim();
  if (!accountNumber || !bankCode) {
    return { ok: false, error: 'Account number and bank are required' };
  }
  const res = await paystackRequest<Record<string, unknown>>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
  );
  if (!res.ok) return res;
  const name = String(res.data.account_name || '').trim();
  if (!name) return { ok: false, error: 'Could not resolve account name' };
  return {
    ok: true,
    account: {
      account_number: String(res.data.account_number || accountNumber),
      account_name: name,
    },
  };
}

function asSubaccount(raw: Record<string, unknown>): PaystackSubaccount {
  return {
    subaccount_code: String(raw.subaccount_code || '').trim(),
    business_name: String(raw.business_name || '').trim(),
    settlement_bank: String(raw.settlement_bank || raw.bank || '').trim(),
    account_number: String(raw.account_number || '').trim(),
    percentage_charge: Number(raw.percentage_charge || ADVISOR_PLATFORM_FEE_PCT),
    active: raw.active !== false,
  };
}

export async function fetchPaystackSubaccount(
  code: string
): Promise<
  { ok: true; subaccount: PaystackSubaccount } | { ok: false; error: string }
> {
  const res = await paystackRequest<Record<string, unknown>>(
    `/subaccount/${encodeURIComponent(code)}`
  );
  if (!res.ok) return res;
  const sub = asSubaccount(res.data);
  if (!sub.subaccount_code) {
    return { ok: false, error: 'Subaccount missing code' };
  }
  return { ok: true, subaccount: sub };
}

async function findSubaccountByAccount(
  accountNumber: string
): Promise<PaystackSubaccount | null> {
  const want = normalizeAccountNumber(accountNumber);
  const res = await paystackRequest<Array<Record<string, unknown>>>(
    '/subaccount?perPage=200'
  );
  if (!res.ok || !Array.isArray(res.data)) return null;
  for (const row of res.data) {
    const sub = asSubaccount(row);
    if (normalizeAccountNumber(sub.account_number) === want && sub.subaccount_code) {
      return sub;
    }
  }
  return null;
}

export async function upsertPaystackSubaccount(opts: {
  existingCode?: string | null;
  businessName: string;
  bankCode: string;
  accountNumber: string;
  description?: string;
}): Promise<
  { ok: true; subaccount: PaystackSubaccount } | { ok: false; error: string }
> {
  const businessName = String(opts.businessName || '').trim();
  const bankCode = String(opts.bankCode || '').trim();
  const accountNumber = normalizeAccountNumber(opts.accountNumber);
  if (businessName.length < 2) {
    return { ok: false, error: 'Business name is required' };
  }
  if (!bankCode) return { ok: false, error: 'Select a bank' };
  if (accountNumber.length < 6) {
    return { ok: false, error: 'Enter a valid account number' };
  }

  const payload: Record<string, unknown> = {
    business_name: businessName,
    settlement_bank: bankCode,
    account_number: accountNumber,
    percentage_charge: ADVISOR_PLATFORM_FEE_PCT,
    description:
      opts.description ||
      'SupplierAdvisor Advisor payout · 1% platform admin fee',
  };

  const existing = String(opts.existingCode || '').trim();
  if (existing) {
    const updated = await paystackRequest<Record<string, unknown>>(
      `/subaccount/${encodeURIComponent(existing)}`,
      { method: 'PUT', body: payload }
    );
    if (updated.ok) {
      return { ok: true, subaccount: asSubaccount(updated.data) };
    }
    // Fall through to create if the stored code is stale.
  }

  const created = await paystackRequest<Record<string, unknown>>('/subaccount', {
    method: 'POST',
    body: payload,
  });
  if (created.ok) {
    return { ok: true, subaccount: asSubaccount(created.data) };
  }

  if (/exist|duplicate|already/i.test(created.error)) {
    const found = await findSubaccountByAccount(accountNumber);
    if (found?.subaccount_code) {
      const updated = await paystackRequest<Record<string, unknown>>(
        `/subaccount/${encodeURIComponent(found.subaccount_code)}`,
        { method: 'PUT', body: payload }
      );
      if (updated.ok) {
        return { ok: true, subaccount: asSubaccount(updated.data) };
      }
      return { ok: true, subaccount: found };
    }
  }

  return created;
}
