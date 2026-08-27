/**
 * Deduplicate Paystack webhook deliveries (retries + dual URLs).
 * Fail closed when reliability SQL is missing so Paystack retries.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isMissingRelation } from '@/lib/business/company-data';

export type PaystackWebhookClaim = {
  first: boolean;
  hits: number;
  handled: string | null;
  inFlight: boolean;
};

export type PaystackWebhookClaimResult =
  | ({ ok: true } & PaystackWebhookClaim)
  | { ok: false; unavailable: true; error: string };

function asClaim(raw: unknown): PaystackWebhookClaim | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.ok === false) return null;
  const handled = r.handled != null && String(r.handled).trim() ? String(r.handled) : null;
  const first = r.first !== false;
  const inFlight = r.in_flight === true || r.inFlight === true;
  return {
    first,
    hits: Number(r.hits) || 0,
    handled,
    inFlight,
  };
}

export async function claimPaystackWebhook(
  reference: string,
  event: string
): Promise<PaystackWebhookClaimResult> {
  const ref = String(reference || '').trim();
  const ev = String(event || '').trim() || 'unknown';
  if (!ref) {
    return { ok: false, unavailable: true, error: 'missing_reference' };
  }
  try {
    const supabase = getSupabaseServer();
    const rpc = await supabase.rpc('sa_claim_paystack_webhook', {
      p_reference: ref,
      p_event: ev,
    });
    if (rpc.error) {
      const msg = rpc.error.message || 'claim_failed';
      if (!isMissingRelation(rpc.error)) {
        console.warn('claimPaystackWebhook', msg);
      }
      return { ok: false, unavailable: true, error: msg };
    }
    const parsed = asClaim(rpc.data);
    if (!parsed) {
      return { ok: false, unavailable: true, error: 'claim_unparsed' };
    }
    return { ok: true, ...parsed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'failed';
    console.warn('claimPaystackWebhook', msg);
    return { ok: false, unavailable: true, error: msg };
  }
}

export async function markPaystackWebhook(
  reference: string,
  event: string,
  handled: string
): Promise<void> {
  const ref = String(reference || '').trim();
  const ev = String(event || '').trim() || 'unknown';
  if (!ref) return;
  try {
    const supabase = getSupabaseServer();
    const rpc = await supabase.rpc('sa_mark_paystack_webhook', {
      p_reference: ref,
      p_event: ev,
      p_handled: handled,
    });
    if (rpc.error && !isMissingRelation(rpc.error)) {
      console.warn('markPaystackWebhook', rpc.error.message);
    }
  } catch {
    /* mark is best-effort after durable success */
  }
}
