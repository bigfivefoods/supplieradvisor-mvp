/**
 * When a desk adds a member/patient, attach their SA Member wallet
 * (email, phone, photo, family) and email a link to accept the practice.
 */
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import {
  loadB2cProfile,
  loadB2cProfileByEmail,
} from '@/lib/b2c/profile-store';
import type { B2cProfile } from '@/lib/b2c/types';
import { memberAppLink } from '@/lib/b2c/member-app';
import { linkPlatformUserId } from '@/lib/messaging/link-platform-user';
import {
  applySnapshotToPerson,
  snapshotFromProfile,
  type DeskPerson,
} from '@/lib/b2c/wallet-household';
import {
  buildServiceMemberInviteLink,
  buildServiceMemberPortalLink,
  defaultShareFlags,
  inviteExpiryIso,
  issueServiceMemberInviteToken,
  serviceMemberAdvisorName,
  serviceMemberInviteEmailHtml,
  serviceMemberInviteEmailText,
  type ServiceMemberInviteFields,
  type ServiceMemberModule,
} from '@/lib/services/member-invite';

export type DeskInvitePerson = DeskPerson &
  ServiceMemberInviteFields & {
    portal_token?: string | null;
  };

export function namesLikelySame(
  a?: string | null,
  b?: string | null
): boolean {
  const norm = (s: string) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ');
  const na = norm(a || '');
  const nb = norm(b || '');
  if (!na || !nb) return false;
  if (na === nb) return true;
  const pa = na.split(' ');
  const pb = nb.split(' ');
  if (pa[0] && pa[0] === pb[0] && (pa.length === 1 || pb.length === 1)) {
    return true;
  }
  return false;
}

export async function resolveWalletForDeskPerson(opts: {
  email?: string | null;
  name?: string | null;
  operatorUserId?: string | null;
}): Promise<B2cProfile | null> {
  const email = String(opts.email || '')
    .trim()
    .toLowerCase();
  if (email.includes('@')) {
    const byEmail = await loadB2cProfileByEmail(email);
    if (byEmail) return byEmail;
  }
  if (opts.operatorUserId) {
    const mine = await loadB2cProfile(opts.operatorUserId);
    if (mine) {
      const myEmail = String(mine.email || '')
        .trim()
        .toLowerCase();
      if (email && myEmail && email === myEmail) return mine;
      if (!email && namesLikelySame(opts.name, mine.full_name)) return mine;
      const emailLocal = myEmail.includes('@')
        ? myEmail.split('@')[0].replace(/[._]+/g, ' ')
        : '';
      if (!email && namesLikelySame(opts.name, emailLocal)) return mine;
      if (
        email &&
        namesLikelySame(opts.name, mine.full_name) &&
        !email.includes('@')
      ) {
        return mine;
      }
    }
  }
  return null;
}

export function applyWalletToDeskPerson<T extends DeskInvitePerson>(
  person: T,
  profile: B2cProfile
): T {
  const stamped = applySnapshotToPerson(person, snapshotFromProfile(profile), {
    preferWallet: true,
  }).person;
  if (profile.user_id) linkPlatformUserId(stamped, profile.user_id);
  if (profile.email && !stamped.email) stamped.email = profile.email;
  return stamped;
}

export async function sendDeskPersonInvite<T extends DeskInvitePerson>(opts: {
  person: T;
  module: ServiceMemberModule;
  companyId: number;
  email: string;
  businessName: string;
  invitedBy: string;
  issuePortalToken: () => string;
}): Promise<{
  person: T;
  invite_token: string;
  invite_link: string;
  portal_token: string;
  email_sent: boolean;
  warning?: string;
}> {
  const email = String(opts.email || '')
    .toLowerCase()
    .trim();
  const now = new Date().toISOString();
  const defaults = defaultShareFlags(opts.module);
  const inviteToken = issueServiceMemberInviteToken(opts.module, opts.companyId);
  const person = { ...opts.person };
  if (!person.portal_token) person.portal_token = opts.issuePortalToken();
  person.email = email;
  person.invite_token = inviteToken;
  person.invite_status = 'pending';
  person.invite_email = email;
  person.invite_sent_at = now;
  person.invite_accepted_at = null;
  person.invite_expires_at = inviteExpiryIso(14);
  person.share_schedule =
    person.share_schedule !== false ? true : defaults.share_schedule;
  person.share_feedback =
    person.share_feedback !== false ? true : defaults.share_feedback;
  if (opts.module !== 'fitgraph') {
    person.share_medical = person.share_medical !== false;
  }
  person.updated_at = now;

  const inviteLink = buildServiceMemberInviteLink(opts.module, inviteToken);
  const appLink = memberAppLink(person.portal_token);
  const advisor = serviceMemberAdvisorName(opts.module);

  let warning: string | undefined;
  try {
    const resend = getResend();
    const { error: emailError } = await resend.emails.send({
      from: getResendFrom(),
      replyTo: getResendReplyTo(),
      to: email,
      subject: `${opts.businessName} invited you to ${advisor}`,
      html: serviceMemberInviteEmailHtml({
        inviteeName: person.name,
        businessName: opts.businessName,
        invitedBy: opts.invitedBy,
        inviteLink,
        module: opts.module,
        memberAppLink: appLink,
      }),
      text: serviceMemberInviteEmailText({
        inviteeName: person.name,
        businessName: opts.businessName,
        invitedBy: opts.invitedBy,
        inviteLink,
        module: opts.module,
        memberAppLink: appLink,
      }),
    });
    if (emailError) {
      warning = `Invite saved but email failed: ${emailError.message}`;
    }
  } catch (emailErr: unknown) {
    const msg = emailErr instanceof Error ? emailErr.message : 'Email failed';
    warning = `Invite saved but email failed: ${msg}`;
  }

  return {
    person,
    invite_token: inviteToken,
    invite_link: inviteLink,
    portal_token: person.portal_token!,
    email_sent: !warning,
    warning,
  };
}

export async function attachWalletAndMaybeInvite<T extends DeskInvitePerson>(opts: {
  person: T;
  operatorUserId?: string | null;
  sendInvite: boolean;
  module: ServiceMemberModule;
  companyId: number;
  businessName: string;
  invitedBy: string;
  issuePortalToken: () => string;
}): Promise<{
  person: T;
  wallet_linked: boolean;
  invite?: Awaited<ReturnType<typeof sendDeskPersonInvite<T>>>;
}> {
  let person = opts.person;
  const wallet = await resolveWalletForDeskPerson({
    email: person.email,
    name: person.name,
    operatorUserId: opts.operatorUserId,
  });
  if (wallet) person = applyWalletToDeskPerson(person, wallet);
  const email = String(person.email || person.invite_email || '')
    .toLowerCase()
    .trim();
  let invite: Awaited<ReturnType<typeof sendDeskPersonInvite<T>>> | undefined;
  if (opts.sendInvite && email.includes('@')) {
    invite = await sendDeskPersonInvite({
      person,
      module: opts.module,
      companyId: opts.companyId,
      email,
      businessName: opts.businessName,
      invitedBy: opts.invitedBy,
      issuePortalToken: opts.issuePortalToken,
    });
    person = invite.person;
  }
  return { person, wallet_linked: Boolean(wallet), invite };
}

export function portalPathForModule(
  module: ServiceMemberModule,
  token: string
): string {
  return buildServiceMemberPortalLink(module, token).replace(
    /^https?:\/\/[^/]+/,
    ''
  );
}
