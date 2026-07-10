import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import { INVITE_EXPIRY_DAYS } from '@/lib/auth/identity';
import {
  assertCompanyMember,
  checkCustomerInviteRateLimits,
  isCustomerInvitesEnabled,
  logActivity,
  resolveSoleTargetProfileIdByEmail,
} from '@/lib/customers/access';
import {
  buildCustomerInviteLink,
  customerInviteEmailHtml,
} from '@/lib/invites/email';

/**
 * POST /api/customers/invites/resend
 * Revoke prior pending invites for the customer, create a new token, resend email.
 * Body: { companyId, customerId, privyUserId, invitationId?, email?, message?, invitedBy? }
 *   or  { companyId, invitationId, privyUserId, ... } (customer resolved from invitation)
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
    const privyUserId = body.privyUserId;
    let customerId = body.customerId != null ? Number(body.customerId) : NaN;
    const invitationId =
      body.invitationId != null ? Number(body.invitationId) : null;

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    const member = await assertCompanyMember(privyUserId, companyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();
    let priorInvite: Record<string, unknown> | null = null;

    if (Number.isFinite(invitationId as number)) {
      const { data } = await supabase
        .from('customer_invitations')
        .select('*')
        .eq('id', invitationId as number)
        .eq('profile_id', companyId)
        .maybeSingle();
      priorInvite = data;
      if (data) {
        customerId = Number(data.customer_id);
      }
    }

    if (!Number.isFinite(customerId)) {
      return NextResponse.json(
        { error: 'customerId or invitationId is required' },
        { status: 400 }
      );
    }

    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select(
        'id, profile_id, trading_name, legal_name, email, contact_name, invite_status, linked_profile_id, invited_email'
      )
      .eq('id', customerId)
      .eq('profile_id', companyId)
      .maybeSingle();

    if (custErr || !customer) {
      return NextResponse.json(
        { error: custErr?.message || 'Customer not found for this company' },
        { status: custErr ? 500 : 404 }
      );
    }

    if (
      customer.invite_status === 'accepted' ||
      customer.invite_status === 'suspended' ||
      customer.linked_profile_id
    ) {
      return NextResponse.json(
        {
          error:
            'Customer is already connected (or suspended). Unlink or unsuspend before re-inviting.',
          invite_status: customer.invite_status,
        },
        { status: 409 }
      );
    }

    const email = String(
      body.email ||
        priorInvite?.email ||
        customer.invited_email ||
        customer.email ||
        ''
    )
      .toLowerCase()
      .trim();
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'A valid email is required to resend the invitation' },
        { status: 400 }
      );
    }

    const rate = await checkCustomerInviteRateLimits({
      companyId,
      customerId,
      replacingCustomerPending: true,
    });
    if (!rate.ok) {
      const headers: HeadersInit = {};
      if (rate.retryAfterSeconds) {
        headers['Retry-After'] = String(rate.retryAfterSeconds);
      }
      return NextResponse.json({ error: rate.error }, { status: rate.status, headers });
    }

    // Revoke prior pending so only one active token
    await supabase
      .from('customer_invitations')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('customer_id', customerId)
      .eq('status', 'pending');

    let targetProfileId: number | null =
      priorInvite?.target_profile_id != null
        ? Number(priorInvite.target_profile_id)
        : null;
    if (targetProfileId == null) {
      targetProfileId = await resolveSoleTargetProfileIdByEmail(email);
    }

    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('id, trading_name, legal_name')
      .eq('id', companyId)
      .maybeSingle();

    const sellerCompanyName =
      (priorInvite?.company_name as string | undefined) ||
      sellerProfile?.trading_name ||
      sellerProfile?.legal_name ||
      'Your supplier';
    const contactName =
      (body.contactName ? String(body.contactName).trim() : null) ||
      (priorInvite?.full_name as string | null) ||
      customer.contact_name ||
      null;
    const customerName =
      customer.trading_name ||
      customer.legal_name ||
      (priorInvite?.customer_name as string) ||
      'Customer';
    const invitedBy =
      (body.invitedBy ? String(body.invitedBy) : null) ||
      (priorInvite?.invited_by as string | null) ||
      member.userId;
    const message =
      body.message != null
        ? String(body.message).trim()
        : (priorInvite?.message as string | null) || null;
    const token = randomUUID();
    const now = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: invitation, error: invErr } = await supabase
      .from('customer_invitations')
      .insert({
        token,
        profile_id: companyId,
        customer_id: customerId,
        email,
        full_name: contactName,
        status: 'pending',
        invited_by: invitedBy,
        company_name: sellerCompanyName,
        customer_name: customerName,
        target_profile_id: targetProfileId,
        message,
        expires_at: expiresAt,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (invErr || !invitation) {
      return NextResponse.json(
        {
          error: invErr?.message || 'Failed to create invitation',
          hint: 'Run supabase/migrations/20260709_customer_platform_invites.sql',
        },
        { status: 500 }
      );
    }

    const { error: crmErr } = await supabase
      .from('customers')
      .update({
        invite_status: 'invited',
        invite_token: token,
        invited_at: now,
        invited_email: email,
        updated_at: now,
      })
      .eq('id', customerId)
      .eq('profile_id', companyId);

    let crmWarning: string | undefined;
    if (crmErr) {
      console.error('Customer CRM invite_status update failed on resend:', crmErr);
      crmWarning = `Invitation recreated (id=${invitation.id}) but CRM invite fields failed to update: ${crmErr.message}`;
    }

    const inviteLink = buildCustomerInviteLink(token);

    let emailWarning: string | undefined;
    try {
      const resend = getResend();
      const { error: emailError } = await resend.emails.send({
        from: getResendFrom(),
        replyTo: getResendReplyTo(),
        to: email,
        subject: `${sellerCompanyName} invited ${customerName} to SupplierAdvisor`,
        html: customerInviteEmailHtml({
          inviteeName: contactName,
          customerName,
          sellerCompanyName,
          invitedBy: String(invitedBy),
          inviteLink,
          message,
        }),
      });
      if (emailError) {
        emailWarning = `Invitation recreated but email failed to send: ${emailError.message}`;
      }
    } catch (emailErr: unknown) {
      const msg = emailErr instanceof Error ? emailErr.message : 'Email failed';
      emailWarning = `Invitation recreated but email failed: ${msg}`;
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: member.userId,
      action: 'customer.invite.sent',
      entity_type: 'customer',
      entity_id: String(customerId),
      summary: `Resent platform invitation to ${customerName}`,
      metadata: {
        invitation_id: invitation.id,
        email,
        resend: true,
        prior_invitation_id: invitationId,
      },
    });

    const warning = [crmWarning, emailWarning].filter(Boolean).join(' ') || undefined;

    return NextResponse.json({
      success: true,
      message: warning ? undefined : 'Invitation resent',
      warning,
      invitation,
      inviteLink,
      inviteToken: token,
      expiresInDays: INVITE_EXPIRY_DAYS,
    });
  } catch (e: unknown) {
    console.error('POST /api/customers/invites/resend error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Resend failed' },
      { status: 500 }
    );
  }
}
