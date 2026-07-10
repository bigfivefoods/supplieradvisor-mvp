import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import { buildBusinessInviteLink, businessInviteEmailHtml } from '@/lib/invites/email';
import { INVITE_EXPIRY_DAYS } from '@/lib/auth/identity';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      trading_name,
      contact_name,
      contact_email,
      invitedBy = 'SupplierAdvisor',
      category,
      contact_phone,
      website,
      inviterProfileId,
    } = body;

    if (!contact_email || !trading_name) {
      return NextResponse.json(
        { error: 'Trading name and contact email are required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const resend = getResend();
    const inviteToken = randomUUID();
    const now = new Date().toISOString();
    const email = String(contact_email).toLowerCase().trim();

    const { data: newSupplier, error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        trading_name: String(trading_name).trim(),
        legal_name: String(trading_name).trim(),
        email,
        contact_name: contact_name || null,
        contact_phone: contact_phone || null,
        category: category || null,
        website: website || null,
        relationship_type: 'supplier',
        supplier_status: 'invited',
        invite_token: inviteToken,
        invited_by: invitedBy,
        invited_at: now,
        created_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return NextResponse.json(
        {
          error: 'Failed to create supplier record',
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    const inviteLink = buildBusinessInviteLink(inviteToken);

    const { error: emailError } = await resend.emails.send({
      from: getResendFrom(),
        replyTo: getResendReplyTo(),
      to: email,
      subject: `${invitedBy} has invited you to join SupplierAdvisor`,
      html: businessInviteEmailHtml({
        inviteeName: contact_name,
        businessName: trading_name,
        invitedBy,
        inviteLink,
      }),
    });

    if (emailError) {
      console.error('Resend error:', emailError);
      return NextResponse.json({
        success: true,
        warning: 'Supplier created but email failed. Share the invite link manually.',
        supplierId: newSupplier?.id,
        inviteToken,
        inviteLink,
        expiresInDays: INVITE_EXPIRY_DAYS,
        details: emailError.message,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      supplierId: newSupplier?.id,
      inviteToken,
      inviteLink,
      expiresInDays: INVITE_EXPIRY_DAYS,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
