/**
 * Create / refresh a B2B workspace invite and email the join link.
 * Used by Team and by Advisor desk / employed-staff invites.
 */
import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getAppUrl, getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import {
  buildTeamInviteLink,
  teamInviteEmailHtml,
  teamInviteEmailText,
} from '@/lib/invites/email';
import { INVITE_EXPIRY_DAYS } from '@/lib/auth/identity';
import {
  canAppearInCompanySwitcher,
  normalizeTeamRole,
  TEAM_ROLE_OPTIONS,
  type TeamRole,
} from '@/lib/business/permissions';

export async function sendTeamWorkspaceInvite(opts: {
  companyId: number;
  email: string;
  name?: string;
  role?: TeamRole | string;
  inviterUserId: string;
  inviterName?: string;
  companyName?: string;
  /** Override the role label in the email (e.g. Front desk) */
  roleLabel?: string;
  /** Create the join link without sending email (WhatsApp / copy). */
  skipEmail?: boolean;
}): Promise<
  | {
      ok: true;
      memberId: number | null;
      inviteLink: string;
      emailSent: boolean;
      warning?: string;
    }
  | { ok: false; error: string; status: number }
> {
  const email = String(opts.email || '')
    .toLowerCase()
    .trim();
  if (!email.includes('@')) {
    return { ok: false, error: 'A valid email is required', status: 400 };
  }
  const role = normalizeTeamRole(opts.role || 'operations');
  const supabaseAdmin = getSupabaseAdmin();
  const token = randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: company } = await supabaseAdmin
    .from('profiles')
    .select('trading_name, legal_name, logo_url')
    .eq('id', opts.companyId)
    .maybeSingle();
  const displayCompany =
    String(opts.companyName || '').trim() ||
    company?.trading_name ||
    company?.legal_name ||
    'your company';
  const logoUrl = String(company?.logo_url || '').trim() || null;

  const { data: existingRows, error: listErr } = await supabaseAdmin
    .from('business_users')
    .select('id, status, invited_email, email, role, user_id')
    .eq('profile_id', opts.companyId);
  if (listErr) {
    return { ok: false, error: listErr.message, status: 500 };
  }

  const existing = (existingRows || []).find((row) => {
    const e1 = (row.invited_email || '').toLowerCase();
    const e2 = (row.email || '').toLowerCase();
    return e1 === email || e2 === email;
  });

  if (existing?.status === 'active') {
    return {
      ok: true,
      memberId: existing.id ? Number(existing.id) : null,
      inviteLink: '',
      emailSent: false,
      warning: 'This person is already an active member of the workspace',
    };
  }

  const invitePayload: Record<string, unknown> = {
    name: opts.name || null,
    email,
    invited_email: email,
    role,
    status: 'invited',
    invited_by: opts.inviterUserId,
    invite_token: token,
    invited_at: now,
    expires_at: expiresAt,
    updated_at: now,
  };

  let memberId: number | null = existing?.id ? Number(existing.id) : null;
  if (
    existing &&
    ['invited', 'pending', 'removed', 'expired', 'suspended'].includes(
      String(existing.status || '')
    )
  ) {
    const { data: refreshed, error } = await supabaseAdmin
      .from('business_users')
      .update(invitePayload)
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error) return { ok: false, error: error.message, status: 500 };
    memberId = refreshed?.id ? Number(refreshed.id) : memberId;
  } else {
    const { data: inserted, error } = await supabaseAdmin
      .from('business_users')
      .insert({
        profile_id: opts.companyId,
        ...invitePayload,
        created_at: now,
      })
      .select('id')
      .single();
    if (error) return { ok: false, error: error.message, status: 500 };
    memberId = inserted?.id ? Number(inserted.id) : null;
  }

  const inviteLink = buildTeamInviteLink(token);
  const roleLabel =
    opts.roleLabel ||
    TEAM_ROLE_OPTIONS.find((r) => r.value === role)?.label ||
    role;
  const inviterName = String(opts.inviterName || '').trim() || 'Your team';

  let emailSent = false;
  let warning: string | undefined;
  if (opts.skipEmail) {
    warning = undefined;
  } else if (!process.env.RESEND_API_KEY) {
    warning = 'Invite saved but email is not configured — copy the join link';
  } else {
    try {
      const resend = getResend();
      const { error: emailError } = await resend.emails.send({
        from: getResendFrom(),
        replyTo: getResendReplyTo(),
        to: email,
        subject: `Join ${displayCompany} on SupplierAdvisor — your join link inside`,
        html: teamInviteEmailHtml({
          inviteeName: opts.name || null,
          companyName: displayCompany,
          role: roleLabel,
          invitedBy: inviterName,
          inviteLink,
          logoUrl,
        }),
        text: teamInviteEmailText({
          inviteeName: opts.name || null,
          companyName: displayCompany,
          role: roleLabel,
          invitedBy: inviterName,
          inviteLink,
        }),
        tags: [
          { name: 'type', value: 'team_invite' },
          { name: 'company_id', value: String(opts.companyId) },
        ],
      });
      if (emailError) {
        warning = `Invite saved but email failed: ${emailError.message}`;
      } else {
        emailSent = true;
      }
    } catch (e) {
      warning = `Invite saved but email failed: ${
        e instanceof Error ? e.message : 'send error'
      }`;
    }
  }

  void getAppUrl;
  return { ok: true, memberId, inviteLink, emailSent, warning };
}

export async function revokeTeamWorkspaceInvite(opts: {
  companyId: number;
  memberId?: number | null;
  email?: string | null;
}): Promise<{ ok: true; memberId?: number } | { ok: false; error: string }> {
  const supabaseAdmin = getSupabaseAdmin();
  let memberId = opts.memberId && Number(opts.memberId) > 0 ? Number(opts.memberId) : null;
  const email = String(opts.email || '')
    .toLowerCase()
    .trim();
  if (!memberId && email.includes('@')) {
    const { data: rows } = await supabaseAdmin
      .from('business_users')
      .select('id, invited_email, email, status')
      .eq('profile_id', opts.companyId);
    const hit = (rows || []).find((row) => {
      const e1 = (row.invited_email || '').toLowerCase();
      const e2 = (row.email || '').toLowerCase();
      return e1 === email || e2 === email;
    });
    if (hit?.id) memberId = Number(hit.id);
  }
  if (!memberId) return { ok: true };
  const { data: row } = await supabaseAdmin
    .from('business_users')
    .select('id, role')
    .eq('id', memberId)
    .eq('profile_id', opts.companyId)
    .maybeSingle();
  if (row && canAppearInCompanySwitcher(row.role ? String(row.role) : null)) {
    return { ok: true, memberId };
  }
  const { error } = await supabaseAdmin
    .from('business_users')
    .update({ status: 'removed', updated_at: new Date().toISOString() })
    .eq('id', memberId)
    .eq('profile_id', opts.companyId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, memberId };
}
