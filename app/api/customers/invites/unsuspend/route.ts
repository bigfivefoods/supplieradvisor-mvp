import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  assertCustomersAccess,
  isCustomerInvitesEnabled,
  logActivity,
} from '@/lib/customers/access';

/**
 * POST /api/customers/invites/unsuspend
 * Resume collaboration for a suspended customer connection.
 *
 * Body: { companyId, customerId, privyUserId }
 *
 * Effects (order is intentional — fail-closed for new collaboration):
 * 1. customers.invite_status = 'accepted' first
 * 2. then clear business_connections.metadata.suspended / suspended_at
 * 3. activity_log: customer.connection.unsuspended
 *
 * If CRM restore succeeds but BC clear fails, seller UI is Connected and
 * invite_status gates still allow share; buyer PO may still see suspended BC
 * until retry — safer than BC open while CRM still says Suspended.
 *
 * Does not require a new invite (design: unsuspend restores accepted).
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

    const member = await assertCustomersAccess(privyUserId, companyId, 'write');
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

    if (customer.invite_status === 'accepted' && customer.linked_profile_id) {
      // Already accepted — still clear any lingering BC suspended flag
    } else if (customer.invite_status !== 'suspended') {
      return NextResponse.json(
        {
          error: `Customer is not suspended (invite_status=${customer.invite_status || 'not_invited'})`,
          invite_status: customer.invite_status,
        },
        { status: 409 }
      );
    }

    if (!customer.linked_profile_id && !customer.connection_id) {
      return NextResponse.json(
        {
          error:
            'Customer has no platform link to restore. Send a new invite instead of unsuspend.',
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const name = customer.trading_name || customer.legal_name || `Customer #${customerId}`;

    let connectionId: number | null = customer.connection_id
      ? Number(customer.connection_id)
      : null;
    let connection: {
      id: number;
      metadata: Record<string, unknown> | null;
    } | null = null;

    if (connectionId) {
      const { data: conn } = await supabase
        .from('business_connections')
        .select('id, metadata')
        .eq('id', connectionId)
        .maybeSingle();
      if (conn) {
        connection = {
          id: Number(conn.id),
          metadata:
            conn.metadata && typeof conn.metadata === 'object' && !Array.isArray(conn.metadata)
              ? (conn.metadata as Record<string, unknown>)
              : {},
        };
      }
    }

    if (!connection && customer.linked_profile_id) {
      const { data: conn } = await supabase
        .from('business_connections')
        .select('id, metadata')
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
        };
      }
    }

    // 1) Restore CRM first (fail-closed for dual-write partial failure)
    const { data: updated, error: custErr } = await supabase
      .from('customers')
      .update({
        invite_status: 'accepted',
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
        { error: custErr?.message || 'Failed to unsuspend customer' },
        { status: 500 }
      );
    }

    // 2) Clear BC suspend flags after CRM is accepted
    let connectionWarning: string | undefined;
    if (connection) {
      const nextMeta = { ...(connection.metadata || {}) };
      delete nextMeta.suspended;
      delete nextMeta.suspended_at;
      // Explicit false for readers that check truthy only
      nextMeta.suspended = false;

      const { error: connErr } = await supabase
        .from('business_connections')
        .update({
          metadata: nextMeta,
          updated_at: now,
        })
        .eq('id', connection.id);
      if (connErr) {
        console.error('unsuspend BC metadata error:', connErr);
        // CRM already accepted — return success with warning so seller can retry
        connectionWarning = `Customer restored but connection metadata clear failed: ${connErr.message}. Retry unsuspend to clear BC suspended flag.`;
      }
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: member.userId,
      action: 'customer.connection.unsuspended',
      entity_type: 'customer',
      entity_id: String(customerId),
      summary: `Unsuspended platform connection for ${name}`,
      metadata: {
        connection_id: connectionId,
        linked_profile_id: customer.linked_profile_id,
        connection_warning: connectionWarning ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      message: connectionWarning
        ? 'Customer restored; connection metadata needs retry'
        : 'Customer connection restored (accepted)',
      warning: connectionWarning,
      customer: updated,
      connectionId,
    });
  } catch (e: unknown) {
    console.error('POST /api/customers/invites/unsuspend error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unsuspend failed' },
      { status: 500 }
    );
  }
}
