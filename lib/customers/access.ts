import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';

/**
 * Active business_users membership for a Privy user + company profile.
 * Matches user_id variants (did:privy / privy / bare) like me/companies.
 */
export async function assertCompanyMember(
  privyUserId: string | null | undefined,
  companyId: number
): Promise<{ ok: true; userId: string } | { ok: false; error: string; status: number }> {
  const userId = getCanonicalUserId(privyUserId);
  if (!userId) {
    return { ok: false, error: 'Authentication required (privyUserId)', status: 401 };
  }
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return { ok: false, error: 'Valid companyId is required', status: 400 };
  }

  const supabase = getSupabaseServer();
  const variants = userIdMatchVariants(userId);

  const { data, error } = await supabase
    .from('business_users')
    .select('id, user_id, profile_id, status')
    .eq('profile_id', companyId)
    .eq('status', 'active')
    .in('user_id', variants)
    .limit(1);

  if (error) {
    console.error('assertCompanyMember query error:', error);
    return { ok: false, error: 'Failed to verify company membership', status: 500 };
  }

  if (!data || data.length === 0) {
    return { ok: false, error: 'You are not an active member of this company', status: 403 };
  }

  return { ok: true, userId };
}

export type CustomerConnection = {
  id: number;
  requester_profile_id: number;
  requestee_profile_id: number;
  status: string | null;
  connection_type: string | null;
  metadata: Record<string, unknown> | null;
  suspended: boolean;
};

/**
 * Accepted customer-type connection; seller is requester, buyer is requestee.
 * @param opts.allowSuspended default false — true for list / historical doc read;
 *   false for new PO create and other "new collaboration" actions.
 */
export async function assertCustomerConnection(
  buyerCompanyId: number,
  supplierCompanyId: number,
  opts?: { allowSuspended?: boolean }
): Promise<
  | { ok: true; connection: CustomerConnection }
  | { ok: false; error: string; status: number }
> {
  if (!Number.isFinite(buyerCompanyId) || !Number.isFinite(supplierCompanyId)) {
    return { ok: false, error: 'buyerCompanyId and supplierCompanyId are required', status: 400 };
  }

  const allowSuspended = opts?.allowSuspended === true;
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from('business_connections')
    .select('id, requester_profile_id, requestee_profile_id, status, connection_type, metadata')
    .eq('requester_profile_id', supplierCompanyId)
    .eq('requestee_profile_id', buyerCompanyId)
    .eq('connection_type', 'customer')
    .eq('status', 'accepted')
    .maybeSingle();

  if (error) {
    console.error('assertCustomerConnection query error:', error);
    return { ok: false, error: 'Failed to verify customer connection', status: 500 };
  }

  if (!data) {
    return {
      ok: false,
      error: 'No accepted customer connection between these companies',
      status: 403,
    };
  }

  const meta =
    data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : {};
  const suspended = meta.suspended === true || meta.suspended === 'true';

  if (suspended && !allowSuspended) {
    return {
      ok: false,
      error: 'Connection is suspended — new collaboration is blocked',
      status: 403,
    };
  }

  return {
    ok: true,
    connection: {
      id: Number(data.id),
      requester_profile_id: Number(data.requester_profile_id),
      requestee_profile_id: Number(data.requestee_profile_id),
      status: data.status,
      connection_type: data.connection_type,
      metadata: meta,
      suspended,
    },
  };
}

/**
 * Seller side: ensure customer row belongs to seller and is not suspended
 * (invite_status or BC metadata). Used by share PATCH.
 */
export async function assertSellerCustomerNotSuspended(
  sellerCompanyId: number,
  customerId: number
): Promise<{ ok: true } | { ok: false; error: string; status: 409 | 404 | 500 }> {
  if (!Number.isFinite(sellerCompanyId) || !Number.isFinite(customerId)) {
    return { ok: false, error: 'sellerCompanyId and customerId are required', status: 404 };
  }

  const supabase = getSupabaseServer();
  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, profile_id, invite_status, connection_id, linked_profile_id')
    .eq('id', customerId)
    .eq('profile_id', sellerCompanyId)
    .maybeSingle();

  if (error) {
    console.error('assertSellerCustomerNotSuspended customer error:', error);
    return { ok: false, error: 'Failed to load customer', status: 500 };
  }
  if (!customer) {
    return { ok: false, error: 'Customer not found for this company', status: 404 };
  }

  if (customer.invite_status === 'suspended') {
    return {
      ok: false,
      error: 'Connection suspended — cannot share new documents. Unsuspend first.',
      status: 409,
    };
  }

  if (customer.connection_id) {
    const { data: conn } = await supabase
      .from('business_connections')
      .select('id, metadata, status')
      .eq('id', customer.connection_id)
      .maybeSingle();

    const meta =
      conn?.metadata && typeof conn.metadata === 'object' && !Array.isArray(conn.metadata)
        ? (conn.metadata as Record<string, unknown>)
        : {};
    if (meta.suspended === true || meta.suspended === 'true') {
      return {
        ok: false,
        error: 'Connection suspended — cannot share new documents. Unsuspend first.',
        status: 409,
      };
    }
  } else if (customer.linked_profile_id) {
    const { data: conn } = await supabase
      .from('business_connections')
      .select('id, metadata, status')
      .eq('requester_profile_id', sellerCompanyId)
      .eq('requestee_profile_id', customer.linked_profile_id)
      .eq('connection_type', 'customer')
      .eq('status', 'accepted')
      .maybeSingle();

    const meta =
      conn?.metadata && typeof conn.metadata === 'object' && !Array.isArray(conn.metadata)
        ? (conn.metadata as Record<string, unknown>)
        : {};
    if (meta.suspended === true || meta.suspended === 'true') {
      return {
        ok: false,
        error: 'Connection suspended — cannot share new documents. Unsuspend first.',
        status: 409,
      };
    }
  }

  return { ok: true };
}

/**
 * Insert into activity_log. Soft-fails (console only) so primary requests never fail.
 */
export async function logActivity(entry: {
  profile_id: number;
  actor_user_id?: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('activity_log').insert({
      profile_id: entry.profile_id,
      actor_user_id: entry.actor_user_id ?? null,
      action: entry.action,
      entity_type: entry.entity_type ?? null,
      entity_id: entry.entity_id ?? null,
      summary: entry.summary,
      metadata: entry.metadata ?? {},
      created_at: new Date().toISOString(),
    });
    if (error) {
      console.error('logActivity insert failed:', error.message, entry.action);
    }
  } catch (err) {
    console.error('logActivity soft-fail:', err);
  }
}

/** Feature flag: CUSTOMER_INVITES_ENABLED (default true when unset). */
export function isCustomerInvitesEnabled(): boolean {
  const raw = process.env.CUSTOMER_INVITES_ENABLED;
  if (raw === undefined || raw === '') return true;
  return !['0', 'false', 'no', 'off'].includes(String(raw).toLowerCase().trim());
}

/** SQL-backed invite rate limits (not in-memory — multi-instance safe). */
export const CUSTOMER_INVITE_LIMITS = {
  /** Max pending invitations per seller company */
  maxPendingPerCompany: 20,
  /** Max pending invitations per customer CRM row */
  maxPendingPerCustomer: 3,
  /** Max invitation rows created per customer in a rolling 24h window (incl. resends) */
  maxPerCustomerPer24h: 5,
  /** Max invitation rows created per company in a rolling 1h window */
  maxPerCompanyPerHour: 30,
  /** Max invitation rows created per company in a rolling 24h window */
  maxPerCompanyPerDay: 20,
} as const;

/**
 * Enforce invite rate limits via SQL counts on customer_invitations.
 * Returns 429 payload when over limit. Not in-memory (multi-instance safe).
 *
 * @param opts.replacingCustomerPending — when true, caller will revoke this
 *   customer's pending rows before insert; pending-per-customer is treated as
 *   0 for that customer, and pending-per-company is reduced by that count.
 */
export async function checkCustomerInviteRateLimits(opts: {
  companyId: number;
  customerId: number;
  replacingCustomerPending?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string; status: 429; retryAfterSeconds?: number }> {
  const supabase = getSupabaseServer();
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [pendingCompany, pendingCustomer, createdCustomer24h, createdCompany1h, createdCompany24h] =
    await Promise.all([
      supabase
        .from('customer_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', opts.companyId)
        .eq('status', 'pending'),
      supabase
        .from('customer_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', opts.customerId)
        .eq('status', 'pending'),
      supabase
        .from('customer_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', opts.customerId)
        .gte('created_at', dayAgo),
      supabase
        .from('customer_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', opts.companyId)
        .gte('created_at', hourAgo),
      supabase
        .from('customer_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', opts.companyId)
        .gte('created_at', dayAgo),
    ]);

  const pendingCustomerCount = pendingCustomer.count ?? 0;
  let pendingCompanyCount = pendingCompany.count ?? 0;
  if (opts.replacingCustomerPending) {
    // After revoke of this customer's pending, company pending drops by that amount
    pendingCompanyCount = Math.max(0, pendingCompanyCount - pendingCustomerCount);
  }
  const effectivePendingCustomer = opts.replacingCustomerPending ? 0 : pendingCustomerCount;
  const customer24hCount = createdCustomer24h.count ?? 0;
  const company1hCount = createdCompany1h.count ?? 0;
  const company24hCount = createdCompany24h.count ?? 0;

  // Time-window limits first (do not require revoke)
  if (customer24hCount >= CUSTOMER_INVITE_LIMITS.maxPerCustomerPer24h) {
    return {
      ok: false,
      error: `Rate limit: at most ${CUSTOMER_INVITE_LIMITS.maxPerCustomerPer24h} invites/resends per customer per 24 hours.`,
      status: 429,
      retryAfterSeconds: 3600,
    };
  }

  if (company1hCount >= CUSTOMER_INVITE_LIMITS.maxPerCompanyPerHour) {
    return {
      ok: false,
      error: `Rate limit: at most ${CUSTOMER_INVITE_LIMITS.maxPerCompanyPerHour} invitations per company per hour.`,
      status: 429,
      retryAfterSeconds: 3600,
    };
  }

  if (company24hCount >= CUSTOMER_INVITE_LIMITS.maxPerCompanyPerDay) {
    return {
      ok: false,
      error: `Rate limit: at most ${CUSTOMER_INVITE_LIMITS.maxPerCompanyPerDay} invitations per company per day.`,
      status: 429,
      retryAfterSeconds: 3600,
    };
  }

  // After this send we will have +1 pending for company and customer
  if (pendingCompanyCount + 1 > CUSTOMER_INVITE_LIMITS.maxPendingPerCompany) {
    return {
      ok: false,
      error: `Rate limit: at most ${CUSTOMER_INVITE_LIMITS.maxPendingPerCompany} pending invitations per company. Revoke some before sending more.`,
      status: 429,
    };
  }

  if (effectivePendingCustomer + 1 > CUSTOMER_INVITE_LIMITS.maxPendingPerCustomer) {
    return {
      ok: false,
      error: `Rate limit: at most ${CUSTOMER_INVITE_LIMITS.maxPendingPerCustomer} pending invitations for this customer. Revoke or wait for accept/expire.`,
      status: 429,
    };
  }

  return { ok: true };
}
