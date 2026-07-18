/**
 * Ops control plane snapshot — Paystack, CIPC SLA, claims, crons, env.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { loadPaystackWebhookPulse } from '@/lib/system/paystack-pulse';
import { buildVerificationSla } from '@/lib/business/verification-sla';
import { deploymentMeta } from '@/lib/system/schema-probe';

export type OpsBoardSnapshot = {
  at: string;
  deploy: ReturnType<typeof deploymentMeta>;
  env: {
    paystackSecret: boolean;
    resend: boolean;
    cronSecret: boolean;
    opsAlertEmail: boolean;
    verifynow: boolean;
  };
  paystack: Awaited<ReturnType<typeof loadPaystackWebhookPulse>>;
  schema: {
    arLedger: boolean | null;
    paymentClaims: boolean | null;
    installments: boolean | null;
  };
  cipc: {
    paidNotBadged: number;
    slaBreaches: number;
    sample: Array<{ id: number; name: string | null; hours: number | null }>;
  };
  claims: { pending: number };
  invites24h: number;
  /** Activation / commercial funnel analytics (activity_log + soft counts) */
  analytics: {
    firstTradeBootstrap24h: number;
    firstTradeSent24h: number;
    claimsPending: number;
    claimsConfirmed24h: number;
    connectionAccepted24h: number;
    requestToTrade24h: number;
    ratingsPublished24h: number;
  };
  readiness: {
    ok: boolean;
    blockers: string[];
    warnings: string[];
  };
  /** Soft settle path health (tables + claim/ledger) */
  settleLive: {
    ok: boolean;
    claimsTable: boolean | null;
    ledgerTable: boolean | null;
    installmentsTable: boolean | null;
    smokePath: string;
  };
};

export async function loadOpsBoard(): Promise<OpsBoardSnapshot> {
  const deploy = deploymentMeta();
  const env = {
    paystackSecret: Boolean(
      process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET
    ),
    resend: Boolean(process.env.RESEND_API_KEY),
    cronSecret: Boolean(process.env.CRON_SECRET),
    opsAlertEmail: Boolean(
      process.env.OPS_ALERT_EMAIL || process.env.PAYSTACK_OPS_EMAIL
    ),
    verifynow: Boolean(process.env.VERIFYNOW_API_KEY),
  };

  let paystack = await loadPaystackWebhookPulse();
  const schema = {
    arLedger: null as boolean | null,
    paymentClaims: null as boolean | null,
    installments: null as boolean | null,
  };
  const cipc = {
    paidNotBadged: 0,
    slaBreaches: 0,
    sample: [] as Array<{ id: number; name: string | null; hours: number | null }>,
  };
  let claimsPending = 0;
  let invites24h = 0;
  const analytics = {
    firstTradeBootstrap24h: 0,
    firstTradeSent24h: 0,
    claimsPending: 0,
    claimsConfirmed24h: 0,
    connectionAccepted24h: 0,
    requestToTrade24h: 0,
    ratingsPublished24h: 0,
  };

  try {
    const supabase = getSupabaseServer();

    // Schema probes
    for (const [key, table] of [
      ['arLedger', 'customer_invoice_payments'],
      ['paymentClaims', 'customer_payment_claims'],
      ['installments', 'customer_invoice_installments'],
    ] as const) {
      const { error } = await supabase.from(table).select('id', { head: true, count: 'exact' }).limit(1);
      schema[key] = !error || !/relation|does not exist/i.test(error.message || '');
      if (error && /relation|does not exist/i.test(error.message || '')) {
        schema[key] = false;
      } else if (!error) {
        schema[key] = true;
      }
    }

    // Paid-not-badged sample
    const { data: rows } = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, verification_status, verification_payment_ref, metadata, updated_at'
      )
      .in('verification_status', ['pending', 'failed', 'mismatch', 'unverified'])
      .order('updated_at', { ascending: false })
      .limit(40);
    for (const p of rows || []) {
      const sla = buildVerificationSla(p as Record<string, unknown>);
      if (!sla.hasPayment) continue;
      if (sla.phase === 'verified') continue;
      cipc.paidNotBadged += 1;
      if (sla.slaBreached) {
        cipc.slaBreaches += 1;
        if (cipc.sample.length < 8) {
          cipc.sample.push({
            id: Number(p.id),
            name: (p.trading_name || p.legal_name || null) as string | null,
            hours: sla.hoursSincePaid,
          });
        }
      }
    }

    try {
      const { count } = await supabase
        .from('customer_payment_claims')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      claimsPending = count ?? 0;
    } catch {
      claimsPending = 0;
    }

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: invCount } = await supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .in('action', [
        'network.invite_sent',
        'directory.invite_sent',
        'directory.invite_resent',
      ])
      .gte('created_at', since);
    invites24h = invCount ?? 0;

    const countAction = async (actions: string[]) => {
      const { count } = await supabase
        .from('activity_log')
        .select('id', { count: 'exact', head: true })
        .in('action', actions)
        .gte('created_at', since);
      return count ?? 0;
    };
    analytics.firstTradeBootstrap24h = await countAction([
      'onboarding.first_trade_bootstrap',
    ]);
    analytics.firstTradeSent24h = await countAction([
      'onboarding.first_trade_sent',
    ]);
    analytics.claimsConfirmed24h = await countAction([
      'ar.payment_claim_confirmed',
    ]);
    analytics.connectionAccepted24h = await countAction([
      'network.connection_accepted',
      'network.accept',
    ]);
    analytics.requestToTrade24h = await countAction([
      'network.request_to_trade',
    ]);
    analytics.claimsPending = claimsPending;
    try {
      const { count } = await supabase
        .from('company_ratings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published')
        .gte('created_at', since);
      analytics.ratingsPublished24h = count ?? 0;
    } catch {
      analytics.ratingsPublished24h = 0;
    }
  } catch {
    /* soft */
  }

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!env.paystackSecret) blockers.push('PAYSTACK_SECRET_KEY missing');
  if (!env.cronSecret) blockers.push('CRON_SECRET missing');
  if (!env.resend) warnings.push('RESEND_API_KEY missing (emails soft-fail)');
  if (!env.opsAlertEmail) warnings.push('OPS_ALERT_EMAIL not set (SLA/webhook alerts)');
  if (!env.verifynow) warnings.push('VERIFYNOW_API_KEY missing (CIPC soft-fails)');
  if (schema.arLedger === false) blockers.push('Run 20260717_ar_ledger.sql');
  if (schema.paymentClaims === false)
    warnings.push('Run 20260717_payment_claims_and_ledger_fx.sql');
  if (schema.installments === false)
    warnings.push('Run 20260718_installments_collections.sql');
  if (paystack.stale && env.paystackSecret)
    warnings.push('Paystack webhook pulse stale');
  if (cipc.slaBreaches > 0)
    warnings.push(`${cipc.slaBreaches} CIPC SLA breach(es)`);

  const settleLive = {
    ok:
      schema.arLedger !== false &&
      schema.paymentClaims !== false,
    claimsTable: schema.paymentClaims,
    ledgerTable: schema.arLedger,
    installmentsTable: schema.installments,
    smokePath: '/api/system/settle-smoke',
  };
  if (!settleLive.ok) {
    warnings.push('Settle path incomplete — see settle-smoke');
  }

  return {
    at: new Date().toISOString(),
    deploy,
    env,
    paystack,
    schema,
    cipc,
    claims: { pending: claimsPending },
    invites24h,
    analytics,
    readiness: {
      ok: blockers.length === 0,
      blockers,
      warnings,
    },
    settleLive,
  };
}
