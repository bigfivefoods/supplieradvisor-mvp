/**
 * Last Paystack webhook activity for ops health (from activity_log).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

export type PaystackWebhookPulse = {
  lastAt: string | null;
  ageHours: number | null;
  lastAction: string | null;
  lastSummary: string | null;
  lastCompanyId: number | null;
  lastReference: string | null;
  last24hCount: number;
  stale: boolean;
};

export async function loadPaystackWebhookPulse(): Promise<PaystackWebhookPulse> {
  const empty: PaystackWebhookPulse = {
    lastAt: null,
    ageHours: null,
    lastAction: null,
    lastSummary: null,
    lastCompanyId: null,
    lastReference: null,
    last24hCount: 0,
    stale: true,
  };

  try {
    const supabase = getSupabaseServer();
    const { data: latest } = await supabase
      .from('activity_log')
      .select('profile_id, action, summary, metadata, created_at')
      .in('action', [
        'billing.paystack_cipc_webhook',
        'billing.paystack_refund_webhook',
      ])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .in('action', [
        'billing.paystack_cipc_webhook',
        'billing.paystack_refund_webhook',
      ])
      .gte('created_at', since);

    if (!latest?.created_at) {
      return { ...empty, last24hCount: count ?? 0, stale: true };
    }

    const lastMs = new Date(String(latest.created_at)).getTime();
    const ageHours = Math.max(
      0,
      Math.round((Date.now() - lastMs) / 3600000)
    );
    const meta =
      latest.metadata && typeof latest.metadata === 'object'
        ? (latest.metadata as Record<string, unknown>)
        : {};

    return {
      lastAt: String(latest.created_at),
      ageHours,
      lastAction: String(latest.action || ''),
      lastSummary: latest.summary ? String(latest.summary) : null,
      lastCompanyId: latest.profile_id ? Number(latest.profile_id) : null,
      lastReference: meta.reference ? String(meta.reference) : null,
      last24hCount: count ?? 0,
      // Stale if no webhook activity in 72h when secret is expected in prod
      stale: ageHours >= 72,
    };
  } catch {
    return empty;
  }
}
