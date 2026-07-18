/**
 * Last Paystack webhook activity for ops health (from activity_log).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

const PULSE_ACTIONS = [
  'billing.paystack_webhook_received',
  'billing.paystack_cipc_webhook',
  'billing.paystack_refund_webhook',
  'billing.paystack_webhook_ping',
] as const;

export type PaystackWebhookPulse = {
  lastAt: string | null;
  ageHours: number | null;
  lastAction: string | null;
  lastSummary: string | null;
  lastCompanyId: number | null;
  lastReference: string | null;
  last24hCount: number;
  /** True when last event older than threshold, or never seen while secret is configured */
  stale: boolean;
  /** never | ok | stale | unknown */
  status: 'never' | 'ok' | 'stale' | 'unknown';
  staleHoursThreshold: number;
};

function thresholdHours(): number {
  const n = Number(process.env.PAYSTACK_WEBHOOK_STALE_HOURS || 72);
  return Number.isFinite(n) && n > 0 ? n : 72;
}

export async function loadPaystackWebhookPulse(): Promise<PaystackWebhookPulse> {
  const thr = thresholdHours();
  const empty: PaystackWebhookPulse = {
    lastAt: null,
    ageHours: null,
    lastAction: null,
    lastSummary: null,
    lastCompanyId: null,
    lastReference: null,
    last24hCount: 0,
    stale: true,
    status: 'never',
    staleHoursThreshold: thr,
  };

  try {
    const supabase = getSupabaseServer();
    const { data: latest } = await supabase
      .from('activity_log')
      .select('profile_id, action, summary, metadata, created_at')
      .in('action', [...PULSE_ACTIONS])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .in('action', [...PULSE_ACTIONS])
      .gte('created_at', since);

    if (!latest?.created_at) {
      // Never received ≠ stale: endpoint may be healthy but no charge yet.
      // status=never for ops UI; stale only after we had traffic then went quiet.
      return {
        ...empty,
        last24hCount: count ?? 0,
        stale: false,
        status: 'never',
      };
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
    const isStale = ageHours >= thr;

    return {
      lastAt: String(latest.created_at),
      ageHours,
      lastAction: String(latest.action || ''),
      lastSummary: latest.summary ? String(latest.summary) : null,
      lastCompanyId: latest.profile_id ? Number(latest.profile_id) : null,
      lastReference: meta.reference ? String(meta.reference) : null,
      last24hCount: count ?? 0,
      stale: isStale,
      status: isStale ? 'stale' : 'ok',
      staleHoursThreshold: thr,
    };
  } catch {
    return { ...empty, status: 'unknown' };
  }
}

/**
 * Record that Paystack hit our endpoint (any event). Uses system profile_id=0 or first company.
 * Soft-fail if activity_log missing.
 */
export async function recordPaystackWebhookPulse(opts: {
  event: string;
  reference?: string | null;
  companyId?: number | null;
  handled?: string | null;
  summary?: string | null;
  action?: (typeof PULSE_ACTIONS)[number];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = getSupabaseServer();
    const profileId =
      opts.companyId && opts.companyId > 0 ? opts.companyId : 0;
    // profile_id 0 may fail FK — soft fall back to null skip
    const row: Record<string, unknown> = {
      actor_user_id: 'paystack:webhook',
      action: opts.action || 'billing.paystack_webhook_received',
      entity_type: 'paystack',
      entity_id: opts.reference || opts.event || 'event',
      summary:
        opts.summary ||
        `Paystack ${opts.event || 'event'}${
          opts.handled ? ` → ${opts.handled}` : ''
        }`,
      metadata: {
        event: opts.event,
        reference: opts.reference || null,
        handled: opts.handled || null,
        ...(opts.metadata || {}),
      },
    };
    if (profileId > 0) row.profile_id = profileId;

    const { error } = await supabase.from('activity_log').insert(row);
    if (error && profileId > 0) {
      // retry without profile if FK failed oddly
      delete row.profile_id;
      await supabase.from('activity_log').insert(row);
    } else if (error) {
      // profile_id required: pick any profile for ops heartbeat
      const { data: anyProf } = await supabase
        .from('profiles')
        .select('id')
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (anyProf?.id) {
        await supabase.from('activity_log').insert({
          ...row,
          profile_id: Number(anyProf.id),
        });
      }
    }
  } catch {
    /* soft */
  }
}
