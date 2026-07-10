import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import { buildBusinessInviteLink, businessInviteEmailHtml } from '@/lib/invites/email';
import { INVITE_EXPIRY_DAYS } from '@/lib/auth/identity';

/**
 * POST /api/invite-business
 * Invite a new business/partner to claim a profile and complete onboarding.
 * When inviterProfileId is set, also creates a pending partner edge so accept
 * lands in the network hub for both sides.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      trading_name,
      contact_name,
      contact_email,
      contact_phone,
      website,
      category,
      invitedBy = 'SupplierAdvisor',
      relationship_type = 'business',
      inviterProfileId,
      message,
    } = body;

    if (!contact_email || !trading_name) {
      return NextResponse.json(
        { error: 'Business name and contact email are required.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const resend = getResend();
    const inviteToken = randomUUID();
    const now = new Date().toISOString();
    const email = String(contact_email).toLowerCase().trim();

    // Map invite relationship → connection_type for the network edge
    const rt = String(relationship_type || 'business').toLowerCase();
    const connectionType =
      rt === 'supplier' ? 'supplier' : rt === 'customer' ? 'customer' : 'partner';

    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        trading_name: String(trading_name).trim(),
        legal_name: String(trading_name).trim(),
        email,
        contact_name: contact_name || null,
        contact_phone: contact_phone || null,
        website: website || null,
        category: category || null,
        relationship_type,
        supplier_status: 'invited',
        is_discoverable: true,
        invite_token: inviteToken,
        invited_by: invitedBy,
        invited_at: now,
        created_at: now,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Invite business insert error:', insertError);
      return NextResponse.json(
        {
          error: 'Failed to create invitation. The email may already be registered.',
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    let connectionId: number | null = null;
    const inviterId = inviterProfileId ? Number(inviterProfileId) : null;
    if (inviterId && Number.isFinite(inviterId) && newProfile?.id) {
      // Pending network edge so the inviter sees the request in Connections hub
      const { data: conn, error: connErr } = await supabase
        .from('business_connections')
        .upsert(
          {
            requester_profile_id: inviterId,
            requestee_profile_id: newProfile.id,
            connection_type: connectionType,
            status: 'pending',
            notes: message || `${invitedBy} invited ${trading_name} to the network`,
            metadata: {
              source: 'invite_business',
              invite_token: inviteToken,
            },
            updated_at: now,
          },
          { onConflict: 'requester_profile_id,requestee_profile_id' }
        )
        .select('id')
        .single();
      if (connErr) {
        console.warn('invite-business connection soft-fail:', connErr.message);
      } else if (conn?.id) {
        connectionId = Number(conn.id);
      }
    }

    const inviteLink = buildBusinessInviteLink(inviteToken);

    const { error: emailError } = await resend.emails.send({
      from: getResendFrom(),
      replyTo: getResendReplyTo(),
      to: email,
      subject: `${invitedBy} invited ${trading_name} to SupplierAdvisor`,
      html: businessInviteEmailHtml({
        inviteeName: contact_name,
        businessName: trading_name,
        invitedBy,
        inviteLink,
      }),
    });

    if (emailError) {
      console.error('Invite business email error:', emailError);
      return NextResponse.json({
        success: true,
        warning: 'Invitation created but email failed to send. Share the link manually.',
        profileId: newProfile?.id,
        connectionId,
        inviteLink,
        inviteToken,
        expiresInDays: INVITE_EXPIRY_DAYS,
        details: emailError.message,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      profileId: newProfile?.id,
      connectionId,
      inviteLink,
      inviteToken,
      expiresInDays: INVITE_EXPIRY_DAYS,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Invite business error:', error);
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
