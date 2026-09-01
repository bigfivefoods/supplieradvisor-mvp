import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';

export { assertCompanyMember };

export type SupplierConnection = {
  id: number;
  requester_profile_id: number;
  requestee_profile_id: number;
  status: string | null;
  connection_type: string | null;
  metadata: Record<string, unknown> | null;
  suspended: boolean;
};

/**
 * Accepted supplier-type connection.
 * Convention: buyer = requester, supplier = requestee, connection_type = 'supplier'.
 * (Mirrors customer edges where seller=requester, buyer=requestee.)
 */
export async function assertSupplierConnection(
  buyerCompanyId: number,
  supplierCompanyId: number,
  opts?: { allowSuspended?: boolean }
): Promise<
  | { ok: true; connection: SupplierConnection }
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
    .eq('requester_profile_id', buyerCompanyId)
    .eq('requestee_profile_id', supplierCompanyId)
    .eq('connection_type', 'supplier')
    .eq('status', 'accepted')
    .maybeSingle();

  if (error) {
    console.error('assertSupplierConnection query error:', error);
    return { ok: false, error: 'Failed to verify supplier connection', status: 500 };
  }

  if (!data) {
    return {
      ok: false,
      error: 'No accepted supplier connection between these companies',
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

export function isSupplierInvitesEnabled(): boolean {
  const raw = process.env.SUPPLIER_INVITES_ENABLED;
  if (raw === undefined || raw === '') return true;
  return !['0', 'false', 'no', 'off'].includes(String(raw).toLowerCase().trim());
}

export const SUPPLIER_INVITE_LIMITS = {
  maxPendingPerCompany: 30,
  maxPerSupplierPer24h: 5,
  maxPerCompanyPerHour: 40,
} as const;

export const SUPPLIER_INVITATION_LIST_COLUMNS =
  'id, profile_id, supplier_id, email, full_name, company_name, message, status, target_profile_id, invited_by, expires_at, accepted_at, created_at, updated_at';

export async function checkSupplierInviteRateLimits(opts: {
  companyId: number;
  supplierId?: number | null;
  replacingSupplierPending?: boolean;
}): Promise<
  | { ok: true }
  | { ok: false; error: string; status: 429 | 500 }
> {
  const supabase = getSupabaseServer();
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const pendingCompany = await supabase
    .from('supplier_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', opts.companyId)
    .eq('status', 'pending');

  const createdCompany1h = await supabase
    .from('supplier_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', opts.companyId)
    .gte('created_at', hourAgo);

  if (pendingCompany.error || createdCompany1h.error) {
    return { ok: false, error: 'Failed to enforce invite rate limits', status: 500 };
  }
  if (pendingCompany.count == null || createdCompany1h.count == null) {
    return { ok: false, error: 'Failed to enforce invite rate limits', status: 500 };
  }

  let pending = pendingCompany.count;
  if (opts.replacingSupplierPending && opts.supplierId) {
    const pendingSupplier = await supabase
      .from('supplier_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', opts.supplierId)
      .eq('status', 'pending');
    if (!pendingSupplier.error && pendingSupplier.count != null) {
      pending = Math.max(0, pending - pendingSupplier.count);
    }
  }

  if ((createdCompany1h.count as number) >= SUPPLIER_INVITE_LIMITS.maxPerCompanyPerHour) {
    return {
      ok: false,
      error: `Rate limit: at most ${SUPPLIER_INVITE_LIMITS.maxPerCompanyPerHour} supplier invites per company per hour.`,
      status: 429,
    };
  }

  if (opts.supplierId) {
    const perSupplier24h = await supabase
      .from('supplier_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', opts.supplierId)
      .gte('created_at', dayAgo);
    if (perSupplier24h.error || perSupplier24h.count == null) {
      return { ok: false, error: 'Failed to enforce invite rate limits', status: 500 };
    }
    if (perSupplier24h.count >= SUPPLIER_INVITE_LIMITS.maxPerSupplierPer24h) {
      return {
        ok: false,
        error: `Rate limit: at most ${SUPPLIER_INVITE_LIMITS.maxPerSupplierPer24h} invites per supplier per 24h.`,
        status: 429,
      };
    }
  }

  if (pending + 1 > SUPPLIER_INVITE_LIMITS.maxPendingPerCompany) {
    return {
      ok: false,
      error: `Rate limit: at most ${SUPPLIER_INVITE_LIMITS.maxPendingPerCompany} pending supplier invites. Revoke some first.`,
      status: 429,
    };
  }

  return { ok: true };
}

/**
 * UPSERT accepted supplier edge: buyer=requester, supplier=requestee.
 */
export async function upsertSupplierConnection(opts: {
  buyerProfileId: number;
  supplierProfileId: number;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true; connectionId: number } | { ok: false; error: string }> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const payload = {
    requester_profile_id: opts.buyerProfileId,
    requestee_profile_id: opts.supplierProfileId,
    connection_type: 'supplier',
    status: 'accepted',
    notes: opts.notes || 'Supplier SRM connection',
    metadata: opts.metadata || {},
    responded_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('business_connections')
    .upsert(payload, {
      onConflict: 'requester_profile_id,requestee_profile_id',
    })
    .select('id')
    .single();

  if (error) {
    // Fallback: try update existing any-type edge
    const { data: existing } = await supabase
      .from('business_connections')
      .select('id')
      .eq('requester_profile_id', opts.buyerProfileId)
      .eq('requestee_profile_id', opts.supplierProfileId)
      .maybeSingle();
    if (existing?.id) {
      const { data: updated, error: upErr } = await supabase
        .from('business_connections')
        .update({
          connection_type: 'supplier',
          status: 'accepted',
          notes: payload.notes,
          metadata: payload.metadata,
          responded_at: now,
          updated_at: now,
        })
        .eq('id', existing.id)
        .select('id')
        .single();
      if (upErr) return { ok: false, error: upErr.message };
      return { ok: true, connectionId: Number(updated!.id) };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, connectionId: Number(data.id) };
}
