import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getResend } from '@/lib/resend';
import { INVITE_EXPIRY_DAYS } from '@/lib/auth/identity';
import {
  assertCompanyMember,
  checkCustomerInviteRateLimits,
  CUSTOMER_INVITATION_LIST_COLUMNS,
  isCustomerInvitesEnabled,
  logActivity,
  resolveSoleTargetProfileIdByEmail,
} from '@/lib/customers/access';
import {
  buildCustomerInviteLink,
  customerInviteEmailHtml,
} from '@/lib/invites/email';

/**
 * POST /api/customers/invites
 * Invite a CRM customer onto the platform.
 * Body: { companyId, customerId, privyUserId, email?, contactName?, message?, invitedBy? }
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

    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select(
        'id, profile_id, trading_name, legal_name, email, contact_name, invite_status, linked_profile_id, connection_id, invited_email'
      )
      .eq('id', customerId)
      .eq('profile_id', companyId)
      .maybeSingle();

    if (custErr) {
      console.error('Customer invite load error:', custErr);
      return NextResponse.json(
        {
          error: custErr.message,
          hint: 'Run supabase/migrations/20260709_customer_platform_invites.sql',
        },
        { status: 500 }
      );
    }
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found for this company' },
        { status: 404 }
      );
    }

    // Already connected / suspended with live link → 409
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
          linked_profile_id: customer.linked_profile_id,
        },
        { status: 409 }
      );
    }

    const email = String(body.email || customer.email || customer.invited_email || '')
      .toLowerCase()
      .trim();
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'A valid customer email is required to send an invitation' },
        { status: 400 }
      );
    }

    // Rate-limit via SQL counts (accounts for replacing this customer's pending)
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

    // Revoke prior pending for this customer (design: one active invite attempt)
    const now = new Date().toISOString();
    await supabase
      .from('customer_invitations')
      .update({ status: 'revoked', updated_at: now })
      .eq('customer_id', customerId)
      .eq('status', 'pending');

    // Resolve optional target_profile_id by exact email (0 or many → null; 1 → set)
    const targetProfileId = await resolveSoleTargetProfileIdByEmail(email);

    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('id, trading_name, legal_name')
      .eq('id', companyId)
      .maybeSingle();

    const sellerCompanyName =
      sellerProfile?.trading_name ||
      sellerProfile?.legal_name ||
      body.companyName ||
      'Your supplier';
    const contactName =
      (body.contactName ? String(body.contactName).trim() : null) ||
      customer.contact_name ||
      null;
    const customerName = customer.trading_name || customer.legal_name || 'Customer';
    const invitedBy = body.invitedBy ? String(body.invitedBy) : member.userId;
    const message = body.message ? String(body.message).trim() : null;
    const token = randomUUID();
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
      console.error('Customer invitation insert error:', invErr);
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
      console.error('Customer CRM invite_status update failed:', crmErr);
      crmWarning = `Invitation created (id=${invitation.id}) but CRM invite fields failed to update: ${crmErr.message}`;
    }

    const inviteLink = buildCustomerInviteLink(token);

    let emailWarning: string | undefined;
    try {
      const resend = getResend();
      const { error: emailError } = await resend.emails.send({
        from: 'SupplierAdvisor <onboarding@resend.dev>',
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
        console.error('Customer invite email error:', emailError);
        emailWarning = `Invitation created but email failed to send: ${emailError.message}`;
      }
    } catch (emailErr: unknown) {
      const msg = emailErr instanceof Error ? emailErr.message : 'Email failed';
      console.error('Customer invite email exception:', emailErr);
      emailWarning = `Invitation created but email failed: ${msg}`;
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: member.userId,
      action: 'customer.invite.sent',
      entity_type: 'customer',
      entity_id: String(customerId),
      summary: `Invited ${customerName} to platform`,
      metadata: {
        invitation_id: invitation.id,
        email,
        target_profile_id: targetProfileId,
      },
    });

    const warning = [crmWarning, emailWarning].filter(Boolean).join(' ') || undefined;

    return NextResponse.json({
      success: true,
      message: warning ? undefined : 'Invitation sent successfully',
      warning,
      invitation,
      inviteLink,
      inviteToken: token,
      expiresInDays: INVITE_EXPIRY_DAYS,
    });
  } catch (e: unknown) {
    console.error('POST /api/customers/invites error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invite failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/customers/invites?companyId=&privyUserId=
 * List invitations for the seller company (membership required).
 * Tokens are never returned on the list (use POST create/resend inviteLink for copy).
 */
export async function GET(request: NextRequest) {
  try {
    if (!isCustomerInvitesEnabled()) {
      return NextResponse.json(
        { error: 'Customer invites are disabled', code: 'CUSTOMER_INVITES_DISABLED' },
        { status: 503 }
      );
    }

    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const privyUserId = sp.get('privyUserId');
    const status = sp.get('status');
    const customerId = sp.get('customerId') ? Number(sp.get('customerId')) : null;

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    const member = await assertCompanyMember(privyUserId, companyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();
    let query = supabase
      .from('customer_invitations')
      .select(CUSTOMER_INVITATION_LIST_COLUMNS)
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (customerId && Number.isFinite(customerId)) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('GET customer invites error:', error);
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Run supabase/migrations/20260709_customer_platform_invites.sql',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      invitations: data || [],
    });
  } catch (e: unknown) {
    console.error('GET /api/customers/invites error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to list invitations' },
      { status: 500 }
    );
  }
}
