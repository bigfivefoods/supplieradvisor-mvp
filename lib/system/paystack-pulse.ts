/**
 * Last Paystack webhook activity for ops health (from activity_log).
 *
 * Real delivery actions (charge/refund/CIPC) drive "stale".
 * GET ?ping=1 probes prove reachability only — they must not raise a 72h
 * stale warning when there are simply no payments (common between CIPC charges).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

/** Real Paystack → us traffic (Dashboard delivery) */
const REAL_PULSE_ACTIONS = [
  'billing.paystack_webhook_received',
  'billing.paystack_cipc_webhook',
  'billing.paystack_refund_webhook',
] as const;

/** Ops probes (GET ?ping=1, health seed) — not Dashboard delivery */
const PROBE_PULSE_ACTIONS = ['billing.paystack_webhook_ping'] as const;

const PULSE_ACTIONS = [
  ...REAL_PULSE_ACTIONS,
  ...PROBE_PULSE_ACTIONS,
] as const;

export type PaystackWebhookPulse = {
  lastAt: string | null;
  ageHours: number | null;
  lastAction: string | null;
  lastSummary: string | null;
  lastCompanyId: number | null;
  lastReference: string | null;
  last24hCount: number;
  /** True only when a *real* webhook went quiet past threshold */
  stale: boolean;
  /** never | ok | stale | probe_only | unknown */
  status: 'never' | 'ok' | 'stale' | 'probe_only' | 'unknown';
  staleHoursThreshold: number;
  /** Latest real charge/refund/CIPC pulse (if any) */
  lastRealAt?: string | null;
  lastRealAgeHours?: number | null;
  lastProbeAt?: string | null;
};

function thresholdHours(): number {
  const n = Number(process.env.PAYSTACK_WEBHOOK_STALE_HOURS || 72);
  return Number.isFinite(n) && n > 0 ? n : 72;
}

function ageHoursFrom(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const lastMs = new Date(String(iso)).getTime();
  if (!Number.isFinite(lastMs)) return null;
  return Math.max(0, Math.round((Date.now() - lastMs) / 3600000));
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
    stale: false,
    status: 'never',
    staleHoursThreshold: thr,
    lastRealAt: null,
    lastRealAgeHours: null,
    lastProbeAt: null,
  };

  try {
    const supabase = getSupabaseServer();
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const [latestAny, latestReal, latestProbe, countRes] = await Promise.all([
      supabase
        .from('activity_log')
        .select('profile_id, action, summary, metadata, created_at')
        .in('action', [...PULSE_ACTIONS])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('activity_log')
        .select('profile_id, action, summary, metadata, created_at')
        .in('action', [...REAL_PULSE_ACTIONS])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('activity_log')
        .select('created_at')
        .in('action', [...PROBE_PULSE_ACTIONS])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('activity_log')
        .select('id', { count: 'exact', head: true })
        .in('action', [...PULSE_ACTIONS])
        .gte('created_at', since),
    ]);

    const latest = latestAny.data;
    const real = latestReal.data;
    const probeAt = latestProbe.data?.created_at
      ? String(latestProbe.data.created_at)
      : null;
    const last24hCount = countRes.count ?? 0;

    if (!latest?.created_at) {
      return {
        ...empty,
        last24hCount,
        stale: false,
        status: 'never',
      };
    }

    const meta =
      latest.metadata && typeof latest.metadata === 'object'
        ? (latest.metadata as Record<string, unknown>)
        : {};
    const lastAt = String(latest.created_at);
    const ageHours = ageHoursFrom(lastAt);
    const lastRealAt = real?.created_at ? String(real.created_at) : null;
    const lastRealAgeHours = ageHoursFrom(lastRealAt);

    // Stale only when we have seen real Paystack delivery and it went quiet
    const isStale =
      lastRealAt != null &&
      lastRealAgeHours != null &&
      lastRealAgeHours >= thr;

    let status: PaystackWebhookPulse['status'] = 'ok';
    if (isStale) status = 'stale';
    else if (!lastRealAt) status = 'probe_only';
    else status = 'ok';

    return {
      lastAt,
      ageHours,
      lastAction: String(latest.action || ''),
      lastSummary: latest.summary ? String(latest.summary) : null,
      lastCompanyId: latest.profile_id ? Number(latest.profile_id) : null,
      lastReference: meta.reference ? String(meta.reference) : null,
      last24hCount,
      stale: isStale,
      status,
      staleHoursThreshold: thr,
      lastRealAt,
      lastRealAgeHours,
      lastProbeAt: probeAt,
    };
  } catch {
    return { ...empty, status: 'unknown', stale: false };
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
