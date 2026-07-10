import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/suppliers/access';
import { logActivity } from '@/lib/customers/access';
import {
  ensureSrmBookEntry,
  findConnectionBetween,
  syncBooksOnAccept,
  upsertNetworkConnection,
  userOwnsBothCompanies,
} from '@/lib/connections/sync';

/**
 * POST — connect to an on-platform supplier (or add to book + request).
 * Body: companyId, privyUserId, targetProfileId, trading_name?, mode: 'request'|'accept'|'add_and_connect'
 *
 * Creates srm_suppliers book entry + business_connections edge (supplier type).
 * Same-owner multi-company: auto-accepts so owners can trade across their companies immediately.
 * On accept: bidirectional SRM + CRM books so both sides can PO, invoice, and pay.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const targetProfileId = Number(body.targetProfileId);
    let mode = String(body.mode || 'add_and_connect');

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

    const supabase = getSupabaseServer();
    const { data: target, error: tErr } = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, email, phone, contact_phone, contact_name, industry, sub_industry, city, country, province, continent, certifications, wallet_address, website, bee_level, verification_status, is_verified, trust_score, otifef_average'
      )
      .eq('id', targetProfileId)
      .maybeSingle();

    if (tErr || !target) {
      return NextResponse.json({ error: 'Target supplier profile not found' }, { status: 404 });
    }

    // Same owner of both companies → auto-accept (no second login hop)
    const sameOwner = await userOwnsBothCompanies(
      body.privyUserId,
      companyId,
      targetProfileId
    );
    if (sameOwner && mode === 'request') {
      mode = 'add_and_connect';
    }

    // Existing edge in either direction
    const existingEdge = await findConnectionBetween(companyId, targetProfileId);
    if (existingEdge && String(existingEdge.status) === 'accepted') {
      // Already connected — ensure books exist and return
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

    // Ensure book entry early (pending or accepted)
    const inviteStatus =
      mode === 'request' && !sameOwner ? 'invited' : 'accepted';
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

    if (mode === 'request' && !sameOwner) {
      const up = await upsertNetworkConnection({
        requesterProfileId: companyId,
        requesteeProfileId: targetProfileId,
        connectionType: 'supplier',
        status: 'pending',
        notes: body.message || 'Supplier connection request',
        metadata: {
          source: 'srm_discover',
          onchain_tx: body.onchainTx || null,
        },
      });
      if (!up.ok) {
        console.error('connect pending upsert:', up.error);
      } else {
        connectionId = up.connectionId;
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
      finalStatus = 'pending';
    } else {
      // Direct connect / accept / same-owner path
      const up = await upsertNetworkConnection({
        requesterProfileId: companyId,
        requesteeProfileId: targetProfileId,
        connectionType: body.connectionType || 'supplier',
        status: 'accepted',
        notes: body.message || 'Supplier SRM connection',
        metadata: {
          source: sameOwner ? 'srm_same_owner' : 'srm_connect',
          onchain_tx: body.onchainTx || null,
          same_owner_auto_accept: sameOwner,
        },
      });
      if (!up.ok) {
        return NextResponse.json({ error: up.error }, { status: 500 });
      }
      connectionId = up.connectionId;
      finalStatus = 'accepted';

      // Bidirectional books so both companies can invoice, PO, and pay each other
      await syncBooksOnAccept({
        requesterId: companyId,
        requesteeId: targetProfileId,
        connectionId,
        connectionType: body.connectionType || 'supplier',
        userId: mem.userId,
      });

      await supabase
        .from('srm_suppliers')
        .update({
          connection_id: connectionId,
          invite_status: 'accepted',
          invite_accepted_at: new Date().toISOString(),
          status: 'active',
          linked_profile_id: targetProfileId,
          onchain_tx: body.onchainTx || null,
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
      entity_type: 'srm_suppliers',
      entity_id: String(supplierId || ''),
      summary: `${
        finalStatus === 'pending' ? 'Requested connection to' : 'Connected with'
      } ${target.trading_name}${sameOwner ? ' (same owner auto-accept)' : ''}`,
      metadata: {
        targetProfileId,
        connectionId,
        onchainTx: body.onchainTx || null,
        sameOwner,
      },
    });

    return NextResponse.json({
      success: true,
      supplierId,
      connectionId,
      status: finalStatus,
      sameOwner,
      autoAccepted: sameOwner && body.mode === 'request',
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * PATCH — accept / decline / suspend supplier connection
 * Body: companyId, privyUserId, connectionId | targetProfileId, action: accept|decline|suspend|unsuspend
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const action = String(body.action || '');
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
      .select('id, metadata, status, requestee_profile_id, requester_profile_id, connection_type')
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

    if (action === 'accept') {
      if (requesteeId !== companyId) {
        return NextResponse.json(
          { error: 'Only the recipient can accept a connection request' },
          { status: 403 }
        );
      }
      updates.status = 'accepted';
      updates.responded_at = now;
      if (!conn.connection_type) updates.connection_type = 'supplier';
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
      updates.status = 'declined';
      updates.responded_at = now;
      meta.declined_by = mem.userId;
      updates.metadata = meta;
    } else if (action === 'suspend') {
      meta.suspended = true;
      meta.suspended_at = now;
      updates.metadata = meta;
    } else if (action === 'unsuspend') {
      meta.suspended = false;
      meta.unsuspended_at = now;
      updates.metadata = meta;
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
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

    // Mirror invite_status on book for the buyer side of a supplier edge
    if (action === 'accept' || action === 'suspend' || action === 'unsuspend' || action === 'decline') {
      const inviteStatus =
        action === 'accept'
          ? 'accepted'
          : action === 'suspend'
            ? 'suspended'
            : action === 'unsuspend'
              ? 'accepted'
              : 'declined';
      // Update books owned by either party that reference this edge
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

    return NextResponse.json({ success: true, connection: updated });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
