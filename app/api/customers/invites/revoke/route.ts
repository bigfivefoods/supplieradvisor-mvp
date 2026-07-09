import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  assertCompanyMember,
  isCustomerInvitesEnabled,
  logActivity,
} from '@/lib/customers/access';

/**
 * POST /api/customers/invites/revoke
 * Body: { companyId, invitationId, privyUserId }
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
    const invitationId = Number(body.invitationId);
    const privyUserId = body.privyUserId;

    if (!Number.isFinite(companyId) || !Number.isFinite(invitationId)) {
      return NextResponse.json(
        { error: 'companyId and invitationId are required' },
        { status: 400 }
      );
    }

    const member = await assertCompanyMember(privyUserId, companyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();
    const { data: invitation, error: loadErr } = await supabase
      .from('customer_invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('profile_id', companyId)
      .maybeSingle();

    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.status === 'accepted') {
      return NextResponse.json(
        { error: 'Cannot revoke an already accepted invitation' },
        { status: 409 }
      );
    }
    if (invitation.status === 'revoked') {
      return NextResponse.json({
        success: true,
        message: 'Invitation already revoked',
        invitation,
      });
    }

    const now = new Date().toISOString();
    const { data: updated, error: updErr } = await supabase
      .from('customer_invitations')
      .update({ status: 'revoked', updated_at: now })
      .eq('id', invitationId)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // If no other pending invite for this customer, reset CRM invite phase
    const customerId = Number(invitation.customer_id);
    const { count: remainingPending } = await supabase
      .from('customer_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('status', 'pending');

    if ((remainingPending ?? 0) === 0) {
      const { data: customer } = await supabase
        .from('customers')
        .select('id, invite_status, invite_token, linked_profile_id')
        .eq('id', customerId)
        .eq('profile_id', companyId)
        .maybeSingle();

      if (
        customer &&
        !customer.linked_profile_id &&
        (customer.invite_status === 'invited' || customer.invite_token)
      ) {
        await supabase
          .from('customers')
          .update({
            invite_status: 'not_invited',
            invite_token: null,
            updated_at: now,
          })
          .eq('id', customerId)
          .eq('profile_id', companyId);
      }
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: member.userId,
      action: 'customer.invite.revoked',
      entity_type: 'customer',
      entity_id: String(customerId),
      summary: `Revoked platform invitation for customer #${customerId}`,
      metadata: { invitation_id: invitationId, email: invitation.email },
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation revoked',
      invitation: updated,
    });
  } catch (e: unknown) {
    console.error('POST /api/customers/invites/revoke error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Revoke failed' },
      { status: 500 }
    );
  }
}
