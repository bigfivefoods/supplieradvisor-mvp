import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import { businessInviteEmailHtml, buildBusinessInviteLink } from '@/lib/invites/email';
import { INVITE_EXPIRY_DAYS } from '@/lib/auth/identity';
import {
  assertCompanyMember,
  checkSupplierInviteRateLimits,
  isSupplierInvitesEnabled,
  SUPPLIER_INVITATION_LIST_COLUMNS,
} from '@/lib/suppliers/access';
import { resolveSoleTargetProfileIdByEmail, logActivity } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';
import { referredByInsertField } from '@/lib/billing/supply-chain-referral';

/**
 * GET ?companyId=&privyUserId= — list supplier invitations (no tokens)
 */
export async function GET(request: NextRequest) {
  try {
    if (!isSupplierInvitesEnabled()) {
      return NextResponse.json({ error: 'Supplier invites disabled' }, { status: 403 });
    }
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('supplier_invitations')
      .select(SUPPLIER_INVITATION_LIST_COLUMNS)
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({
        success: true,
        invitations: [],
        warning: error.message,
        hint: 'Run 20260709_srm_supplier_module.sql',
      });
    }
    return NextResponse.json({ success: true, invitations: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * POST — create/update book entry + send platform invite so supplier can take over.
 * Body: companyId, privyUserId, trading_name, contact_email, contact_name?, supplier_id?, message?
 */
export async function POST(request: NextRequest) {
  try {
    if (!isSupplierInvitesEnabled()) {
      return NextResponse.json({ error: 'Supplier invites disabled' }, { status: 403 });
    }
    const body = await request.json();
    const companyId = Number(body.companyId);
    const email = String(body.contact_email || body.email || '')
      .toLowerCase()
      .trim();
    const tradingName = String(body.trading_name || body.company_name || '').trim();

    if (!Number.isFinite(companyId) || !email || !tradingName) {
      return NextResponse.json(
        { error: 'companyId, trading_name, and contact_email required' },
        { status: 400 }
      );
    }

    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });

    const supabase = getSupabaseServer();
    let supplierId = body.supplier_id ? Number(body.supplier_id) : null;

    // Ensure srm_suppliers row
    if (!supplierId) {
      const { data: created, error: cErr } = await supabase
        .from('srm_suppliers')
        .insert({
          profile_id: companyId,
          trading_name: tradingName,
          legal_name: body.legal_name || tradingName,
          email,
          phone: body.contact_phone || body.phone || null,
          contact_name: body.contact_name || null,
          website: body.website || null,
          industry: body.industry || null,
          category: body.category || null,
          city: body.city || null,
          country: body.country || 'South Africa',
          status: 'prospect',
          invite_status: 'not_invited',
          created_by: mem.userId,
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (cErr) {
        return NextResponse.json(
          { error: cErr.message, hint: 'Run 20260709_srm_supplier_module.sql' },
          { status: 500 }
        );
      }
      supplierId = Number(created.id);
    }

    const limits = await checkSupplierInviteRateLimits({
      companyId,
      supplierId,
      replacingSupplierPending: true,
    });
    if (!limits.ok) {
      return NextResponse.json({ error: limits.error }, { status: limits.status });
    }

    // Revoke prior pending for this supplier
    await supabase
      .from('supplier_invitations')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('supplier_id', supplierId)
      .eq('status', 'pending');

    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
    const targetProfileId = await resolveSoleTargetProfileIdByEmail(email);

    const { data: inv, error: invErr } = await supabase
      .from('supplier_invitations')
      .insert({
        profile_id: companyId,
        supplier_id: supplierId,
        email,
        full_name: body.contact_name || null,
        company_name: tradingName,
        message: body.message || null,
        token,
        status: 'pending',
        target_profile_id: targetProfileId,
        invited_by: body.invitedBy || body.invited_by || 'Buyer',
        invited_by_user_id: mem.userId,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(SUPPLIER_INVITATION_LIST_COLUMNS)
      .single();

    if (invErr) {
      return NextResponse.json({ error: invErr.message }, { status: 500 });
    }

    // Also create a claimable profile shell so existing /onboarding?invite= works
    // AND keep srm book as source of truth for the buyer.
    // Inviting buyer is L1 referrer for subscription fees when this supplier pays
    const { data: shell } = await supabase
      .from('profiles')
      .insert({
        trading_name: tradingName,
        legal_name: tradingName,
        email,
        contact_name: body.contact_name || null,
        contact_phone: body.contact_phone || body.phone || null,
        website: body.website || null,
        category: body.category || null,
        industry: body.industry || null,
        relationship_type: 'supplier',
        supplier_status: 'invited',
        invite_token: token,
        invited_by: body.invitedBy || 'Buyer',
        invited_at: new Date().toISOString(),
        ...referredByInsertField(companyId),
      })
      .select('id')
      .maybeSingle();

    if (shell?.id) {
      await supabase
        .from('srm_suppliers')
        .update({
          linked_profile_id: shell.id,
          invite_status: 'invited',
          invite_token: token,
          invited_at: new Date().toISOString(),
          invited_email: email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', supplierId);
    } else {
      await supabase
        .from('srm_suppliers')
        .update({
          invite_status: 'invited',
          invite_token: token,
          invited_at: new Date().toISOString(),
          invited_email: email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', supplierId);
    }

    const inviteLink = buildBusinessInviteLink(token);
    let emailWarning: string | undefined;
    try {
      const resend = getResend();
      const { error: emailError } = await resend.emails.send({
        from: getResendFrom(),
        replyTo: getResendReplyTo(),
        to: email,
        subject: `${body.invitedBy || 'A buyer'} invited you to SupplierAdvisor`,
        html: businessInviteEmailHtml({
          inviteeName: body.contact_name,
          businessName: tradingName,
          invitedBy: body.invitedBy || 'A buyer on SupplierAdvisor',
          inviteLink,
        }),
      });
      if (emailError) emailWarning = emailError.message;
    } catch (err) {
      emailWarning = err instanceof Error ? err.message : 'Email send failed';
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'supplier.invite_sent',
      entity_type: 'supplier_invitations',
      entity_id: String(inv.id),
      summary: `Invited supplier ${tradingName} (${email})`,
      metadata: { supplierId, targetProfileId },
    });

    const goldenPath = await import('@/lib/onboarding/checklist').then(
      ({ afterPartnerNetworkEvent }) => afterPartnerNetworkEvent(companyId)
    );

    return NextResponse.json({
      success: true,
      invitation: inv,
      supplierId,
      inviteLink,
      expiresInDays: INVITE_EXPIRY_DAYS,
      goldenPath,
      warning: emailWarning
        ? 'Invite created but email failed — share the link manually.'
        : undefined,
      emailDetails: emailWarning,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * PATCH — resend | revoke
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const action = String(body.action || '');
    const invitationId = Number(body.invitationId || body.id);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    if (!Number.isFinite(invitationId)) {
      return NextResponse.json({ error: 'invitationId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: inv, error } = await supabase
      .from('supplier_invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('profile_id', companyId)
      .maybeSingle();
    if (error || !inv) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (action === 'revoke') {
      await supabase
        .from('supplier_invitations')
        .update({ status: 'revoked', updated_at: new Date().toISOString() })
        .eq('id', invitationId);
      if (inv.supplier_id) {
        await supabase
          .from('srm_suppliers')
          .update({ invite_status: 'not_invited', invite_token: null, updated_at: new Date().toISOString() })
          .eq('id', inv.supplier_id)
          .eq('invite_status', 'invited');
      }
      return NextResponse.json({ success: true, status: 'revoked' });
    }

    if (action === 'resend') {
      if (inv.status !== 'pending') {
        return NextResponse.json({ error: 'Only pending invites can be resent' }, { status: 400 });
      }
      const limits = await checkSupplierInviteRateLimits({
        companyId,
        supplierId: inv.supplier_id,
        replacingSupplierPending: true,
      });
      if (!limits.ok) {
        return NextResponse.json({ error: limits.error }, { status: limits.status });
      }

      const token = randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

      // mark old revoked, insert new
      await supabase
        .from('supplier_invitations')
        .update({ status: 'revoked', updated_at: new Date().toISOString() })
        .eq('id', invitationId);

      const { data: fresh, error: insErr } = await supabase
        .from('supplier_invitations')
        .insert({
          profile_id: companyId,
          supplier_id: inv.supplier_id,
          email: inv.email,
          full_name: inv.full_name,
          company_name: inv.company_name,
          message: inv.message,
          token,
          status: 'pending',
          target_profile_id: inv.target_profile_id,
          invited_by: inv.invited_by,
          invited_by_user_id: mem.userId,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select(SUPPLIER_INVITATION_LIST_COLUMNS)
        .single();
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

      // rotate token on shell profile if present
      await supabase
        .from('profiles')
        .update({ invite_token: token, invited_at: new Date().toISOString() })
        .eq('invite_token', inv.token);

      if (inv.supplier_id) {
        await supabase
          .from('srm_suppliers')
          .update({
            invite_token: token,
            invited_at: new Date().toISOString(),
            invite_status: 'invited',
            updated_at: new Date().toISOString(),
          })
          .eq('id', inv.supplier_id);
      }

      const inviteLink = buildBusinessInviteLink(token);
      try {
        const resend = getResend();
        await resend.emails.send({
          from: getResendFrom(),
        replyTo: getResendReplyTo(),
          to: inv.email,
          subject: `Reminder: join SupplierAdvisor`,
          html: businessInviteEmailHtml({
            inviteeName: inv.full_name,
            businessName: inv.company_name || 'your company',
            invitedBy: inv.invited_by || 'A buyer',
            inviteLink,
          }),
        });
      } catch {
        /* link still valid */
      }

      return NextResponse.json({ success: true, invitation: fresh, inviteLink });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
