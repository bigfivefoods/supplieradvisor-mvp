import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';
import {
  edgeHrefs,
  isSuspendedMeta,
  resolveNetworkRole,
  type NetworkEdge,
  type NetworkSummary,
  type PeerProfile,
} from '@/lib/connections/types';
import {
  findConnectionBetween,
  seedRequesterBooksFromPendingInvites,
  softSyncSuspend,
  syncBooksOnAccept,
  syncBooksOnInvite,
  upsertNetworkConnection,
  userOwnsBothCompanies,
} from '@/lib/connections/sync';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';
import { promptAfterConnectionAccepted } from '@/lib/ratings/create-prompt';

/** Production-safe profile columns (no is_verified — that column does not exist). */
const PROFILE_SELECT =
  'id, trading_name, legal_name, email, city, country, industry, verification_status, wallet_address, logo_url, trust_score';
const PROFILE_SELECT_MINIMAL =
  'id, trading_name, legal_name, email, city, country, industry, verification_status, wallet_address';

/**
 * GET ?companyId=&privyUserId=&status=&type=&q=
 * Company-scoped network edges (business_connections) with peer trading names.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const statusFilter = request.nextUrl.searchParams.get('status');
    const typeFilter = request.nextUrl.searchParams.get('type');
    const q = (request.nextUrl.searchParams.get('q') || '').toLowerCase().trim();

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    let membershipWarning: string | undefined;

    // Pending outbound requests → CRM so quote/invoice works before accept
    try {
      await seedRequesterBooksFromPendingInvites(companyId, {
        userId: privyUserId || null,
      });
    } catch {
      /* soft */
    }

    const supabase = getSupabaseServer();

    // Fetch edges where we are either side
    let query = supabase
      .from('business_connections')
      .select(
        `id, requester_profile_id, requestee_profile_id, status, connection_type,
         notes, message, metadata, requested_at, responded_at, created_at, updated_at`
      )
      .or(`requester_profile_id.eq.${companyId},requestee_profile_id.eq.${companyId}`)
      .order('updated_at', { ascending: false })
      .limit(500);

    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'suspended') {
        // filter after load via metadata
      } else {
        query = query.eq('status', statusFilter);
      }
    }
    if (typeFilter && typeFilter !== 'all') {
      query = query.eq('connection_type', typeFilter);
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error('connections GET:', error);
      return NextResponse.json(
        {
          success: true,
          edges: [],
          summary: emptySummary(),
          warning: error.message,
          hint: 'Ensure business_connections exists (customer invites / world-class schema migrations).',
        },
        { status: 200 }
      );
    }

    // Only company-scoped edges (ignore legacy user-DID rows with null profile ids)
    const list = (rows || []).filter((r) => {
      const a = Number(r.requester_profile_id);
      const b = Number(r.requestee_profile_id);
      return Number.isFinite(a) && a > 0 && Number.isFinite(b) && b > 0;
    });
    const peerIds = new Set<number>();
    for (const r of list) {
      const a = Number(r.requester_profile_id);
      const b = Number(r.requestee_profile_id);
      if (a && a !== companyId) peerIds.add(a);
      if (b && b !== companyId) peerIds.add(b);
    }

    const peerMap = await loadPeerProfiles(Array.from(peerIds));

    const edges: NetworkEdge[] = [];
    for (const r of list) {
      const requesterId = Number(r.requester_profile_id);
      const requesteeId = Number(r.requestee_profile_id);
      if (!requesterId || !requesteeId) continue;

      const { direction, role, peerId } = resolveNetworkRole(
        companyId,
        requesterId,
        requesteeId,
        r.connection_type
      );
      const peer = peerMap.get(peerId) || {
        id: peerId,
        trading_name: null,
        legal_name: null,
      };
      // Always prefer trading name; never show bare "Company #id" when name exists
      const displayName =
        (peer.trading_name && String(peer.trading_name).trim()) ||
        (peer.legal_name && String(peer.legal_name).trim()) ||
        null;
      if (displayName) {
        peer.trading_name = displayName;
      }
      const suspended = isSuspendedMeta(r.metadata);
      const status = String(r.status || 'pending');

      if (statusFilter === 'suspended' && !suspended) continue;
      if (statusFilter === 'pending_in' && !(status === 'pending' && direction === 'received')) {
        continue;
      }
      if (statusFilter === 'pending_out' && !(status === 'pending' && direction === 'sent')) {
        continue;
      }

      if (q) {
        const hay = [
          peer.trading_name,
          peer.legal_name,
          peer.email,
          peer.city,
          peer.country,
          peer.industry,
          r.connection_type,
          role,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) continue;
      }

      const msg =
        (typeof r.notes === 'string' && r.notes.trim()) ||
        (typeof r.message === 'string' && r.message.trim()) ||
        null;

      edges.push({
        id: Number(r.id),
        status,
        connection_type: r.connection_type || 'partner',
        message: msg,
        notes: r.notes,
        requested_at: r.requested_at || r.created_at,
        responded_at: r.responded_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        metadata:
          r.metadata && typeof r.metadata === 'object'
            ? (r.metadata as Record<string, unknown>)
            : {},
        suspended,
        direction,
        role,
        peer: {
          ...peer,
          id: peerId,
          trading_name: displayName || peer.trading_name,
          is_verified:
            String(peer.verification_status || '').toLowerCase() === 'verified',
        },
        requester_profile_id: requesterId,
        requestee_profile_id: requesteeId,
        hrefs: edgeHrefs(role, peerId),
      });
    }

    // Prefer accepted + named peers first for a polished graph
    edges.sort((a, b) => {
      const rank = (e: NetworkEdge) =>
        e.status === 'pending' && e.direction === 'received'
          ? 0
          : e.status === 'accepted'
            ? 1
            : e.status === 'pending'
              ? 2
              : 3;
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
      const an = String(a.peer.trading_name || a.peer.legal_name || '');
      const bn = String(b.peer.trading_name || b.peer.legal_name || '');
      return an.localeCompare(bn);
    });

    const summary = computeSummary(edges);

    return NextResponse.json({
      success: true,
      edges,
      summary,
      warning: membershipWarning,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

async function loadPeerProfiles(ids: number[]): Promise<Map<number, PeerProfile>> {
  const peerMap = new Map<number, PeerProfile>();
  if (!ids.length) return peerMap;
  const supabase = getSupabaseServer();
  for (const select of [PROFILE_SELECT, PROFILE_SELECT_MINIMAL, 'id, trading_name, legal_name']) {
    const { data, error } = await supabase.from('profiles').select(select).in('id', ids);
    if (!error && data) {
      for (const p of data) {
        const row = p as unknown as PeerProfile;
        row.is_verified =
          String(row.verification_status || '').toLowerCase() === 'verified';
        peerMap.set(Number(row.id), row);
      }
      break;
    }
    console.warn('connections peer select failed:', error?.message);
  }
  // Ensure every requested id has at least a stub so UI can show something intentional
  for (const id of ids) {
    if (!peerMap.has(id)) {
      peerMap.set(id, { id, trading_name: null, legal_name: null });
    }
  }
  return peerMap;
}

/**
 * POST — request or accept a network connection between two platform companies.
 * Body: {
 *   companyId, privyUserId, targetProfileId,
 *   connectionType?: 'supplier'|'customer'|'partner',
 *   mode?: 'request'|'connect'  (connect = accepted / same-owner auto),
 *   message?: string
 * }
 *
 * Same-owner multi-company: auto-accepts so owners can link their 5 companies immediately.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const targetProfileId = Number(body.targetProfileId);
    const connectionType = String(body.connectionType || 'partner').toLowerCase();
    let mode = String(body.mode || 'request').toLowerCase();

    if (!Number.isFinite(companyId) || !Number.isFinite(targetProfileId)) {
      return NextResponse.json(
        { error: 'companyId and targetProfileId required' },
        { status: 400 }
      );
    }
    if (companyId === targetProfileId) {
      return NextResponse.json({ error: 'Cannot connect to your own company' }, { status: 400 });
    }

    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const sameOwner = await userOwnsBothCompanies(
      body.privyUserId,
      companyId,
      targetProfileId
    );
    if (sameOwner) mode = 'connect';

    const existing = await findConnectionBetween(companyId, targetProfileId);
    if (existing && String(existing.status) === 'accepted') {
      await syncBooksOnAccept({
        requesterId: Number(existing.requester_profile_id),
        requesteeId: Number(existing.requestee_profile_id),
        connectionId: Number(existing.id),
        connectionType: String(existing.connection_type || connectionType),
        userId: mem.userId,
      });
      return NextResponse.json({
        success: true,
        connectionId: Number(existing.id),
        status: 'accepted',
        alreadyConnected: true,
        sameOwner,
      });
    }

    // Outbound still pending — re-seed requester books (quote/invoice without re-add)
    if (
      existing &&
      String(existing.status) === 'pending' &&
      Number(existing.requester_profile_id) === companyId
    ) {
      const resolvedPendingType = String(
        existing.connection_type || connectionType || 'partner'
      );
      await syncBooksOnInvite({
        requesterId: companyId,
        requesteeId: targetProfileId,
        connectionId: Number(existing.id),
        connectionType: resolvedPendingType,
        userId: mem.userId,
      });
      return NextResponse.json({
        success: true,
        connectionId: Number(existing.id),
        status: 'pending',
        alreadyPending: true,
        booksSynced: true,
        sameOwner,
      });
    }

    // If they already sent us a pending request, accept it instead of creating reverse
    if (
      existing &&
      String(existing.status) === 'pending' &&
      Number(existing.requestee_profile_id) === companyId
    ) {
      const supabase = getSupabaseServer();
      const now = new Date().toISOString();
      const { data: updated, error: upErr } = await supabase
        .from('business_connections')
        .update({
          status: 'accepted',
          responded_at: now,
          updated_at: now,
          connection_type: existing.connection_type || connectionType,
          metadata: {
            ...(typeof existing.metadata === 'object' && existing.metadata
              ? (existing.metadata as object)
              : {}),
            accepted_by: mem.userId,
            accepted_at: now,
          },
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
      await syncBooksOnAccept({
        requesterId: Number(existing.requester_profile_id),
        requesteeId: Number(existing.requestee_profile_id),
        connectionId: Number(existing.id),
        connectionType: String(updated.connection_type || connectionType),
        userId: mem.userId,
      });
      return NextResponse.json({
        success: true,
        connectionId: Number(existing.id),
        status: 'accepted',
        acceptedIncoming: true,
        sameOwner,
      });
    }

    const status = mode === 'connect' ? 'accepted' : 'pending';
    const up = await upsertNetworkConnection({
      requesterProfileId: companyId,
      requesteeProfileId: targetProfileId,
      connectionType:
        connectionType === 'supplier' || connectionType === 'customer'
          ? connectionType
          : 'partner',
      status,
      notes: body.message || 'Network connection',
      metadata: {
        source: 'network_hub',
        same_owner_auto_accept: sameOwner,
      },
    });
    if (!up.ok) {
      return NextResponse.json({ error: up.error }, { status: 500 });
    }

    const resolvedType =
      connectionType === 'supplier' || connectionType === 'customer'
        ? connectionType
        : 'partner';

    if (status === 'accepted') {
      await syncBooksOnAccept({
        requesterId: companyId,
        requesteeId: targetProfileId,
        connectionId: up.connectionId,
        connectionType: resolvedType,
        userId: mem.userId,
      });
    } else {
      // Pending: seed requester books so they can quote/invoice/PO without re-adding
      await syncBooksOnInvite({
        requesterId: companyId,
        requesteeId: targetProfileId,
        connectionId: up.connectionId,
        connectionType: resolvedType,
        userId: mem.userId,
      });
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: status === 'accepted' ? 'network.connect' : 'network.request',
      entity_type: 'business_connections',
      entity_id: String(up.connectionId),
      summary:
        status === 'accepted'
          ? `Connected with company #${targetProfileId}`
          : `Requested connection to company #${targetProfileId}`,
      metadata: { targetProfileId, sameOwner, connectionType },
    });

    // Soft email when request is pending (not auto-accept)
    if (status === 'pending') {
      void (async () => {
        try {
          const supabase = getSupabaseServer();
          const { data: requester } = await supabase
            .from('profiles')
            .select('trading_name, legal_name')
            .eq('id', companyId)
            .maybeSingle();
          const { notifyConnectionRequest } = await import(
            '@/lib/notifications/email-alerts'
          );
          await notifyConnectionRequest({
            requesteeProfileId: targetProfileId,
            requesterProfileId: companyId,
            requesterName:
              requester?.trading_name || requester?.legal_name || null,
            message: body.message || null,
          });
        } catch {
          /* soft */
        }
      })();
    }

    return NextResponse.json({
      success: true,
      connectionId: up.connectionId,
      status,
      sameOwner,
      autoAccepted: sameOwner,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH — accept | decline | cancel | suspend | unsuspend
 * Body: { companyId, privyUserId, connectionId, action }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const connectionId = Number(body.connectionId);
    const action = String(body.action || '').toLowerCase();

    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!Number.isFinite(connectionId) || connectionId <= 0) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: conn, error } = await supabase
      .from('business_connections')
      .select('*')
      .eq('id', connectionId)
      .maybeSingle();

    if (error || !conn) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const requesterId = Number(conn.requester_profile_id);
    const requesteeId = Number(conn.requestee_profile_id);
    if (requesterId !== companyId && requesteeId !== companyId) {
      return NextResponse.json({ error: 'Not a party to this connection' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const meta =
      conn.metadata && typeof conn.metadata === 'object' && !Array.isArray(conn.metadata)
        ? { ...(conn.metadata as Record<string, unknown>) }
        : {};
    const updates: Record<string, unknown> = { updated_at: now };
    const status = String(conn.status || '');

    if (action === 'accept') {
      if (requesteeId !== companyId) {
        return NextResponse.json(
          { error: 'Only the recipient can accept a connection request' },
          { status: 403 }
        );
      }
      if (status !== 'pending') {
        return NextResponse.json({ error: 'Connection is not pending' }, { status: 400 });
      }
      updates.status = 'accepted';
      updates.responded_at = now;
      updates.accepted_at = now;
      updates.approved_at = now;
      meta.accepted_by = mem.userId;
      meta.accepted_at = now;
      updates.metadata = meta;
      // Soft: log activation for first-trade funnel
      try {
        await supabase.from('activity_log').insert({
          profile_id: companyId,
          actor_user_id: mem.userId,
          action: 'network.connection_accepted',
          entity_type: 'business_connections',
          entity_id: String(conn.id),
          summary: `Accepted connection with peer #${requesterId}`,
          metadata: {
            peerId: requesterId,
            next: 'first_trade',
            firstTradeHref: `/dashboard?peerTrade=${requesterId}`,
          },
        });
      } catch {
        /* soft */
      }
    } else if (action === 'decline') {
      if (requesteeId !== companyId) {
        return NextResponse.json(
          { error: 'Only the recipient can decline a connection request' },
          { status: 403 }
        );
      }
      if (status !== 'pending') {
        return NextResponse.json({ error: 'Connection is not pending' }, { status: 400 });
      }
      updates.status = 'declined';
      updates.responded_at = now;
      meta.declined_by = mem.userId;
      updates.metadata = meta;
    } else if (action === 'cancel') {
      if (requesterId !== companyId) {
        return NextResponse.json(
          { error: 'Only the requester can cancel a pending request' },
          { status: 403 }
        );
      }
      if (status !== 'pending') {
        return NextResponse.json({ error: 'Connection is not pending' }, { status: 400 });
      }
      updates.status = 'cancelled';
      updates.responded_at = now;
      meta.cancelled_by = mem.userId;
      updates.metadata = meta;
    } else if (action === 'suspend') {
      if (status !== 'accepted') {
        return NextResponse.json({ error: 'Only accepted connections can be suspended' }, { status: 400 });
      }
      meta.suspended = true;
      meta.suspended_at = now;
      meta.suspended_by = mem.userId;
      updates.metadata = meta;
    } else if (action === 'unsuspend') {
      meta.suspended = false;
      meta.unsuspended_at = now;
      meta.unsuspended_by = mem.userId;
      updates.metadata = meta;
    } else {
      return NextResponse.json(
        { error: 'action must be accept|decline|cancel|suspend|unsuspend' },
        { status: 400 }
      );
    }

    const { data: updated, error: upErr } = await supabase
      .from('business_connections')
      .update(updates)
      .eq('id', connectionId)
      .select('*')
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // Side effects: keep SRM / CRM books in sync on accept (both directions)
    if (action === 'accept') {
      await syncBooksOnAccept({
        requesterId,
        requesteeId,
        connectionId,
        connectionType: String(conn.connection_type || 'partner'),
        userId: mem.userId,
      });
      // Soft mutual rating prompts after network accept
      void promptAfterConnectionAccepted({
        companyA: requesterId,
        companyB: requesteeId,
        connectionType: String(conn.connection_type || 'partner'),
        userId: mem.userId,
      }).catch(() => undefined);
      // Golden path: partners connected (first + 3-partner goal when count hits)
      void import('@/lib/onboarding/checklist').then(
        ({ afterPartnerNetworkEvent }) => {
          void afterPartnerNetworkEvent(requesterId);
          void afterPartnerNetworkEvent(requesteeId);
        }
      );
      // Email + in-app: tell the original requester they were accepted
      void (async () => {
        try {
          const peerId =
            requesterId === companyId ? requesteeId : requesterId;
          const notifyId = requesterId; // always the party who requested
          const { data: peerProf } = await supabase
            .from('profiles')
            .select('trading_name, legal_name')
            .eq('id', peerId === requesterId ? requesteeId : peerId)
            .maybeSingle();
          // peer of the requester is the requestee
          const { data: acceptor } = await supabase
            .from('profiles')
            .select('trading_name, legal_name')
            .eq('id', requesteeId)
            .maybeSingle();
          const peerName =
            acceptor?.trading_name ||
            acceptor?.legal_name ||
            peerProf?.trading_name ||
            null;
          const { notifyConnectionAccepted } = await import(
            '@/lib/notifications/email-alerts'
          );
          await notifyConnectionAccepted({
            requesterProfileId: notifyId,
            peerName,
            peerProfileId: requesteeId,
          });
          await supabase.from('activity_log').insert({
            profile_id: notifyId,
            actor_user_id: mem.userId,
            action: 'notify.connection_accepted',
            entity_type: 'business_connections',
            entity_id: String(connectionId),
            summary: `${peerName || 'Partner'} accepted your connection`,
            metadata: { connectionId, requesteeId, requesterId },
          });
          void supabase.from('notifications').insert({
            profile_id: notifyId,
            type: 'connection_accepted',
            title: 'Connection accepted',
            body: `${peerName || 'A partner'} accepted your connection request`,
            metadata: { connectionId, peerProfileId: requesteeId },
            read: false,
          });
        } catch {
          /* soft */
        }
      })();
    }

    if (action === 'suspend' || action === 'unsuspend') {
      await softSyncSuspend({
        requesterId,
        requesteeId,
        connectionType: String(conn.connection_type || 'partner'),
        suspended: action === 'suspend',
      });
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: `network.${action}`,
      entity_type: 'business_connections',
      entity_id: String(connectionId),
      summary: `Connection ${action}`,
      metadata: {
        connectionId,
        connection_type: conn.connection_type,
        peer:
          requesterId === companyId ? requesteeId : requesterId,
      },
    });

    return NextResponse.json({ success: true, connection: updated });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function emptySummary(): NetworkSummary {
  return {
    total: 0,
    accepted: 0,
    pendingIn: 0,
    pendingOut: 0,
    suppliers: 0,
    customers: 0,
    partners: 0,
    suspended: 0,
  };
}

function computeSummary(edges: NetworkEdge[]): NetworkSummary {
  const s = emptySummary();
  s.total = edges.length;
  for (const e of edges) {
    if (e.suspended) s.suspended += 1;
    if (e.status === 'accepted' && !e.suspended) s.accepted += 1;
    if (e.status === 'pending' && e.direction === 'received') s.pendingIn += 1;
    if (e.status === 'pending' && e.direction === 'sent') s.pendingOut += 1;
    if (e.status === 'accepted') {
      if (e.role === 'supplier' || e.role === 'seller') s.suppliers += 1;
      else if (e.role === 'customer' || e.role === 'buyer') s.customers += 1;
      else s.partners += 1;
    }
  }
  return s;
}
