import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  assertCompanyMember,
  isCustomerInvitesEnabled,
  logActivity,
} from '@/lib/customers/access';

/**
 * POST /api/customers/invites/suspend
 * Pause collaboration for a connected customer.
 *
 * Body: { companyId, customerId, privyUserId }
 *
 * Effects:
 * - customers.invite_status = 'suspended'
 * - business_connections.metadata.suspended = true (+ suspended_at)
 * - Does NOT flip connection status away from accepted
 * - activity_log: customer.connection.suspended
 */
export async function POST(request: NextRequest) {
  try {
    if (!isCustomerInvitesEnabled()) {
      return NextResponse.json(
        { error: 'Customer invites are disabled', code: 'CUSTOMER_INVITES_DISABLED' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const companyId = Number(body.companyId);
    const customerId = Number(body.customerId);
    const privyUserId = body.privyUserId;

    if (!Number.isFinite(companyId) || !Number.isFinite(customerId)) {
      return NextResponse.json(
        { error: 'companyId and customerId are required' },
        { status: 400 }
      );
    }

    const member = await assertCompanyMember(privyUserId, companyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();
    const { data: customer, error: loadErr } = await supabase
      .from('customers')
      .select(
        'id, profile_id, trading_name, legal_name, invite_status, linked_profile_id, connection_id'
      )
      .eq('id', customerId)
      .eq('profile_id', companyId)
      .maybeSingle();

    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found for this company' },
        { status: 404 }
      );
    }

    if (customer.invite_status === 'suspended') {
      return NextResponse.json({
        success: true,
        message: 'Customer connection already suspended',
        customer,
      });
    }

    // Must be a live platform link (accepted / connected)
    const isConnected =
      customer.invite_status === 'accepted' ||
      Boolean(customer.linked_profile_id) ||
      Boolean(customer.connection_id);

    if (!isConnected) {
      return NextResponse.json(
        {
          error:
            'Only connected (accepted) customers can be suspended. Invite and claim first.',
          invite_status: customer.invite_status,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const name = customer.trading_name || customer.legal_name || `Customer #${customerId}`;

    // Resolve business_connections row
    let connectionId: number | null = customer.connection_id
      ? Number(customer.connection_id)
      : null;
    let connection: {
      id: number;
      metadata: Record<string, unknown> | null;
      status: string | null;
    } | null = null;

    if (connectionId) {
      const { data: conn } = await supabase
        .from('business_connections')
        .select('id, metadata, status')
        .eq('id', connectionId)
        .maybeSingle();
      if (conn) {
        connection = {
          id: Number(conn.id),
          metadata:
            conn.metadata && typeof conn.metadata === 'object' && !Array.isArray(conn.metadata)
              ? (conn.metadata as Record<string, unknown>)
              : {},
          status: conn.status,
        };
      }
    }

    if (!connection && customer.linked_profile_id) {
      const { data: conn } = await supabase
        .from('business_connections')
        .select('id, metadata, status')
        .eq('requester_profile_id', companyId)
        .eq('requestee_profile_id', customer.linked_profile_id)
        .eq('connection_type', 'customer')
        .eq('status', 'accepted')
        .maybeSingle();
      if (conn) {
        connectionId = Number(conn.id);
        connection = {
          id: connectionId,
          metadata:
            conn.metadata && typeof conn.metadata === 'object' && !Array.isArray(conn.metadata)
              ? (conn.metadata as Record<string, unknown>)
              : {},
          status: conn.status,
        };
      }
    }

    if (connection) {
      const nextMeta = {
        ...(connection.metadata || {}),
        suspended: true,
        suspended_at: now,
      };
      const { error: connErr } = await supabase
        .from('business_connections')
        .update({
          metadata: nextMeta,
          updated_at: now,
        })
        .eq('id', connection.id);
      if (connErr) {
        console.error('suspend BC metadata error:', connErr);
        return NextResponse.json(
          { error: `Failed to update connection: ${connErr.message}` },
          { status: 500 }
        );
      }
    }

    const { data: updated, error: custErr } = await supabase
      .from('customers')
      .update({
        invite_status: 'suspended',
        ...(connectionId && !customer.connection_id
          ? { connection_id: connectionId }
          : {}),
        updated_at: now,
      })
      .eq('id', customerId)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (custErr || !updated) {
      return NextResponse.json(
        { error: custErr?.message || 'Failed to suspend customer' },
        { status: 500 }
      );
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: member.userId,
      action: 'customer.connection.suspended',
      entity_type: 'customer',
      entity_id: String(customerId),
      summary: `Suspended platform connection for ${name}`,
      metadata: {
        connection_id: connectionId,
        linked_profile_id: customer.linked_profile_id,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Customer connection suspended',
      customer: updated,
      connectionId,
    });
  } catch (e: unknown) {
    console.error('POST /api/customers/invites/suspend error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Suspend failed' },
      { status: 500 }
    );
  }
}
