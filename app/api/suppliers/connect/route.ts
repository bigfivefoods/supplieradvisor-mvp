import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  assertCompanyMember,
  upsertSupplierConnection,
} from '@/lib/suppliers/access';
import { logActivity } from '@/lib/customers/access';

/**
 * POST — connect to an on-platform supplier (or add to book + request).
 * Body: companyId, privyUserId, targetProfileId, trading_name?, mode: 'request'|'accept'|'add_and_connect'
 *
 * Creates srm_suppliers book entry + business_connections edge (supplier type).
 * Optional onchainTx stored on book + connection metadata.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const targetProfileId = Number(body.targetProfileId);
    const mode = body.mode || 'add_and_connect';

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

    // Ensure book entry
    let supplierId: number | null = null;
    const { data: existing } = await supabase
      .from('srm_suppliers')
      .select('id')
      .eq('profile_id', companyId)
      .eq('linked_profile_id', targetProfileId)
      .maybeSingle();

    if (existing?.id) {
      supplierId = Number(existing.id);
    } else {
      const { data: created, error: cErr } = await supabase
        .from('srm_suppliers')
        .insert({
          profile_id: companyId,
          trading_name: body.trading_name || target.trading_name || 'Supplier',
          legal_name: target.legal_name || target.trading_name,
          email: target.email,
          phone: (target as { phone?: string; contact_phone?: string }).phone
            || (target as { contact_phone?: string }).contact_phone
            || null,
          contact_name: target.contact_name,
          industry: target.industry,
          sub_industry: target.sub_industry,
          city: target.city,
          country: target.country,
          province: target.province,
          continent: target.continent,
          website: target.website,
          certifications: target.certifications || [],
          wallet_address: target.wallet_address,
          bee_level: target.bee_level,
          verified:
            target.is_verified === true || target.verification_status === 'verified',
          trust_score: target.trust_score || 0,
          otifef_pct: target.otifef_average || 0,
          linked_profile_id: targetProfileId,
          status: 'active',
          invite_status: mode === 'request' ? 'invited' : 'accepted',
          invite_accepted_at: mode === 'request' ? null : new Date().toISOString(),
          onchain_tx: body.onchainTx || null,
          onchain_registered_at: body.onchainTx ? new Date().toISOString() : null,
          created_by: mem.userId,
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (cErr) {
        return NextResponse.json(
          { error: cErr.message, hint: 'Run 20260709_srm_supplier_module.sql' },
          { status: 500 }
        );
      }
      supplierId = Number(created.id);
    }

    let connectionId: number | null = null;
    if (mode === 'request') {
      const now = new Date().toISOString();
      const { data: conn, error: connErr } = await supabase
        .from('business_connections')
        .upsert(
          {
            requester_profile_id: companyId,
            requestee_profile_id: targetProfileId,
            connection_type: 'supplier',
            status: 'pending',
            notes: body.message || 'Supplier connection request',
            metadata: {
              source: 'srm_discover',
              onchain_tx: body.onchainTx || null,
            },
            updated_at: now,
          },
          { onConflict: 'requester_profile_id,requestee_profile_id' }
        )
        .select('id')
        .single();

      if (connErr) {
        // soft: still return book entry
        console.error('connect pending upsert:', connErr);
      } else {
        connectionId = Number(conn.id);
        await supabase
          .from('srm_suppliers')
          .update({
            connection_id: connectionId,
            invite_status: 'invited',
            updated_at: now,
          })
          .eq('id', supplierId);
      }
    } else {
      // Direct connect / accept path (trusted invite takeover or mutual)
      const up = await upsertSupplierConnection({
        buyerProfileId: companyId,
        supplierProfileId: targetProfileId,
        notes: body.message || 'Supplier SRM connection',
        metadata: {
          source: 'srm_connect',
          onchain_tx: body.onchainTx || null,
        },
      });
      if (!up.ok) {
        return NextResponse.json({ error: up.error }, { status: 500 });
      }
      connectionId = up.connectionId;
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
        .eq('id', supplierId);
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: mode === 'request' ? 'supplier.connect_request' : 'supplier.connect',
      entity_type: 'srm_suppliers',
      entity_id: String(supplierId),
      summary: `${mode === 'request' ? 'Requested connection to' : 'Connected with'} ${target.trading_name}`,
      metadata: { targetProfileId, connectionId, onchainTx: body.onchainTx || null },
    });

    return NextResponse.json({
      success: true,
      supplierId,
      connectionId,
      status: mode === 'request' ? 'pending' : 'accepted',
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
      const { data } = await supabase
        .from('business_connections')
        .select('id')
        .eq('requester_profile_id', companyId)
        .eq('requestee_profile_id', Number(body.targetProfileId))
        .maybeSingle();
      connectionId = data?.id ? Number(data.id) : null;
    }
    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId or targetProfileId required' }, { status: 400 });
    }

    const { data: conn, error } = await supabase
      .from('business_connections')
      .select('id, metadata, status, requestee_profile_id, requester_profile_id')
      .eq('id', connectionId)
      .maybeSingle();
    if (error || !conn) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const meta =
      conn.metadata && typeof conn.metadata === 'object' && !Array.isArray(conn.metadata)
        ? { ...(conn.metadata as Record<string, unknown>) }
        : {};
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: now };

    if (action === 'accept') {
      updates.status = 'accepted';
      updates.responded_at = now;
      updates.connection_type = 'supplier';
    } else if (action === 'decline') {
      updates.status = 'declined';
      updates.responded_at = now;
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

    // Mirror invite_status on book
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
          updated_at: now,
        })
        .eq('profile_id', companyId)
        .eq('linked_profile_id', conn.requestee_profile_id);
    }

    return NextResponse.json({ success: true, connection: updated });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
