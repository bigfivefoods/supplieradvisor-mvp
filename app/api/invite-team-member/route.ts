import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getAppUrl, getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import { buildTeamInviteLink, teamInviteEmailHtml } from '@/lib/invites/email';
import { INVITE_EXPIRY_DAYS, getCanonicalUserId } from '@/lib/auth/identity';
import { assertCanManageTeam } from '@/lib/business/access';
import {
  normalizeTeamRole,
  TEAM_ROLE_OPTIONS,
} from '@/lib/business/permissions';
import { logActivity } from '@/lib/customers/access';

/**
 * POST /api/invite-team-member
 * Body: { companyId, privyUserId, email, name?, role?, companyName?, inviterName? }
 *
 * Creates/refreshes a business_users invite row and sends email via Resend.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const privyUserId = body.privyUserId || body.invitedBy;
    const name = body.name ? String(body.name).trim() : '';
    const normalizedEmail = String(body.email || '')
      .toLowerCase()
      .trim();
    const role = normalizeTeamRole(body.role || 'member');

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    // Owners/admins only
    const mem = await assertCanManageTeam(privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    // Viewers cannot be assigned as owner via invite (safety)
    if (role === 'owner' && mem.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only an owner can invite another owner.' },
        { status: 403 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        {
          error: 'Email is not configured',
          hint: 'Set RESEND_API_KEY on the server (Vercel env).',
        },
        { status: 503 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const resend = getResend();
    const token = randomUUID();
    const now = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const inviterId = getCanonicalUserId(privyUserId) || String(privyUserId || '');

    // Company display name
    let displayCompany = String(body.companyName || '').trim();
    if (!displayCompany) {
      const { data: company } = await supabaseAdmin
        .from('profiles')
        .select('trading_name, legal_name')
        .eq('id', companyId)
        .maybeSingle();
      displayCompany =
        company?.trading_name || company?.legal_name || 'your company';
    }

    // Avoid duplicate active memberships
    const { data: existingRows, error: listErr } = await supabaseAdmin
      .from('business_users')
      .select('id, status, invited_email, email, role, user_id')
      .eq('profile_id', companyId);

    if (listErr) {
      console.error('Team invite list error:', listErr);
      return NextResponse.json(
        {
          error: 'Could not load team members',
          details: listErr.message,
          hint: 'Run supabase/migrations/20260710_team_invites_permissions.sql',
        },
        { status: 500 }
      );
    }

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

    const invitePayload: Record<string, unknown> = {
      name: name || null,
      email: normalizedEmail,
      invited_email: normalizedEmail,
      role,
      status: 'invited',
      invited_by: inviterId,
      invite_token: token,
      invited_at: now,
      expires_at: expiresAt,
      updated_at: now,
    };

    let memberId: number | null = existing?.id ? Number(existing.id) : null;

    if (existing && ['invited', 'pending', 'removed'].includes(String(existing.status || ''))) {
      const { data: refreshed, error: refreshError } = await supabaseAdmin
        .from('business_users')
        .update(invitePayload)
        .eq('id', existing.id)
        .select('id')
        .single();

      if (refreshError) {
        console.error('Team invite refresh error:', refreshError);
        return NextResponse.json(
          {
            error: 'Failed to refresh invitation',
            details: refreshError.message,
            hint:
              /column|invite_token/i.test(refreshError.message || '')
                ? 'Run supabase/migrations/20260710_team_invites_permissions.sql to add invite_token'
                : undefined,
          },
          { status: 500 }
        );
      }
      memberId = refreshed?.id ? Number(refreshed.id) : memberId;
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('business_users')
        .insert({
          profile_id: companyId,
          ...invitePayload,
          created_at: now,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Team invite insert error:', insertError);
        return NextResponse.json(
          {
            error: 'Failed to create invitation',
            details: insertError.message,
            code: insertError.code,
            hint:
              /column|invite_token|schema/i.test(insertError.message || '')
                ? 'Run supabase/migrations/20260710_team_invites_permissions.sql'
                : undefined,
          },
          { status: 500 }
        );
      }
      memberId = inserted?.id ? Number(inserted.id) : null;
    }

    const inviteLink = buildTeamInviteLink(token);
    const roleLabel =
      TEAM_ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
    const inviterName =
      String(body.inviterName || '').trim() || mem.name || 'Your team';

    let emailId: string | null = null;
    try {
      const { data: emailData, error: emailError } = await resend.emails.send({
        from: getResendFrom(),
        replyTo: getResendReplyTo(),
        to: normalizedEmail,
        subject: `Join ${displayCompany} on SupplierAdvisor`,
        html: teamInviteEmailHtml({
          inviteeName: name || null,
          companyName: displayCompany,
          role: roleLabel,
          invitedBy: inviterName,
          inviteLink,
        }),
        tags: [
          { name: 'type', value: 'team_invite' },
          { name: 'company_id', value: String(companyId) },
        ],
      });

      if (emailError) {
        console.error('Team invite email error:', emailError);
        return NextResponse.json(
          {
            error: 'Invitation saved but email failed to send',
            details:
              typeof emailError === 'object' && emailError && 'message' in emailError
                ? String((emailError as { message?: string }).message)
                : String(emailError),
            inviteLink,
            token,
            memberId,
            appUrl: getAppUrl(),
            from: getResendFrom(),
            hint:
              'Check RESEND_API_KEY and that RESEND_FROM_EMAIL uses a verified domain. You can still share the invite link.',
          },
          { status: 502 }
        );
      }
      emailId = emailData?.id || null;
    } catch (sendErr: unknown) {
      console.error('Team invite Resend throw:', sendErr);
      return NextResponse.json(
        {
          error: 'Invitation saved but email failed to send',
          details: sendErr instanceof Error ? sendErr.message : String(sendErr),
          inviteLink,
          token,
          memberId,
          from: getResendFrom(),
          hint: 'Verify RESEND_API_KEY and RESEND_FROM_EMAIL on Vercel.',
        },
        { status: 502 }
      );
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'business.team_invited',
      entity_type: 'business_users',
      entity_id: memberId ? String(memberId) : undefined,
      summary: `Invited ${normalizedEmail} as ${role}`,
      metadata: { email: normalizedEmail, role, emailId, expiresAt },
    });

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${normalizedEmail}`,
      inviteLink,
      expiresAt,
      memberId,
      role,
      emailId,
      from: getResendFrom(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Team invite error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: message,
        hint:
          /RESEND_API_KEY|Missing/i.test(message)
            ? 'Configure RESEND_API_KEY and RESEND_FROM_EMAIL in Vercel'
            : /SUPABASE_SERVICE_ROLE/i.test(message)
              ? 'Configure SUPABASE_SERVICE_ROLE_KEY for invite writes'
              : undefined,
      },
      { status: 500 }
    );
  }
}
