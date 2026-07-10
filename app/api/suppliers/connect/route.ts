import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/suppliers/access';
import { logActivity } from '@/lib/customers/access';
import {
  ensureSrmBookEntry,
  findConnectionBetween,
  loadProfileLite,
  syncBooksOnAccept,
  upsertNetworkConnection,
  userOwnsBothCompanies,
} from '@/lib/connections/sync';

/**
 * POST — connection request / accept / connect between platform companies.
 *
 * Body: {
 *   companyId, privyUserId, targetProfileId, trading_name?,
 *   mode: 'request' | 'accept' | 'add_and_connect',
 *   message?
 * }
 *
 * Secure ecosystem handshake:
 *  - request  → pending edge (recipient must accept)
 *  - accept   → only requestee can accept; books sync both ways
 *  - add_and_connect → instant accept only when same user owns both companies
 *
 * After accepted: trade POs, invoices, pricing, docs, optional on-chain settlement.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const targetProfileId = Number(body.targetProfileId);
    let mode = String(body.mode || 'request').toLowerCase();
    const message =
      typeof body.message === 'string' && body.message.trim()
        ? body.message.trim().slice(0, 500)
        : null;

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
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });

    const target = await loadProfileLite(targetProfileId);
    if (!target) {
      return NextResponse.json({ error: 'Target company profile not found' }, { status: 404 });
    }

    const sameOwner = await userOwnsBothCompanies(
      body.privyUserId,
      companyId,
      targetProfileId
    );

    // Instant connect only when explicitly requested AND same owner.
    // Different companies always need accept (even same human owner can switch company to accept).
    if (mode === 'add_and_connect' && !sameOwner) {
      mode = 'request';
    }

    const existingEdge = await findConnectionBetween(companyId, targetProfileId);

    // Already connected
    if (existingEdge && String(existingEdge.status) === 'accepted') {
      await syncBooksOnAccept({
        requesterId: Number(existingEdge.requester_profile_id),
        requesteeId: Number(existingEdge.requestee_profile_id),
        connectionId: Number(existingEdge.id),
        connectionType: String(existingEdge.connection_type || 'supplier'),
        userId: mem.userId,
      });
      const supplierId = await ensureSrmBookEntry({
        buyerProfileId: companyId,
        supplierProfileId: targetProfileId,
        connectionId: Number(existingEdge.id),
        inviteStatus: 'accepted',
        userId: mem.userId,
        peer: target,
      });
      return NextResponse.json({
        success: true,
        supplierId,
        connectionId: Number(existingEdge.id),
        status: 'accepted',
        alreadyConnected: true,
        sameOwner,
      });
    }

    // Incoming pending → accept (we are requestee)
    if (
      existingEdge &&
      String(existingEdge.status) === 'pending' &&
      Number(existingEdge.requestee_profile_id) === companyId &&
      (mode === 'accept' || mode === 'add_and_connect' || mode === 'request')
    ) {
      const supabase = getSupabaseServer();
      const now = new Date().toISOString();
      const { data: updated, error: upErr } = await supabase
        .from('business_connections')
        .update({
          status: 'accepted',
          connection_type: existingEdge.connection_type || 'supplier',
          responded_at: now,
          accepted_at: now,
          approved_at: now,
          updated_at: now,
          metadata: {
            ...(typeof existingEdge.metadata === 'object' && existingEdge.metadata
              ? (existingEdge.metadata as object)
              : {}),
            accepted_by: mem.userId,
            accepted_at: now,
            accepted_via: 'connect_api',
          },
        })
        .eq('id', existingEdge.id)
        .select('*')
        .single();

      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }

      const connectionId = Number(existingEdge.id);
      await syncBooksOnAccept({
        requesterId: Number(existingEdge.requester_profile_id),
        requesteeId: Number(existingEdge.requestee_profile_id),
        connectionId,
        connectionType: String(updated.connection_type || 'supplier'),
        userId: mem.userId,
      });

      const supplierId = await ensureSrmBookEntry({
        buyerProfileId: companyId,
        supplierProfileId: targetProfileId,
        connectionId,
        inviteStatus: 'accepted',
        userId: mem.userId,
        peer: target,
      });

      await logActivity({
        profile_id: companyId,
        actor_user_id: mem.userId,
        action: 'network.accept',
        entity_type: 'business_connections',
        entity_id: String(connectionId),
        summary: `Accepted connection from ${target.trading_name}`,
        metadata: { targetProfileId, connectionId },
      });

      return NextResponse.json({
        success: true,
        supplierId,
        connectionId,
        status: 'accepted',
        acceptedIncoming: true,
        sameOwner,
      });
    }

    // Outgoing pending already exists
    if (
      existingEdge &&
      String(existingEdge.status) === 'pending' &&
      Number(existingEdge.requester_profile_id) === companyId
    ) {
      return NextResponse.json({
        success: true,
        connectionId: Number(existingEdge.id),
        status: 'pending',
        alreadyPending: true,
        message: 'Connection request already sent — waiting for them to accept',
      });
    }

    // Declined/cancelled → allow new request by creating fresh pending
    const supabase = getSupabaseServer();

    // Book entry (prospect until accepted)
    const inviteStatus =
      mode === 'add_and_connect' && sameOwner ? 'accepted' : 'invited';
    const supplierId = await ensureSrmBookEntry({
      buyerProfileId: companyId,
      supplierProfileId: targetProfileId,
      connectionId: existingEdge?.id ? Number(existingEdge.id) : null,
      inviteStatus,
      userId: mem.userId,
      peer: target,
    });

    let connectionId: number | null = null;
    let finalStatus: 'pending' | 'accepted' = 'pending';

    if (mode === 'add_and_connect' && sameOwner) {
      const up = await upsertNetworkConnection({
        requesterProfileId: companyId,
        requesteeProfileId: targetProfileId,
        connectionType: body.connectionType || 'supplier',
        status: 'accepted',
        notes: message || 'Same-owner company connection',
        metadata: {
          source: 'srm_same_owner',
          same_owner_auto_accept: true,
          onchain_tx: body.onchainTx || null,
        },
      });
      if (!up.ok) {
        return NextResponse.json({ error: up.error }, { status: 500 });
      }
      connectionId = up.connectionId;
      finalStatus = 'accepted';
      await syncBooksOnAccept({
        requesterId: companyId,
        requesteeId: targetProfileId,
        connectionId,
        connectionType: body.connectionType || 'supplier',
        userId: mem.userId,
      });
    } else {
      // Standard secure handshake: pending request
      const up = await upsertNetworkConnection({
        requesterProfileId: companyId,
        requesteeProfileId: targetProfileId,
        connectionType: body.connectionType || 'supplier',
        status: 'pending',
        notes: message || 'Connection request from SupplierAdvisor network',
        metadata: {
          source: 'srm_discover',
          onchain_tx: body.onchainTx || null,
        },
      });
      if (!up.ok) {
        return NextResponse.json({ error: up.error }, { status: 500 });
      }
      connectionId = up.connectionId;
      finalStatus = 'pending';

      await supabase
        .from('srm_suppliers')
        .update({
          connection_id: connectionId,
          invite_status: 'invited',
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', companyId)
        .eq('linked_profile_id', targetProfileId);
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action:
        finalStatus === 'pending' ? 'supplier.connect_request' : 'supplier.connect',
      entity_type: 'business_connections',
      entity_id: String(connectionId || ''),
      summary:
        finalStatus === 'pending'
          ? `Requested connection to ${target.trading_name}`
          : `Connected with ${target.trading_name}`,
      metadata: { targetProfileId, connectionId, sameOwner, mode },
    });

    return NextResponse.json({
      success: true,
      supplierId,
      connectionId,
      status: finalStatus,
      sameOwner,
      autoAccepted: finalStatus === 'accepted' && sameOwner,
      peerName: target.trading_name,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * PATCH — accept | decline | cancel | suspend | unsuspend
 * Body: companyId, privyUserId, connectionId | targetProfileId, action
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const action = String(body.action || '').toLowerCase();
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });

    const supabase = getSupabaseServer();
    let connectionId = body.connectionId ? Number(body.connectionId) : null;

    if (!connectionId && body.targetProfileId) {
      const edge = await findConnectionBetween(companyId, Number(body.targetProfileId));
      connectionId = edge?.id ? Number(edge.id) : null;
    }
    if (!connectionId) {
      return NextResponse.json(
        { error: 'connectionId or targetProfileId required' },
        { status: 400 }
      );
    }

    const { data: conn, error } = await supabase
      .from('business_connections')
      .select(
        'id, metadata, status, requestee_profile_id, requester_profile_id, connection_type'
      )
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

    const meta =
      conn.metadata && typeof conn.metadata === 'object' && !Array.isArray(conn.metadata)
        ? { ...(conn.metadata as Record<string, unknown>) }
        : {};
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: now };
    const status = String(conn.status || '');

    if (action === 'accept') {
      if (requesteeId !== companyId) {
        return NextResponse.json(
          { error: 'Only the recipient company can accept this request' },
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
      if (!conn.connection_type) updates.connection_type = 'supplier';
      meta.accepted_by = mem.userId;
      meta.accepted_at = now;
      updates.metadata = meta;
    } else if (action === 'decline') {
      if (requesteeId !== companyId) {
        return NextResponse.json(
          { error: 'Only the recipient company can decline this request' },
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
        return NextResponse.json(
          { error: 'Only accepted connections can be suspended' },
          { status: 400 }
        );
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
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    if (action === 'accept') {
      await syncBooksOnAccept({
        requesterId,
        requesteeId,
        connectionId,
        connectionType: String(updated.connection_type || conn.connection_type || 'supplier'),
        userId: mem.userId,
      });
    }

    if (action === 'accept' || action === 'suspend' || action === 'unsuspend' || action === 'decline') {
      const inviteStatus =
        action === 'accept'
          ? 'accepted'
          : action === 'suspend'
            ? 'suspended'
            : action === 'unsuspend'
              ? 'accepted'
              : 'declined';
      await supabase
        .from('srm_suppliers')
        .update({
          invite_status: inviteStatus,
          connection_id: connectionId,
          invite_accepted_at: action === 'accept' ? now : undefined,
          status: action === 'suspend' ? 'blocked' : action === 'accept' ? 'active' : undefined,
          updated_at: now,
        })
        .or(
          `and(profile_id.eq.${requesterId},linked_profile_id.eq.${requesteeId}),and(profile_id.eq.${requesteeId},linked_profile_id.eq.${requesterId})`
        );
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: `network.${action}`,
      entity_type: 'business_connections',
      entity_id: String(connectionId),
      summary: `Connection ${action}`,
      metadata: { connectionId, action },
    });

    return NextResponse.json({ success: true, connection: updated });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
