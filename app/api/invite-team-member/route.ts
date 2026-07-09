import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getResend } from '@/lib/resend';
import { buildTeamInviteLink, teamInviteEmailHtml } from '@/lib/invites/email';
import { INVITE_EXPIRY_DAYS } from '@/lib/auth/identity';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, name, email, role, companyName, invitedBy, inviterName } = body;

    if (!email || !companyId) {
      return NextResponse.json({ error: 'Email and companyId are required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const resend = getResend();
    const token = randomUUID();
    const normalizedEmail = String(email).toLowerCase().trim();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Avoid duplicate pending invites for same email+company
    const { data: existingRows } = await supabaseAdmin
      .from('business_users')
      .select('id, status, invited_email, email')
      .eq('profile_id', companyId);

    const existing = (existingRows || []).find((row) => {
      const e1 = (row.invited_email || '').toLowerCase();
      const e2 = (row.email || '').toLowerCase();
      return e1 === normalizedEmail || e2 === normalizedEmail;
    });

    if (existing?.status === 'active') {
      return NextResponse.json(
        { error: 'This person is already an active member of this company.' },
        { status: 409 }
      );
    }

    if (existing?.status === 'invited' || existing?.status === 'pending') {
      // Refresh token and resend
      const { error: refreshError } = await supabaseAdmin
        .from('business_users')
        .update({
          invite_token: token,
          name: name || null,
          role: role || 'member',
          invited_by: invitedBy || null,
          invited_at: now,
          status: 'invited',
        })
        .eq('id', existing.id);

      if (refreshError) {
        return NextResponse.json(
          { error: 'Failed to refresh invitation', details: refreshError.message },
          { status: 500 }
        );
      }
    } else {
      const { error: insertError } = await supabaseAdmin.from('business_users').insert({
        profile_id: companyId,
        name: name || null,
        email: normalizedEmail,
        invited_email: normalizedEmail,
        role: role || 'member',
        status: 'invited',
        invited_by: invitedBy || null,
        invite_token: token,
        invited_at: now,
        created_at: now,
      });

      if (insertError) {
        console.error('Team invite insert error:', insertError);
        return NextResponse.json(
          {
            error: 'Failed to create invitation',
            details: insertError.message,
            code: insertError.code,
          },
          { status: 500 }
        );
      }
    }

    const inviteLink = buildTeamInviteLink(token);
    const displayCompany = companyName || 'your company';

    const { error: emailError } = await resend.emails.send({
      from: 'SupplierAdvisor <onboarding@resend.dev>',
      to: normalizedEmail,
      subject: `Join ${displayCompany} on SupplierAdvisor`,
      html: teamInviteEmailHtml({
        inviteeName: name,
        companyName: displayCompany,
        role: role || 'Team Member',
        invitedBy: inviterName || 'Your team',
        inviteLink,
      }),
    });

    if (emailError) {
      console.error('Team invite email error:', emailError);
      return NextResponse.json(
        {
          error: 'Invitation created but email failed to send',
          details: emailError.message,
          inviteLink,
          token,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      inviteLink,
      expiresAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Team invite error:', error);
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
