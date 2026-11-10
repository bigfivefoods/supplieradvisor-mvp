/**
 * Forward Big Five Group shop Paystack events.
 * The shop owns fulfilment for references that start with bfg-shop-.
 * SupplierAdvisor® only relays the verified raw body.
 */

export const BFG_SHOP_WEBHOOK_URL = 'https://bigfivegroup.africa/api/paystack/webhook';

export const BFG_SHOP_REFERENCE_PREFIX = 'bfg-shop-';

/** Paystack retries for hours; a short relay timeout leaves room for that retry. */
export const BFG_SHOP_WEBHOOK_TIMEOUT_MS = 10_000;

export function bfgShopWebhookUrl(): string {
  const configured = process.env.BFG_SHOP_WEBHOOK_URL;
  if (typeof configured === 'string' && configured.trim()) {
    return configured.trim();
  }
  return BFG_SHOP_WEBHOOK_URL;
}

export function isBfgShopReference(reference: unknown): reference is string {
  return (
    typeof reference === 'string' &&
    reference.startsWith(BFG_SHOP_REFERENCE_PREFIX)
  );
}

export type BfgShopForwardResult =
  | { ok: true }
  | { ok: false; reason: 'network' | 'http'; status?: number };

/**
 * POST the unmodified raw body and the original Paystack signature.
 * Resolves ok:false on network errors, timeouts, and non-2xx responses.
 */
export async function forwardBfgShopWebhook(
  rawBody: string,
  signature: string,
  reference: string
): Promise<BfgShopForwardResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BFG_SHOP_WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(bfgShopWebhookUrl(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-paystack-signature': signature,
      },
      body: rawBody,
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error('[paystack webhook] Big Five Group shop forward failed', {
        outcome: 'non_2xx',
        status: res.status,
        reference,
      });
      await cancelBody(res);
      return { ok: false, reason: 'http', status: res.status };
    }
    await cancelBody(res);
    return { ok: true };
  } catch (err) {
    console.error('[paystack webhook] Big Five Group shop forward failed', {
      outcome: 'network_error',
      error: err instanceof Error ? err.name : 'Error',
      reference,
    });
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

async function cancelBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    /* The status is already known. The body is not logged. */
  }
}
