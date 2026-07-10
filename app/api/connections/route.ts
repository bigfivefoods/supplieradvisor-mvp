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

const PROFILE_SELECT =
  'id, trading_name, legal_name, email, city, country, industry, verification_status, is_verified, wallet_address, logo_url, trust_score';

/**
 * GET ?companyId=&privyUserId=&status=&type=&q=
 * Company-scoped network edges (business_connections) with peer profiles.
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

    let membershipWarning: string | undefined;
    if (privyUserId) {
      const mem = await assertCompanyMember(privyUserId, companyId);
      if (!mem.ok) {
        membershipWarning = mem.error;
      }
    }

    const supabase = getSupabaseServer();

    // Fetch edges where we are either side
    let query = supabase
      .from('business_connections')
      .select(
        `id, requester_profile_id, requestee_profile_id, status, connection_type,
         notes, metadata, requested_at, responded_at, created_at, updated_at`
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

    const list = rows || [];
    const peerIds = new Set<number>();
    for (const r of list) {
      const a = Number(r.requester_profile_id);
      const b = Number(r.requestee_profile_id);
      if (a && a !== companyId) peerIds.add(a);
      if (b && b !== companyId) peerIds.add(b);
    }

    const peerMap = new Map<number, PeerProfile>();
    if (peerIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT)
        .in('id', Array.from(peerIds));
      for (const p of profiles || []) {
        peerMap.set(Number(p.id), p as PeerProfile);
      }
    }

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
        trading_name: `Company #${peerId}`,
      };
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

      edges.push({
        id: Number(r.id),
        status,
        connection_type: r.connection_type || 'partner',
        message: r.notes || null,
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
        peer,
        requester_profile_id: requesterId,
        requestee_profile_id: requesteeId,
        hrefs: edgeHrefs(role, peerId),
      });
    }

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
      meta.accepted_by = mem.userId;
      meta.accepted_at = now;
      updates.metadata = meta;
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

    // Side effects: keep SRM / CRM books in sync on accept
    if (action === 'accept') {
      await syncBooksOnAccept({
        companyId,
        requesterId,
        requesteeId,
        connectionId,
        connectionType: String(conn.connection_type || 'partner'),
        userId: mem.userId,
      });
    }

    if (action === 'suspend' || action === 'unsuspend') {
      await softSyncSuspend({
        companyId,
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

async function syncBooksOnAccept(opts: {
  companyId: number;
  requesterId: number;
  requesteeId: number;
  connectionId: number;
  connectionType: string;
  userId: string;
}) {
  const supabase = getSupabaseServer();
  const type = opts.connectionType.toLowerCase();
  const now = new Date().toISOString();

  try {
    if (type === 'supplier') {
      // buyer=requester, supplier=requestee
      const buyerId = opts.requesterId;
      const supplierProfileId = opts.requesteeId;
      // Ensure buyer's SRM book has linked row
      const { data: existing } = await supabase
        .from('srm_suppliers')
        .select('id')
        .eq('profile_id', buyerId)
        .eq('linked_profile_id', supplierProfileId)
        .maybeSingle();

      const { data: peer } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name, email, phone, contact_phone, industry, city, country')
        .eq('id', supplierProfileId)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('srm_suppliers')
          .update({
            connection_id: opts.connectionId,
            invite_status: 'accepted',
            invite_accepted_at: now,
            status: 'active',
            linked_profile_id: supplierProfileId,
            updated_at: now,
          })
          .eq('id', existing.id);
      } else if (peer) {
        await supabase.from('srm_suppliers').insert({
          profile_id: buyerId,
          trading_name: peer.trading_name || 'Supplier',
          legal_name: peer.legal_name || peer.trading_name,
          email: peer.email,
          phone: peer.phone || peer.contact_phone,
          industry: peer.industry,
          city: peer.city,
          country: peer.country,
          linked_profile_id: supplierProfileId,
          connection_id: opts.connectionId,
          invite_status: 'accepted',
          invite_accepted_at: now,
          status: 'active',
          created_by: opts.userId,
          updated_at: now,
        });
      }
    }

    if (type === 'customer') {
      // seller=requester, buyer=requestee
      const sellerId = opts.requesterId;
      const buyerProfileId = opts.requesteeId;
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('profile_id', sellerId)
        .eq('linked_profile_id', buyerProfileId)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('customers')
          .update({
            connection_id: opts.connectionId,
            invite_status: 'accepted',
            status: 'active',
            updated_at: now,
          })
          .eq('id', existing.id);
      } else {
        const { data: peer } = await supabase
          .from('profiles')
          .select('id, trading_name, legal_name, email, contact_name, phone, contact_phone, industry, city, country')
          .eq('id', buyerProfileId)
          .maybeSingle();
        if (peer) {
          await supabase.from('customers').insert({
            profile_id: sellerId,
            trading_name: peer.trading_name || 'Customer',
            legal_name: peer.legal_name,
            email: peer.email,
            contact_name: peer.contact_name,
            phone: peer.phone || peer.contact_phone,
            industry: peer.industry,
            city: peer.city,
            country: peer.country,
            linked_profile_id: buyerProfileId,
            connection_id: opts.connectionId,
            invite_status: 'accepted',
            status: 'active',
            updated_at: now,
          });
        }
      }
    }
  } catch (e) {
    console.warn('syncBooksOnAccept soft-fail:', e);
  }
}

async function softSyncSuspend(opts: {
  companyId: number;
  requesterId: number;
  requesteeId: number;
  connectionType: string;
  suspended: boolean;
}) {
  const supabase = getSupabaseServer();
  const type = opts.connectionType.toLowerCase();
  const now = new Date().toISOString();
  try {
    if (type === 'customer') {
      const sellerId = opts.requesterId;
      const buyerId = opts.requesteeId;
      await supabase
        .from('customers')
        .update({
          invite_status: opts.suspended ? 'suspended' : 'accepted',
          updated_at: now,
        })
        .eq('profile_id', sellerId)
        .eq('linked_profile_id', buyerId);
    }
    if (type === 'supplier') {
      const buyerId = opts.requesterId;
      const supplierId = opts.requesteeId;
      // no dedicated suspend column — connection metadata is source of truth
      await supabase
        .from('srm_suppliers')
        .update({
          status: opts.suspended ? 'blocked' : 'active',
          updated_at: now,
        })
        .eq('profile_id', buyerId)
        .eq('linked_profile_id', supplierId);
    }
  } catch (e) {
    console.warn('softSyncSuspend soft-fail:', e);
  }
}
