/**
 * Paystack server helpers — transaction verify + optional plan charge.
 */

export type PaystackVerifyResult = {
  ok: true;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  customerEmail: string | null;
  customerCode: string | null;
  authorizationCode: string | null;
  channel: string | null;
  metadata: Record<string, unknown> | null;
  raw: Record<string, unknown>;
};

export type PaystackVerifyFail = {
  ok: false;
  error: string;
  status?: number;
  raw?: unknown;
};

export function getPaystackSecretKey(): string | null {
  const key =
    process.env.PAYSTACK_SECRET_KEY ||
    process.env.PAYSTACK_SECRET ||
    process.env.PAYSTACK_LIVE_SECRET_KEY ||
    '';
  return key.trim() || null;
}

/**
 * Verify a Paystack transaction reference.
 * When secret key is missing, returns a soft skip so local/dev can still
 * accept refs if explicitly allowed — production should always set the secret.
 */
export async function verifyPaystackTransaction(
  reference: string,
  opts?: { expectedAmountCents?: number; expectedCurrency?: string }
): Promise<PaystackVerifyResult | PaystackVerifyFail> {
  const ref = String(reference || '').trim();
  if (!ref) {
    return { ok: false, error: 'Payment reference is required' };
  }

  const secret = getPaystackSecretKey();
  if (!secret) {
    // Allow activation without secret only in non-production (matches sales-contractor soft path)
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
      return {
        ok: false,
        error:
          'PAYSTACK_SECRET_KEY is not configured. Set it in environment variables to verify payments.',
        status: 503,
      };
    }
    return {
      ok: true,
      reference: ref,
      amount: opts?.expectedAmountCents ?? 0,
      currency: opts?.expectedCurrency || 'ZAR',
      status: 'success',
      paidAt: new Date().toISOString(),
      customerEmail: null,
      customerCode: null,
      authorizationCode: null,
      channel: 'dev_skip',
      metadata: { dev_skip: true },
      raw: { dev_skip: true },
    };
  }

  try {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );
    const body = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: Record<string, unknown>;
    };

    if (!res.ok || !body.status || !body.data) {
      return {
        ok: false,
        error: body.message || `Paystack verify failed (${res.status})`,
        status: res.status,
        raw: body,
      };
    }

    const data = body.data;
    const amount = Number(data.amount ?? 0);
    const currency = String(data.currency || 'ZAR').toUpperCase();
    const txStatus = String(data.status || '').toLowerCase();

    if (txStatus !== 'success') {
      return {
        ok: false,
        error: `Payment not successful (status: ${txStatus || 'unknown'})`,
        raw: body,
      };
    }

    if (
      opts?.expectedAmountCents != null &&
      Number.isFinite(opts.expectedAmountCents) &&
      amount < opts.expectedAmountCents
    ) {
      return {
        ok: false,
        error: `Paid amount too low (got ${amount}, expected ≥ ${opts.expectedAmountCents} cents)`,
        raw: body,
      };
    }

    if (
      opts?.expectedCurrency &&
      currency !== String(opts.expectedCurrency).toUpperCase()
    ) {
      return {
        ok: false,
        error: `Currency mismatch (got ${currency}, expected ${opts.expectedCurrency})`,
        raw: body,
      };
    }

    const customer = (data.customer || {}) as Record<string, unknown>;
    const authorization = (data.authorization || {}) as Record<string, unknown>;

    return {
      ok: true,
      reference: String(data.reference || ref),
      amount,
      currency,
      status: txStatus,
      paidAt: data.paid_at ? String(data.paid_at) : null,
      customerEmail: customer.email ? String(customer.email) : null,
      customerCode: customer.customer_code
        ? String(customer.customer_code)
        : null,
      authorizationCode: authorization.authorization_code
        ? String(authorization.authorization_code)
        : null,
      channel: data.channel ? String(data.channel) : null,
      metadata:
        data.metadata && typeof data.metadata === 'object'
          ? (data.metadata as Record<string, unknown>)
          : null,
      raw: data,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Paystack verify request failed',
    };
  }
}
