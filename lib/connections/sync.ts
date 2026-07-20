/**
 * Network book sync — keeps SRM (suppliers) and CRM (customers) aligned
 * with accepted business_connections edges so companies can trade both ways.
 *
 * Conventions:
 *  - supplier edge: requester=buyer, requestee=supplier
 *  - customer edge: requester=seller, requestee=buyer
 *  - partner edge: mutual; both sides get supplier + customer book entries
 */

import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';

export type ProfileLite = {
  id: number;
  trading_name?: string | null;
  legal_name?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_phone?: string | null;
  contact_name?: string | null;
  industry?: string | null;
  sub_industry?: string | null;
  city?: string | null;
  country?: string | null;
  province?: string | null;
  continent?: string | null;
  website?: string | null;
  certifications?: string[] | null;
  wallet_address?: string | null;
  bee_level?: string | null;
  verification_status?: string | null;
  is_verified?: boolean | null;
  trust_score?: number | null;
  otifef_average?: number | null;
};

/** Production-safe columns (no phone / is_verified — those do not exist on profiles). */
const PROFILE_LITE_SELECT =
  'id, trading_name, legal_name, email, contact_phone, contact_name, industry, sub_industry, city, country, province, continent, website, certifications, wallet_address, bee_level, verification_status, trust_score, otifef_average';

const PROFILE_LITE_MINIMAL =
  'id, trading_name, legal_name, email, contact_phone, contact_name, industry, city, country, website, wallet_address, verification_status, trust_score';

export async function loadProfileLite(
  profileId: number
): Promise<ProfileLite | null> {
  const supabase = getSupabaseServer();
  for (const select of [PROFILE_LITE_SELECT, PROFILE_LITE_MINIMAL]) {
    const { data, error } = await supabase
      .from('profiles')
      .select(select)
      .eq('id', profileId)
      .maybeSingle();
    if (!error && data) {
      const row = data as unknown as ProfileLite;
      row.phone = row.contact_phone || null;
      row.is_verified =
        String(row.verification_status || '').toLowerCase() === 'verified';
      return row;
    }
  }
  return null;
}

/**
 * True when the same Privy user is an active member of both companies.
 * Enables auto-accept for multi-company owners (core ERP use case).
 */
export async function userOwnsBothCompanies(
  privyUserId: string | null | undefined,
  companyA: number,
  companyB: number
): Promise<boolean> {
  const userId = getCanonicalUserId(privyUserId);
  if (!userId || !Number.isFinite(companyA) || !Number.isFinite(companyB)) {
    return false;
  }
  if (companyA === companyB) return false;

  const supabase = getSupabaseServer();
  const variants = userIdMatchVariants(userId);

  const { data } = await supabase
    .from('business_users')
    .select('profile_id')
    .in('user_id', variants)
    .eq('status', 'active')
    .in('profile_id', [companyA, companyB]);

  if (!data || data.length < 2) return false;
  const ids = new Set(data.map((r) => Number(r.profile_id)));
  return ids.has(companyA) && ids.has(companyB);
}

/** Ensure buyer's SRM book has a linked supplier row. */
export async function ensureSrmBookEntry(opts: {
  buyerProfileId: number;
  supplierProfileId: number;
  connectionId?: number | null;
  inviteStatus?: string;
  userId?: string | null;
  peer?: ProfileLite | null;
}): Promise<number | null> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const inviteStatus = opts.inviteStatus || 'accepted';

  // 1) Prefer existing hard-link to this platform company
  const { data: byLink } = await supabase
    .from('srm_suppliers')
    .select('id')
    .eq('profile_id', opts.buyerProfileId)
    .eq('linked_profile_id', opts.supplierProfileId)
    .maybeSingle();

  if (byLink?.id) {
    await supabase
      .from('srm_suppliers')
      .update({
        connection_id: opts.connectionId ?? undefined,
        invite_status: inviteStatus,
        invite_accepted_at: inviteStatus === 'accepted' ? now : undefined,
        status: inviteStatus === 'accepted' ? 'active' : undefined,
        linked_profile_id: opts.supplierProfileId,
        updated_at: now,
      })
      .eq('id', byLink.id);
    return Number(byLink.id);
  }

  const peer =
    opts.peer || (await loadProfileLite(opts.supplierProfileId));
  if (!peer) return null;

  // 2) Reuse offline / invited SRM row with same email (avoid re-adding)
  const email = peer.email ? String(peer.email).trim().toLowerCase() : '';
  if (email) {
    const { data: emailRows } = await supabase
      .from('srm_suppliers')
      .select('id, linked_profile_id, email')
      .eq('profile_id', opts.buyerProfileId)
      .ilike('email', email)
      .limit(5);
    const byEmail = (emailRows || []).find((r) => {
      const linked = r.linked_profile_id != null ? Number(r.linked_profile_id) : null;
      return linked == null || linked === opts.supplierProfileId;
    });
    if (byEmail?.id) {
      await supabase
        .from('srm_suppliers')
        .update({
          connection_id: opts.connectionId ?? undefined,
          invite_status: inviteStatus,
          invite_accepted_at: inviteStatus === 'accepted' ? now : null,
          status: inviteStatus === 'accepted' ? 'active' : 'prospect',
          linked_profile_id: opts.supplierProfileId,
          trading_name: peer.trading_name || undefined,
          legal_name: peer.legal_name || peer.trading_name || undefined,
          contact_name: peer.contact_name || undefined,
          city: peer.city || undefined,
          country: peer.country || undefined,
          industry: peer.industry || undefined,
          updated_at: now,
        })
        .eq('id', byEmail.id);
      return Number(byEmail.id);
    }
  }

  const verified =
    peer.is_verified === true ||
    String(peer.verification_status || '').toLowerCase() === 'verified';

  // 3) Insert once
  const { data: created, error } = await supabase
    .from('srm_suppliers')
    .insert({
      profile_id: opts.buyerProfileId,
      trading_name: peer.trading_name || 'Supplier',
      legal_name: peer.legal_name || peer.trading_name,
      email: peer.email,
      phone: peer.contact_phone || peer.phone || null,
      contact_name: peer.contact_name,
      industry: peer.industry,
      sub_industry: peer.sub_industry,
      city: peer.city,
      country: peer.country,
      province: peer.province,
      continent: peer.continent,
      website: peer.website,
      certifications: peer.certifications || [],
      wallet_address: peer.wallet_address,
      bee_level: peer.bee_level,
      verified,
      trust_score: peer.trust_score || 0,
      otifef_pct: peer.otifef_average || 0,
      linked_profile_id: opts.supplierProfileId,
      connection_id: opts.connectionId || null,
      invite_status: inviteStatus,
      invite_accepted_at: inviteStatus === 'accepted' ? now : null,
      status: inviteStatus === 'accepted' ? 'active' : 'prospect',
      created_by: opts.userId || null,
      updated_at: now,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('ensureSrmBookEntry insert:', error.message);
    return null;
  }
  return created?.id ? Number(created.id) : null;
}

/** Ensure seller's CRM book has a linked customer row. */
export async function ensureCrmBookEntry(opts: {
  sellerProfileId: number;
  buyerProfileId: number;
  connectionId?: number | null;
  inviteStatus?: string;
  peer?: ProfileLite | null;
}): Promise<number | null> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const inviteStatus = opts.inviteStatus || 'accepted';

  // 1) Prefer existing hard-link to this platform company (no duplicate)
  const { data: byLink } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', opts.sellerProfileId)
    .eq('linked_profile_id', opts.buyerProfileId)
    .maybeSingle();

  if (byLink?.id) {
    await supabase
      .from('customers')
      .update({
        connection_id: opts.connectionId ?? undefined,
        invite_status: inviteStatus,
        status: inviteStatus === 'accepted' ? 'active' : undefined,
        linked_profile_id: opts.buyerProfileId,
        updated_at: now,
      })
      .eq('id', byLink.id);
    return Number(byLink.id);
  }

  const peer = opts.peer || (await loadProfileLite(opts.buyerProfileId));
  if (!peer) return null;

  // 2) Reuse offline / invited CRM row with same email (avoid re-adding)
  const email = peer.email ? String(peer.email).trim().toLowerCase() : '';
  if (email) {
    const { data: emailRows } = await supabase
      .from('customers')
      .select('id, linked_profile_id, email')
      .eq('profile_id', opts.sellerProfileId)
      .ilike('email', email)
      .limit(5);
    const byEmail = (emailRows || []).find((r) => {
      const linked = r.linked_profile_id != null ? Number(r.linked_profile_id) : null;
      return linked == null || linked === opts.buyerProfileId;
    });
    if (byEmail?.id) {
      await supabase
        .from('customers')
        .update({
          connection_id: opts.connectionId ?? undefined,
          invite_status: inviteStatus,
          status: inviteStatus === 'accepted' ? 'active' : 'prospect',
          linked_profile_id: opts.buyerProfileId,
          trading_name: peer.trading_name || undefined,
          legal_name: peer.legal_name || undefined,
          contact_name: peer.contact_name || undefined,
          city: peer.city || undefined,
          country: peer.country || undefined,
          industry: peer.industry || undefined,
          updated_at: now,
        })
        .eq('id', byEmail.id);
      return Number(byEmail.id);
    }
  }

  // 3) Insert once
  const { data: created, error } = await supabase
    .from('customers')
    .insert({
      profile_id: opts.sellerProfileId,
      trading_name: peer.trading_name || 'Customer',
      legal_name: peer.legal_name,
      email: peer.email,
      contact_name: peer.contact_name,
      phone: peer.phone || peer.contact_phone,
      industry: peer.industry,
      city: peer.city,
      country: peer.country,
      linked_profile_id: opts.buyerProfileId,
      connection_id: opts.connectionId || null,
      invite_status: inviteStatus,
      status: inviteStatus === 'accepted' ? 'active' : 'prospect',
      source: inviteStatus === 'accepted' ? 'network_accept' : 'network_invite',
      updated_at: now,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('ensureCrmBookEntry insert:', error.message);
    return null;
  }
  return created?.id ? Number(created.id) : null;
}

/**
 * After an accepted edge, sync both sides so they can PO, invoice, and share docs.
 * - supplier type: buyer SRM + supplier CRM
 * - customer type: seller CRM + buyer SRM
 * - partner (or unknown): both directions both books
 */
export async function syncBooksOnAccept(opts: {
  requesterId: number;
  requesteeId: number;
  connectionId: number;
  connectionType: string;
  userId?: string | null;
}): Promise<{ srmIds: number[]; crmIds: number[] }> {
  const type = String(opts.connectionType || 'partner').toLowerCase();
  const srmIds: number[] = [];
  const crmIds: number[] = [];

  try {
    const [requester, requestee] = await Promise.all([
      loadProfileLite(opts.requesterId),
      loadProfileLite(opts.requesteeId),
    ]);

    if (type === 'supplier') {
      // requester=buyer, requestee=supplier
      const srm = await ensureSrmBookEntry({
        buyerProfileId: opts.requesterId,
        supplierProfileId: opts.requesteeId,
        connectionId: opts.connectionId,
        inviteStatus: 'accepted',
        userId: opts.userId,
        peer: requestee,
      });
      if (srm) srmIds.push(srm);

      const crm = await ensureCrmBookEntry({
        sellerProfileId: opts.requesteeId,
        buyerProfileId: opts.requesterId,
        connectionId: opts.connectionId,
        inviteStatus: 'accepted',
        peer: requester,
      });
      if (crm) crmIds.push(crm);
    } else if (type === 'customer') {
      // requester=seller, requestee=buyer
      const crm = await ensureCrmBookEntry({
        sellerProfileId: opts.requesterId,
        buyerProfileId: opts.requesteeId,
        connectionId: opts.connectionId,
        inviteStatus: 'accepted',
        peer: requestee,
      });
      if (crm) crmIds.push(crm);

      const srm = await ensureSrmBookEntry({
        buyerProfileId: opts.requesteeId,
        supplierProfileId: opts.requesterId,
        connectionId: opts.connectionId,
        inviteStatus: 'accepted',
        userId: opts.userId,
        peer: requester,
      });
      if (srm) srmIds.push(srm);
    } else {
      // partner / general network — full mesh books so either side can trade
      const srmA = await ensureSrmBookEntry({
        buyerProfileId: opts.requesterId,
        supplierProfileId: opts.requesteeId,
        connectionId: opts.connectionId,
        inviteStatus: 'accepted',
        userId: opts.userId,
        peer: requestee,
      });
      if (srmA) srmIds.push(srmA);

      const srmB = await ensureSrmBookEntry({
        buyerProfileId: opts.requesteeId,
        supplierProfileId: opts.requesterId,
        connectionId: opts.connectionId,
        inviteStatus: 'accepted',
        userId: opts.userId,
        peer: requester,
      });
      if (srmB) srmIds.push(srmB);

      const crmA = await ensureCrmBookEntry({
        sellerProfileId: opts.requesterId,
        buyerProfileId: opts.requesteeId,
        connectionId: opts.connectionId,
        inviteStatus: 'accepted',
        peer: requestee,
      });
      if (crmA) crmIds.push(crmA);

      const crmB = await ensureCrmBookEntry({
        sellerProfileId: opts.requesteeId,
        buyerProfileId: opts.requesterId,
        connectionId: opts.connectionId,
        inviteStatus: 'accepted',
        peer: requester,
      });
      if (crmB) crmIds.push(crmB);
    }
  } catch (e) {
    console.warn('syncBooksOnAccept soft-fail:', e);
  }

  return { srmIds, crmIds };
}

/**
 * Soft book sync when a connection request is still pending.
 * Only seeds the **requester's** books so they can quote / invoice / PO
 * without re-adding the peer — without claiming the peer accepted.
 *
 * Always seeds CRM: signed-up businesses you requested are invoiceable/quoteable
 * immediately (they already exist on the platform; accept only unlocks mutual portal).
 * Full mesh (both sides) still runs on accept via syncBooksOnAccept.
 */
export async function syncBooksOnInvite(opts: {
  requesterId: number;
  requesteeId: number;
  connectionId: number;
  connectionType: string;
  userId?: string | null;
}): Promise<{ srmIds: number[]; crmIds: number[] }> {
  const type = String(opts.connectionType || 'partner').toLowerCase();
  const srmIds: number[] = [];
  const crmIds: number[] = [];

  try {
    const requestee = await loadProfileLite(opts.requesteeId);
    if (!requestee) return { srmIds, crmIds };

    // Always CRM — quote & invoice while connection is pending
    const crm = await ensureCrmBookEntry({
      sellerProfileId: opts.requesterId,
      buyerProfileId: opts.requesteeId,
      connectionId: opts.connectionId,
      inviteStatus: 'invited',
      peer: requestee,
    });
    if (crm) crmIds.push(crm);

    // SRM for supplier/partner (buyer-side book). Skip pure customer-type edges.
    if (type !== 'customer') {
      const srm = await ensureSrmBookEntry({
        buyerProfileId: opts.requesterId,
        supplierProfileId: opts.requesteeId,
        connectionId: opts.connectionId,
        inviteStatus: 'invited',
        userId: opts.userId,
        peer: requestee,
      });
      if (srm) srmIds.push(srm);
    }
  } catch (e) {
    console.warn('syncBooksOnInvite soft-fail:', e);
  }

  return { srmIds, crmIds };
}

/**
 * Backfill CRM (and optional SRM) book rows for pending outbound connection
 * invites. Call when listing customers so invited-but-not-accepted peers are
 * always available for quotes/invoices without re-adding them.
 */
export async function seedRequesterBooksFromPendingInvites(
  companyId: number,
  opts?: { limit?: number; userId?: string | null }
): Promise<{ seededCrm: number; seededSrm: number }> {
  let seededCrm = 0;
  let seededSrm = 0;
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return { seededCrm, seededSrm };
  }

  try {
    const supabase = getSupabaseServer();
    const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 80);
    const { data: edges, error } = await supabase
      .from('business_connections')
      .select(
        'id, requester_profile_id, requestee_profile_id, connection_type, status'
      )
      .eq('requester_profile_id', companyId)
      .eq('status', 'pending')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error || !edges?.length) {
      if (error) console.warn('seedRequesterBooksFromPendingInvites:', error.message);
      return { seededCrm, seededSrm };
    }

    for (const edge of edges) {
      const peerId = Number(edge.requestee_profile_id);
      const connId = Number(edge.id);
      if (!Number.isFinite(peerId) || peerId <= 0) continue;
      const type = String(edge.connection_type || 'partner').toLowerCase();

      // Every pending outbound request → CRM (quote/invoice signed-up peers)
      const result = await syncBooksOnInvite({
        requesterId: companyId,
        requesteeId: peerId,
        connectionId: connId,
        connectionType: type,
        userId: opts?.userId,
      });
      seededCrm += result.crmIds.length;
      seededSrm += result.srmIds.length;
    }
  } catch (e) {
    console.warn('seedRequesterBooksFromPendingInvites soft-fail:', e);
  }

  return { seededCrm, seededSrm };
}

export async function softSyncSuspend(opts: {
  requesterId: number;
  requesteeId: number;
  connectionType: string;
  suspended: boolean;
}): Promise<void> {
  const supabase = getSupabaseServer();
  const type = opts.connectionType.toLowerCase();
  const now = new Date().toISOString();
  const inviteStatus = opts.suspended ? 'suspended' : 'accepted';
  const srmStatus = opts.suspended ? 'blocked' : 'active';

  try {
    // Always touch both directions for partner; type-specific for supplier/customer
    const pairs: Array<{ buyer: number; supplier: number }> =
      type === 'supplier'
        ? [{ buyer: opts.requesterId, supplier: opts.requesteeId }]
        : type === 'customer'
          ? [{ buyer: opts.requesteeId, supplier: opts.requesterId }]
          : [
              { buyer: opts.requesterId, supplier: opts.requesteeId },
              { buyer: opts.requesteeId, supplier: opts.requesterId },
            ];

    for (const p of pairs) {
      await supabase
        .from('srm_suppliers')
        .update({ status: srmStatus, invite_status: inviteStatus, updated_at: now })
        .eq('profile_id', p.buyer)
        .eq('linked_profile_id', p.supplier);

      await supabase
        .from('customers')
        .update({ invite_status: inviteStatus, updated_at: now })
        .eq('profile_id', p.supplier)
        .eq('linked_profile_id', p.buyer);
    }
  } catch (e) {
    console.warn('softSyncSuspend soft-fail:', e);
  }
}

/**
 * Upsert a business_connections edge. Returns connection id.
 */
export async function upsertNetworkConnection(opts: {
  requesterProfileId: number;
  requesteeProfileId: number;
  connectionType: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  notes?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true; connectionId: number } | { ok: false; error: string }> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    requester_profile_id: opts.requesterProfileId,
    requestee_profile_id: opts.requesteeProfileId,
    // Legacy person-id columns also accept company ids as strings in some rows
    requester_id: String(opts.requesterProfileId),
    requestee_id: String(opts.requesteeProfileId),
    connection_type: opts.connectionType || 'partner',
    status: opts.status,
    notes: opts.notes || null,
    message: opts.notes || null,
    metadata: opts.metadata || {},
    updated_at: now,
    requested_at: now,
  };
  if (opts.status === 'accepted') {
    payload.responded_at = now;
    payload.accepted_at = now;
    payload.approved_at = now;
  }

  const { data, error } = await supabase
    .from('business_connections')
    .upsert(payload, {
      onConflict: 'requester_profile_id,requestee_profile_id',
    })
    .select('id')
    .single();

  if (!error && data?.id) {
    return { ok: true, connectionId: Number(data.id) };
  }

  // Fallback: find reverse or existing pair and update
  const { data: existing } = await supabase
    .from('business_connections')
    .select('id')
    .eq('requester_profile_id', opts.requesterProfileId)
    .eq('requestee_profile_id', opts.requesteeProfileId)
    .maybeSingle();

  if (existing?.id) {
    const { data: updated, error: upErr } = await supabase
      .from('business_connections')
      .update({
        connection_type: opts.connectionType || 'partner',
        status: opts.status,
        notes: opts.notes || null,
        metadata: opts.metadata || {},
        responded_at: opts.status === 'accepted' ? now : undefined,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select('id')
      .single();
    if (upErr) return { ok: false, error: upErr.message };
    return { ok: true, connectionId: Number(updated!.id) };
  }

  // Reverse direction exists — don't create a second edge; update if pending/accepted wanted
  const { data: reverse } = await supabase
    .from('business_connections')
    .select('id, status')
    .eq('requester_profile_id', opts.requesteeProfileId)
    .eq('requestee_profile_id', opts.requesterProfileId)
    .maybeSingle();

  if (reverse?.id && opts.status === 'accepted') {
    const { data: updated, error: upErr } = await supabase
      .from('business_connections')
      .update({
        status: 'accepted',
        connection_type: opts.connectionType || 'partner',
        notes: opts.notes || null,
        metadata: opts.metadata || {},
        responded_at: now,
        updated_at: now,
      })
      .eq('id', reverse.id)
      .select('id')
      .single();
    if (upErr) return { ok: false, error: upErr.message };
    return { ok: true, connectionId: Number(updated!.id) };
  }

  if (reverse?.id) {
    return { ok: true, connectionId: Number(reverse.id) };
  }

  return { ok: false, error: error?.message || 'Failed to upsert connection' };
}

/**
 * Find an existing edge between two companies in either direction.
 */
export async function findConnectionBetween(
  companyA: number,
  companyB: number
): Promise<{
  id: number;
  requester_profile_id: number;
  requestee_profile_id: number;
  status: string;
  connection_type: string | null;
  metadata: unknown;
} | null> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('business_connections')
    .select(
      'id, requester_profile_id, requestee_profile_id, status, connection_type, metadata'
    )
    .or(
      `and(requester_profile_id.eq.${companyA},requestee_profile_id.eq.${companyB}),and(requester_profile_id.eq.${companyB},requestee_profile_id.eq.${companyA})`
    )
    .limit(5);

  if (!data?.length) return null;
  // Prefer accepted, then pending, then newest id
  const sorted = [...data].sort((a, b) => {
    const rank = (s: string) =>
      s === 'accepted' ? 0 : s === 'pending' ? 1 : 2;
    const d = rank(String(a.status)) - rank(String(b.status));
    if (d !== 0) return d;
    return Number(b.id) - Number(a.id);
  });
  return sorted[0] as {
    id: number;
    requester_profile_id: number;
    requestee_profile_id: number;
    status: string;
    connection_type: string | null;
    metadata: unknown;
  };
}
