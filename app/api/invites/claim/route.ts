import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCanonicalUserId, isInviteExpired } from '@/lib/auth/identity';

/**
 * POST /api/invites/claim
 * Claim a business/supplier invite or accept a team invite after Privy auth.
 *
 * Body: {
 *   token: string
 *   kind: 'business' | 'team'
 *   privyUserId: string
 *   email?: string
 *   name?: string
 *   phone?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, kind = 'business', privyUserId, email, name, phone } = body;

    const userId = getCanonicalUserId(privyUserId);
    if (!token || !userId) {
      return NextResponse.json(
        { error: 'Invitation token and authenticated user are required.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const normalizedEmail = email ? String(email).toLowerCase().trim() : null;

    if (kind === 'team') {
      const { data: invite, error } = await supabase
        .from('business_users')
        .select('*')
        .eq('invite_token', token)
        .maybeSingle();

      if (error || !invite) {
        return NextResponse.json({ error: 'Invalid or already used invitation.' }, { status: 404 });
      }

      if (invite.status === 'active' && invite.user_id === userId) {
        return NextResponse.json({
          success: true,
          alreadyMember: true,
          profileId: invite.profile_id,
          message: 'You already belong to this company.',
        });
      }

      if (invite.status !== 'invited' && invite.status !== 'pending') {
        return NextResponse.json({ error: 'This invitation has already been accepted.' }, { status: 409 });
      }

      if (isInviteExpired(invite.invited_at || invite.created_at)) {
        return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
      }

      // Soft email check when both known
      const inviteEmail = (invite.invited_email || invite.email || '').toLowerCase();
      if (normalizedEmail && inviteEmail && normalizedEmail !== inviteEmail) {
        return NextResponse.json(
          {
            error: `Please sign in with the invited email (${inviteEmail}).`,
            expectedEmail: inviteEmail,
          },
          { status: 403 }
        );
      }

      const { error: updateError } = await supabase
        .from('business_users')
        .update({
          user_id: userId,
          status: 'active',
          name: name || invite.name || null,
          email: normalizedEmail || invite.invited_email || invite.email,
          invite_token: null,
          joined_at: now,
        })
        .eq('id', invite.id)
        .eq('invite_token', token);

      if (updateError) {
        console.error('Team claim update error:', updateError);
        return NextResponse.json({ error: 'Failed to accept invitation.', details: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        kind: 'team',
        profileId: invite.profile_id,
        role: invite.role || 'member',
        message: 'Welcome to the team!',
      });
    }

    // ---- Business / supplier claim ----
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('invite_token', token)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Invalid or already used invitation.' }, { status: 404 });
    }

    if (profile.supplier_status !== 'invited' && profile.supplier_status !== 'pending') {
      // Already claimed — if this user is owner, treat as success
      const { data: existing } = await supabase
        .from('business_users')
        .select('id')
        .eq('profile_id', profile.id)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          success: true,
          alreadyMember: true,
          profileId: profile.id,
          message: 'You already have access to this company.',
        });
      }

      return NextResponse.json({ error: 'This invitation has already been claimed.' }, { status: 409 });
    }

    if (isInviteExpired(profile.invited_at || profile.created_at)) {
      return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
    }

    const inviteEmail = (profile.email || '').toLowerCase();
    if (normalizedEmail && inviteEmail && normalizedEmail !== inviteEmail) {
      return NextResponse.json(
        {
          error: `Please sign in with the invited email (${inviteEmail}).`,
          expectedEmail: inviteEmail,
        },
        { status: 403 }
      );
    }

    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({
        supplier_status: 'active',
        claimed_at: now,
        contact_name: name || profile.contact_name,
        contact_phone: phone || profile.contact_phone,
        email: normalizedEmail || profile.email,
        invite_token: null,
        user_id: userId,
      })
      .eq('id', profile.id)
      .eq('invite_token', token);

    if (updateProfileError) {
      console.error('Business claim profile error:', updateProfileError);
      return NextResponse.json(
        { error: 'Failed to claim business profile.', details: updateProfileError.message },
        { status: 500 }
      );
    }

    // Create or update ownership membership
    const { data: existingMembership } = await supabase
      .from('business_users')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMembership) {
      await supabase
        .from('business_users')
        .update({
          role: 'owner',
          status: 'active',
          name: name || profile.contact_name,
          email: normalizedEmail || profile.email,
          joined_at: now,
          invite_token: null,
        })
        .eq('id', existingMembership.id);
    } else {
      const { error: membershipError } = await supabase.from('business_users').insert({
        user_id: userId,
        profile_id: profile.id,
        role: 'owner',
        status: 'active',
        name: name || profile.contact_name,
        email: normalizedEmail || profile.email,
        joined_at: now,
      });

      if (membershipError) {
        console.error('Business claim membership error:', membershipError);
        // Profile is claimed; surface soft warning
        return NextResponse.json({
          success: true,
          profileId: profile.id,
          warning: 'Profile claimed but membership link failed. Contact support if companies do not appear.',
          details: membershipError.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      kind: 'business',
      profileId: profile.id,
      role: 'owner',
      message: 'Business profile claimed successfully!',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Claim failed';
    console.error('Invite claim error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
