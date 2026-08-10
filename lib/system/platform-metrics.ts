/**
 * System + management reports for the SupplierAdvisor platform console.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { loadOpsBoard, type OpsBoardSnapshot } from '@/lib/system/ops-board';
import { deploymentMeta } from '@/lib/system/schema-probe';
import {
  PLATFORM_COMPANY_TRADING_NAME,
  PLATFORM_OWNER_EMAILS,
  findPlatformCompany,
  type PlatformCompanyRow,
} from '@/lib/system/platform-company';

export type SystemReport = {
  at: string;
  company: {
    id: number | null;
    trading_name: string;
    owners: readonly string[];
  };
  deploy: ReturnType<typeof deploymentMeta>;
  health: {
    ok: boolean;
    score: number;
    blockers: string[];
    warnings: string[];
  };
  integrations: {
    paystackSecret: boolean;
    paystackPublic: boolean;
    resend: boolean;
    cronSecret: boolean;
    verifynow: boolean;
    xai: boolean;
    opsAlertEmail: boolean;
    twilio: boolean;
    privy: boolean;
  };
  paystack: OpsBoardSnapshot['paystack'];
  schema: OpsBoardSnapshot['schema'];
  settleLive: OpsBoardSnapshot['settleLive'];
  cipc: OpsBoardSnapshot['cipc'];
  tables: Array<{
    name: string;
    ok: boolean;
    count: number | null;
    error?: string;
  }>;
};

export type ManagementReport = {
  at: string;
  companies: {
    total: number;
    discoverable: number;
    withActiveMembers: number;
    new7d: number;
    new30d: number;
    bySubscription: Record<string, number>;
    byVerification: Record<string, number>;
  };
  people: {
    activeMemberships: number;
    distinctUsers: number;
    owners: number;
    invitesPending: number;
  };
  network: {
    connectionsActive: number;
    connectionsPending: number;
    invites24h: number;
    marketplaceListings: number | null;
  };
  commercial: {
    trial: number;
    activePaid: number;
    lifetime: number;
    pastDueOrCancelled: number;
    foundingWaitlist: number | null;
  };
  trade: {
    activity24h: number;
    firstTrade24h: number;
    claimsPending: number;
    claimsConfirmed24h: number;
    ratingsPublished24h: number;
    posOpen: number | null;
  };
  modules: {
    schoolsEnabled: number;
    healthEnabled: number;
    fieldgraphEnabled: number;
    quarrygraphEnabled: number;
    fitgraphEnabled: number;
    physiographEnabled: number;
    dentalgraphEnabled: number;
  };
  recentCompanies: Array<{
    id: number;
    trading_name: string | null;
    subscription_status: string | null;
    verification_status: string | null;
    created_at: string | null;
    city: string | null;
    country: string | null;
  }>;
  opsAnalytics: OpsBoardSnapshot['analytics'];
};

export type PlatformConsolePayload = {
  company: PlatformCompanyRow | null;
  system: SystemReport;
  management: ManagementReport;
  ops: OpsBoardSnapshot;
};

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
}

async function tableProbe(
  supabase: ReturnType<typeof getSupabaseServer>,
  name: string
): Promise<{ name: string; ok: boolean; count: number | null; error?: string }> {
  try {
    const { count, error } = await supabase
      .from(name)
      .select('id', { count: 'exact', head: true });
    if (error) {
      const missing = /relation|does not exist/i.test(error.message || '');
      return {
        name,
        ok: !missing,
        count: missing ? null : 0,
        error: error.message,
      };
    }
    return { name, ok: true, count: count ?? 0 };
  } catch (e: unknown) {
    return {
      name,
      ok: false,
      count: null,
      error: e instanceof Error ? e.message : 'probe failed',
    };
  }
}

function bump(map: Record<string, number>, key: string | null | undefined) {
  const k = String(key || 'unknown').toLowerCase() || 'unknown';
  map[k] = (map[k] || 0) + 1;
}

export async function loadPlatformConsoleReports(): Promise<PlatformConsolePayload> {
  const supabase = getSupabaseServer();
  const ops = await loadOpsBoard();
  const company = await findPlatformCompany(supabase);
  const deploy = deploymentMeta();

  const integrations = {
    paystackSecret: Boolean(
      process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET
    ),
    paystackPublic: Boolean(process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY),
    resend: Boolean(process.env.RESEND_API_KEY),
    cronSecret: Boolean(process.env.CRON_SECRET),
    verifynow: Boolean(process.env.VERIFYNOW_API_KEY),
    xai: Boolean(process.env.XAI_API_KEY),
    opsAlertEmail: Boolean(
      process.env.OPS_ALERT_EMAIL ||
        process.env.OPS_EMAIL_ALERT ||
        process.env.PAYSTACK_OPS_EMAIL
    ),
    twilio: Boolean(
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ),
    privy: Boolean(
      process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID
    ),
  };

  const tables = await Promise.all([
    tableProbe(supabase, 'profiles'),
    tableProbe(supabase, 'business_users'),
    tableProbe(supabase, 'activity_log'),
    tableProbe(supabase, 'customer_payment_claims'),
    tableProbe(supabase, 'customer_invoice_payments'),
    tableProbe(supabase, 'company_ratings'),
    tableProbe(supabase, 'network_connections'),
    tableProbe(supabase, 'nsnp_agency_profiles'),
  ]);

  const system: SystemReport = {
    at: new Date().toISOString(),
    company: {
      id: company?.id ?? null,
      trading_name: company?.trading_name || PLATFORM_COMPANY_TRADING_NAME,
      owners: PLATFORM_OWNER_EMAILS,
    },
    deploy,
    health: {
      ok: ops.readiness.ok,
      score: Math.max(
        0,
        100 -
          ops.readiness.blockers.length * 25 -
          Math.min(40, ops.readiness.warnings.length * 8)
      ),
      blockers: ops.readiness.blockers,
      warnings: ops.readiness.warnings,
    },
    integrations,
    paystack: ops.paystack,
    schema: ops.schema,
    settleLive: ops.settleLive,
    cipc: ops.cipc,
    tables,
  };

  // ── Management aggregates ──────────────────────────────────────────────
  const bySubscription: Record<string, number> = {};
  const byVerification: Record<string, number> = {};
  let total = 0;
  let discoverable = 0;
  let new7d = 0;
  let new30d = 0;
  let trial = 0;
  let activePaid = 0;
  let lifetime = 0;
  let pastDueOrCancelled = 0;
  let schoolsEnabled = 0;
  let healthEnabled = 0;
  let fieldgraphEnabled = 0;
  let quarrygraphEnabled = 0;
  let fitgraphEnabled = 0;
  let physiographEnabled = 0;
  let dentalgraphEnabled = 0;

  const since7 = daysAgoIso(7);
  const since30 = daysAgoIso(30);

  const recentCompanies: ManagementReport['recentCompanies'] = [];

  try {
    const { data: profiles, count } = await supabase
      .from('profiles')
      .select(
        'id, trading_name, subscription_status, verification_status, is_discoverable, created_at, city, country, metadata',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .limit(2000);

    total = count ?? profiles?.length ?? 0;

    for (const p of profiles || []) {
      bump(bySubscription, p.subscription_status as string | null);
      bump(byVerification, p.verification_status as string | null);
      if (p.is_discoverable) discoverable += 1;
      const created = p.created_at ? String(p.created_at) : '';
      if (created && created >= since7) new7d += 1;
      if (created && created >= since30) new30d += 1;

      const sub = String(p.subscription_status || '').toLowerCase();
      if (sub === 'trial' || sub === 'trialing') trial += 1;
      else if (sub === 'lifetime' || sub.includes('lifetime')) lifetime += 1;
      else if (sub === 'active' || sub === 'paid') activePaid += 1;
      else if (
        sub === 'cancelled' ||
        sub === 'canceled' ||
        sub === 'past_due' ||
        sub === 'expired'
      ) {
        pastDueOrCancelled += 1;
      }

      const meta =
        p.metadata && typeof p.metadata === 'object' && !Array.isArray(p.metadata)
          ? (p.metadata as Record<string, unknown>)
          : {};
      const em =
        meta.enabled_modules &&
        typeof meta.enabled_modules === 'object' &&
        !Array.isArray(meta.enabled_modules)
          ? (meta.enabled_modules as Record<string, boolean>)
          : null;
      if (em?.schools === true) schoolsEnabled += 1;
      if (em?.health === true) healthEnabled += 1;
      if (em?.fieldgraph === true) fieldgraphEnabled += 1;
      if (em?.quarrygraph === true) quarrygraphEnabled += 1;
      if (em?.fitgraph === true) fitgraphEnabled += 1;
      if (em?.physiograph === true) physiographEnabled += 1;
      if (em?.dentalgraph === true) dentalgraphEnabled += 1;

      if (recentCompanies.length < 12) {
        recentCompanies.push({
          id: Number(p.id),
          trading_name: p.trading_name as string | null,
          subscription_status: p.subscription_status as string | null,
          verification_status: p.verification_status as string | null,
          created_at: p.created_at as string | null,
          city: p.city as string | null,
          country: p.country as string | null,
        });
      }
    }
  } catch {
    /* soft */
  }

  let withActiveMembers = 0;
  let activeMemberships = 0;
  let distinctUsers = 0;
  let owners = 0;
  let invitesPending = 0;

  try {
    const { data: members, count } = await supabase
      .from('business_users')
      .select('user_id, profile_id, role, status', { count: 'exact' })
      .eq('status', 'active')
      .limit(5000);
    activeMemberships = count ?? members?.length ?? 0;
    const users = new Set<string>();
    const companies = new Set<number>();
    for (const m of members || []) {
      if (m.user_id) users.add(String(m.user_id));
      if (m.profile_id != null) companies.add(Number(m.profile_id));
      if (m.role === 'owner') owners += 1;
    }
    distinctUsers = users.size;
    withActiveMembers = companies.size;

    const { count: pending } = await supabase
      .from('business_users')
      .select('id', { count: 'exact', head: true })
      .in('status', ['invited', 'pending']);
    invitesPending = pending ?? 0;
  } catch {
    /* soft */
  }

  let connectionsActive = 0;
  let connectionsPending = 0;
  let marketplaceListings: number | null = null;
  try {
    const { count: ca } = await supabase
      .from('network_connections')
      .select('id', { count: 'exact', head: true })
      .in('status', ['accepted', 'active', 'connected']);
    connectionsActive = ca ?? 0;
  } catch {
    try {
      const { count: ca } = await supabase
        .from('company_connections')
        .select('id', { count: 'exact', head: true })
        .in('status', ['accepted', 'active', 'connected']);
      connectionsActive = ca ?? 0;
    } catch {
      connectionsActive = 0;
    }
  }
  try {
    const { count: cp } = await supabase
      .from('network_connections')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'requested']);
    connectionsPending = cp ?? 0;
  } catch {
    connectionsPending = 0;
  }
  try {
    const { count: ml } = await supabase
      .from('marketplace_listings')
      .select('id', { count: 'exact', head: true });
    marketplaceListings = ml ?? 0;
  } catch {
    marketplaceListings = null;
  }

  let activity24h = 0;
  try {
    const { count } = await supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', daysAgoIso(1));
    activity24h = count ?? 0;
  } catch {
    activity24h = 0;
  }

  let posOpen: number | null = null;
  try {
    const { count } = await supabase
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'sent', 'accepted', 'partial', 'draft']);
    posOpen = count ?? 0;
  } catch {
    posOpen = null;
  }

  let foundingWaitlist: number | null = null;
  try {
    const { count } = await supabase
      .from('founding_waitlist')
      .select('id', { count: 'exact', head: true });
    foundingWaitlist = count ?? 0;
  } catch {
    foundingWaitlist = null;
  }

  const management: ManagementReport = {
    at: new Date().toISOString(),
    companies: {
      total,
      discoverable,
      withActiveMembers,
      new7d,
      new30d,
      bySubscription,
      byVerification,
    },
    people: {
      activeMemberships,
      distinctUsers,
      owners,
      invitesPending,
    },
    network: {
      connectionsActive,
      connectionsPending,
      invites24h: ops.invites24h,
      marketplaceListings,
    },
    commercial: {
      trial,
      activePaid,
      lifetime,
      pastDueOrCancelled,
      foundingWaitlist,
    },
    trade: {
      activity24h,
      firstTrade24h: ops.analytics.firstTradeSent24h,
      claimsPending: ops.claims.pending,
      claimsConfirmed24h: ops.analytics.claimsConfirmed24h,
      ratingsPublished24h: ops.analytics.ratingsPublished24h,
      posOpen,
    },
    modules: {
      schoolsEnabled,
      healthEnabled,
      fieldgraphEnabled,
      quarrygraphEnabled,
      fitgraphEnabled,
      physiographEnabled,
      dentalgraphEnabled,
    },
    recentCompanies,
    opsAnalytics: ops.analytics,
  };

  return { company, system, management, ops };
}
