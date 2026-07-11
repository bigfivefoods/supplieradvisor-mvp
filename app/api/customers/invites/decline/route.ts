import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCanonicalUserId, isInviteExpired } from '@/lib/auth/identity';
import { isCustomerInvitesEnabled, logActivity } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * POST /api/customers/invites/decline
 * Token-based (public-ish, like claim). Sets invitation declined and
 * customers.invite_status=declined.
 *
 * Body: { token: string, privyUserId?: string, email?: string }
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
    const token = body.token ? String(body.token) : '';
    if (!token) {
      return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const actorUserId = getCanonicalUserId(body.privyUserId) || null;
    const normalizedEmail = body.email
      ? String(body.email).toLowerCase().trim()
      : null;

    const { data: invitation, error: loadErr } = await supabase
      .from('customer_invitations')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (loadErr) {
      console.error('Customer invite decline load error:', loadErr);
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid or already used invitation.' },
        { status: 404 }
      );
    }

    if (invitation.status === 'declined') {
      return NextResponse.json({
        success: true,
        message: 'Invitation already declined',
        invitation: { id: invitation.id, status: 'declined' },
      });
    }

    if (invitation.status === 'accepted') {
      return NextResponse.json(
        { error: 'This invitation has already been accepted.' },
        { status: 409 }
      );
    }

    if (invitation.status === 'revoked') {
      return NextResponse.json(
        { error: 'This invitation was revoked.' },
        { status: 409 }
      );
    }

    if (invitation.status === 'claiming') {
      return NextResponse.json(
        {
          error:
            'This invitation is mid-claim and cannot be declined. Wait a moment and try again.',
        },
        { status: 409 }
      );
    }

    if (
      invitation.status === 'expired' ||
      isInviteExpired(invitation.created_at, invitation.expires_at)
    ) {
      return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot decline invitation with status "${invitation.status}"` },
        { status: 409 }
      );
    }

    // Optional soft email check when provided
    const inviteEmail = String(invitation.email || '')
      .toLowerCase()
      .trim();
    if (normalizedEmail && inviteEmail && normalizedEmail !== inviteEmail) {
      return NextResponse.json(
        {
          error: `Please use the invited email (${inviteEmail}) to decline.`,
          expectedEmail: inviteEmail,
        },
        { status: 403 }
      );
    }

    const { data: updated, error: updErr } = await supabase
      .from('customer_invitations')
      .update({
        status: 'declined',
        user_id: actorUserId,
        updated_at: now,
      })
      .eq('id', invitation.id)
      .eq('token', token)
      .eq('status', 'pending')
      .select('id, status, customer_id, profile_id, email')
      .maybeSingle();

    if (updErr) {
      console.error('Customer invite decline update error:', updErr);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json(
        { error: 'Invitation could not be declined (status may have changed).' },
        { status: 409 }
      );
    }

    const customerId = Number(updated.customer_id);
    const sellerProfileId = Number(updated.profile_id);

    // Only flip CRM invite_status when not already connected
    const { data: customer } = await supabase
      .from('customers')
      .select('id, invite_status, linked_profile_id')
      .eq('id', customerId)
      .eq('profile_id', sellerProfileId)
      .maybeSingle();

    if (customer && !customer.linked_profile_id) {
      await supabase
        .from('customers')
        .update({
          invite_status: 'declined',
          invite_token: null,
          updated_at: now,
        })
        .eq('id', customerId)
        .eq('profile_id', sellerProfileId);
    }

    await logActivity({
      profile_id: sellerProfileId,
      actor_user_id: actorUserId,
      action: 'customer.invite.declined',
      entity_type: 'customer',
      entity_id: String(customerId),
      summary: `Customer declined platform invitation #${updated.id}`,
      metadata: {
        invitation_id: updated.id,
        email: updated.email,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation declined',
      invitation: updated,
    });
  } catch (e: unknown) {
    console.error('POST /api/customers/invites/decline error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Decline failed' },
      { status: 500 }
    );
  }
}
