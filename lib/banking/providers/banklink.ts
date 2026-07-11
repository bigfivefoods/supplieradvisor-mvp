/**
 * BankLink open-banking adapter (https://api.banklink.co.za/v1).
 *
 * Env:
 *   BANKLINK_API_KEY        — sk_test_… or sk_live_…
 *   BANKLINK_API_BASE       — default https://api.banklink.co.za/v1
 *   BANKLINK_WEBHOOK_SECRET — optional HMAC secret for webhooks
 *   BANKLINK_SANDBOX=1      — force sandbox mock when no key
 *
 * Without API key: sandbox mode creates mock FNB connections + demo txns.
 */

import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import type { CanonicalTxn, LinkSessionResult } from '../types';
import { providerTxnId } from '../ingest';

const DEFAULT_BASE = 'https://api.banklink.co.za/v1';

export function banklinkConfig() {
  const apiKey = process.env.BANKLINK_API_KEY || '';
  const base = (process.env.BANKLINK_API_BASE || DEFAULT_BASE).replace(/\/$/, '');
  const webhookSecret = process.env.BANKLINK_WEBHOOK_SECRET || '';
  const forceSandbox =
    process.env.BANKLINK_SANDBOX === '1' ||
    process.env.BANKLINK_SANDBOX === 'true' ||
    !apiKey;
  return {
    apiKey,
    base,
    webhookSecret,
    mode: forceSandbox ? ('sandbox' as const) : ('live' as const),
    configured: !!apiKey,
  };
}

async function banklinkFetch(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  const { apiKey, base, mode } = banklinkConfig();
  if (mode === 'sandbox' || !apiKey) {
    return { ok: false, status: 0, data: null, error: 'sandbox' };
  }
  try {
    const res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const errMsg =
        typeof data === 'object' && data && 'error' in data
          ? String((data as { error: unknown }).error)
          : text.slice(0, 200) || res.statusText;
      return { ok: false, status: res.status, data, error: errMsg };
    }
    return { ok: true, status: res.status, data };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: e instanceof Error ? e.message : 'BankLink request failed',
    };
  }
}

/** Create a link session — returns hosted URL or sandbox in-app URL. */
export async function createBankLinkSession(params: {
  companyId: number;
  returnUrl: string;
  bankAccountId?: number | null;
}): Promise<LinkSessionResult & { externalPayload?: unknown }> {
  const cfg = banklinkConfig();
  const sessionId = `bl_${randomUUID().replace(/-/g, '')}`;

  if (cfg.mode === 'sandbox') {
    const url = new URL(params.returnUrl);
    url.searchParams.set('bank_link', '1');
    url.searchParams.set('session', sessionId);
    url.searchParams.set('mode', 'sandbox');
    return {
      connectionId: 0, // filled by API after DB insert
      sessionId,
      url: url.toString(),
      mode: 'sandbox',
      message:
        'Sandbox mode — no BANKLINK_API_KEY. Completing the flow will attach a mock FNB feed with sample transactions.',
    };
  }

  // Live: POST /link with return URL (shape may evolve with BankLink SDK)
  const res = await banklinkFetch('/link', {
    method: 'POST',
    body: JSON.stringify({
      redirect_uri: params.returnUrl,
      return_url: params.returnUrl,
      reference: `sa-company-${params.companyId}`,
      metadata: {
        companyId: params.companyId,
        bankAccountId: params.bankAccountId || null,
        sessionId,
      },
    }),
  });

  if (!res.ok) {
    // Fall back to sandbox-style URL with error note if live link fails
    const url = new URL(params.returnUrl);
    url.searchParams.set('bank_link', '1');
    url.searchParams.set('session', sessionId);
    url.searchParams.set('mode', 'error');
    return {
      connectionId: 0,
      sessionId,
      url: url.toString(),
      mode: 'live',
      message: res.error || 'BankLink link failed — check API key and /link payload',
      externalPayload: res.data,
    };
  }

  const data = res.data as Record<string, unknown>;
  const linkUrl =
    String(data.url || data.link_url || data.href || data.redirect_url || '') ||
    params.returnUrl;
  const externalId = String(
    data.id || data.link_id || data.connection_id || data.session_id || sessionId
  );

  return {
    connectionId: 0,
    sessionId: externalId,
    url: linkUrl,
    mode: 'live',
    externalPayload: data,
  };
}

export type RemoteAccount = {
  id: string;
  name?: string;
  bank_name?: string;
  mask?: string;
  currency?: string;
  balance?: number;
};

export async function listBankLinkAccounts(): Promise<{
  accounts: RemoteAccount[];
  error?: string;
  sandbox?: boolean;
}> {
  const cfg = banklinkConfig();
  if (cfg.mode === 'sandbox') {
    return {
      sandbox: true,
      accounts: [
        {
          id: 'sandbox-fnb-001',
          name: 'Business Current',
          bank_name: 'FNB',
          mask: '4521',
          currency: 'ZAR',
          balance: 125430.55,
        },
      ],
    };
  }
  const res = await banklinkFetch('/accounts');
  if (!res.ok) return { accounts: [], error: res.error };
  const data = res.data as { accounts?: RemoteAccount[]; data?: RemoteAccount[] } | RemoteAccount[];
  const list = Array.isArray(data)
    ? data
    : data.accounts || data.data || [];
  return { accounts: list as RemoteAccount[] };
}

export async function fetchBankLinkTransactions(params: {
  accountId: string;
  from?: string;
  to?: string;
}): Promise<{ txns: CanonicalTxn[]; error?: string; sandbox?: boolean }> {
  const cfg = banklinkConfig();
  if (cfg.mode === 'sandbox') {
    return { sandbox: true, txns: sandboxTransactions() };
  }

  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  const q = qs.toString() ? `?${qs}` : '';
  const res = await banklinkFetch(`/accounts/${encodeURIComponent(params.accountId)}/transactions${q}`);
  if (!res.ok) return { txns: [], error: res.error };

  const data = res.data as {
    transactions?: unknown[];
    data?: unknown[];
    items?: unknown[];
  };
  const rawList = data.transactions || data.data || data.items || [];
  const txns = (rawList as Record<string, unknown>[]).map((row) =>
    normalizeBankLinkTxn(row)
  );
  return { txns };
}

export function normalizeBankLinkTxn(row: Record<string, unknown>): CanonicalTxn {
  const amount = Number(
    row.amount ?? row.value ?? row.transaction_amount ?? 0
  );
  // BankLink may send absolute amount + direction
  let signed = amount;
  const dir = String(row.direction || row.type || row.credit_debit || '').toLowerCase();
  if (dir.includes('debit') || dir === 'out' || dir === 'withdrawal') {
    signed = -Math.abs(amount);
  } else if (dir.includes('credit') || dir === 'in' || dir === 'deposit') {
    signed = Math.abs(amount);
  }

  const dateRaw = String(
    row.date || row.booking_date || row.booked_at || row.posted_at || row.value_date || ''
  ).slice(0, 10);
  const booked_at = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
    ? dateRaw
    : new Date().toISOString().slice(0, 10);

  const description = String(
    row.description || row.narrative || row.memo || row.reference || 'Bank transaction'
  );
  const reference = row.reference != null ? String(row.reference) : null;
  const id =
    String(row.id || row.transaction_id || row.txn_id || '') ||
    providerTxnId('banklink', [booked_at, description, signed, reference]);

  return {
    provider: 'banklink',
    provider_txn_id: id,
    booked_at,
    amount: signed,
    currency: String(row.currency || 'ZAR'),
    description: description.slice(0, 500),
    reference,
    counterparty:
      row.counterparty != null
        ? String(row.counterparty)
        : row.counterparty_name != null
          ? String(row.counterparty_name)
          : null,
    balance_after:
      row.balance != null
        ? Number(row.balance)
        : row.running_balance != null
          ? Number(row.running_balance)
          : row.balance_after != null
            ? Number(row.balance_after)
            : null,
    raw: row,
  };
}

/** Demo transactions for sandbox / demo connect. */
export function sandboxTransactions(asOf = new Date()): CanonicalTxn[] {
  const d = (offset: number) => {
    const x = new Date(asOf);
    x.setDate(x.getDate() - offset);
    return x.toISOString().slice(0, 10);
  };
  const samples: Array<Omit<CanonicalTxn, 'provider' | 'provider_txn_id'> & { id: string }> = [
    {
      id: 'sbx-1',
      booked_at: d(1),
      amount: 15000,
      currency: 'ZAR',
      description: 'PAYMENT FROM ACME TRADING',
      reference: 'INV-1042',
      counterparty: 'Acme Trading',
      balance_after: 125430.55,
    },
    {
      id: 'sbx-2',
      booked_at: d(2),
      amount: -2450.0,
      currency: 'ZAR',
      description: 'DEBIT ORDER RAIN PTY',
      reference: 'DO-RAIN',
      counterparty: 'Rain',
      balance_after: 110430.55,
    },
    {
      id: 'sbx-3',
      booked_at: d(3),
      amount: -8900.5,
      currency: 'ZAR',
      description: 'EFT TO SUPPLIER HOLDINGS',
      reference: 'PO-2281',
      counterparty: 'Supplier Holdings',
      balance_after: 112880.55,
    },
    {
      id: 'sbx-4',
      booked_at: d(5),
      amount: 3200,
      currency: 'ZAR',
      description: 'CARD SETTLEMENT YOCO',
      reference: 'YOCO-BATCH',
      counterparty: 'Yoco',
      balance_after: 121781.05,
    },
    {
      id: 'sbx-5',
      booked_at: d(7),
      amount: -450,
      currency: 'ZAR',
      description: 'MONTHLY SERVICE FEE',
      reference: 'FEE',
      counterparty: 'FNB',
      balance_after: 118581.05,
    },
  ];
  return samples.map((s) => ({
    provider: 'sandbox' as const,
    provider_txn_id: s.id,
    booked_at: s.booked_at,
    amount: s.amount,
    currency: s.currency,
    description: s.description,
    reference: s.reference,
    counterparty: s.counterparty,
    balance_after: s.balance_after,
    raw: { sandbox: true, id: s.id },
  }));
}

export function verifyBankLinkWebhook(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const { webhookSecret } = banklinkConfig();
  if (!webhookSecret) {
    // No secret configured — accept in sandbox; reject signature mismatch only when set
    return true;
  }
  if (!signatureHeader) return false;
  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const got = signatureHeader.replace(/^sha256=/, '').trim();
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(got);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function triggerBankLinkSync(accountId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const cfg = banklinkConfig();
  if (cfg.mode === 'sandbox') return { ok: true };
  const res = await banklinkFetch(`/accounts/${encodeURIComponent(accountId)}/sync`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return { ok: res.ok, error: res.error };
}
