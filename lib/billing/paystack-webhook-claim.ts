/**
 * Deduplicate Paystack webhook deliveries (retries + dual URLs).
 * Soft-skips if the reliability SQL has not been applied yet.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isMissingRelation } from '@/lib/business/company-data';

export type PaystackWebhookClaim = {
  first: boolean;
  hits: number;
  handled: string | null;
};

function asClaim(raw: unknown): PaystackWebhookClaim | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.ok === false) return null;
  return {
    first: r.first !== false,
    hits: Number(r.hits) || 0,
    handled: r.handled != null ? String(r.handled) : null,
  };
}

export async function claimPaystackWebhook(
  reference: string,
  event: string
): Promise<PaystackWebhookClaim | null> {
  const ref = String(reference || '').trim();
  const ev = String(event || '').trim() || 'unknown';
  if (!ref) return null;
  try {
    const supabase = getSupabaseServer();
    const rpc = await supabase.rpc('sa_claim_paystack_webhook', {
      p_reference: ref,
      p_event: ev,
    });
    if (rpc.error) {
      if (!isMissingRelation(rpc.error)) {
        console.warn('claimPaystackWebhook', rpc.error.message);
      }
      return null;
    }
    return asClaim(rpc.data);
  } catch (e) {
    console.warn(
      'claimPaystackWebhook',
      e instanceof Error ? e.message : 'failed'
    );
    return null;
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
    /* soft */
  }
}
