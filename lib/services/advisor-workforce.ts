/**
 * Advisor workforce access.
 *
 * Coaches / clinicians (employed or contractor) → work PWA only.
 * The company OS is for owners. An owner who also coaches uses both:
 * Switch to business (workspace) and I work here (staff PWA).
 * Front desk may still be invited to the B2B workspace separately.
 */
import { getAppUrl, getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import { renderAdvisorNoticeEmail } from '@/lib/services/advisor-branded-email';

export const ADVISOR_WORKFORCE_MODULES = [
  'fitgraph',
  'physiograph',
  'dentalgraph',
  'medicalgraph',
  'psychiatrygraph',
  'hiregraph',
  'retailgraph',
] as const;

export type AdvisorWorkforceModule = (typeof ADVISOR_WORKFORCE_MODULES)[number];

export type AdvisorEngagement = 'employed' | 'contractor';
export type AdvisorAccessLane = 'b2b' | 'b2c';
export type AdvisorWorkInviteStatus =
  | 'none'
  | 'pending'
  | 'accepted'
  | 'revoked'
  | 'expired';

export const ADVISOR_WORK_INVITE_STATUSES = [
  'none',
  'pending',
  'accepted',
  'revoked',
  'expired',
] as const;

export function isAdvisorWorkforceModule(
  raw: string | null | undefined
): raw is AdvisorWorkforceModule {
  return (ADVISOR_WORKFORCE_MODULES as readonly string[]).includes(
    String(raw || '')
  );
}

export function accessLaneForEngagement(
  _engagement?: AdvisorEngagement | string | null
): AdvisorAccessLane {
  return 'b2c';
}

export function resolveAdvisorEngagement(person: {
  engagement?: string | null;
  hr_employee_id?: number | null;
  employment_type?: string | null;
}): AdvisorEngagement {
  const raw = String(person.engagement || person.employment_type || '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (
    raw === 'employed' ||
    raw === 'permanent' ||
    raw === 'full_time' ||
    raw === 'part_time' ||
    raw === 'staff'
  ) {
    return 'employed';
  }
  if (
    raw === 'contractor' ||
    raw === 'contract' ||
    raw === 'independent' ||
    raw === 'freelance'
  ) {
    return 'contractor';
  }
  if (person.hr_employee_id) return 'employed';
  return 'contractor';
}

export type AdvisorDeskInviteFields = {
  has_front_desk?: boolean;
  desk_name?: string;
  desk_email?: string | null;
  desk_invite_status?: AdvisorWorkInviteStatus | string | null;
  desk_invite_sent_at?: string | null;
  desk_invite_accepted_at?: string | null;
  desk_team_member_id?: number | null;
  desk_last_invited_email?: string | null;
};

export type AdvisorPersonInviteFields = {
  engagement?: AdvisorEngagement;
  work_invite_token?: string | null;
  work_invite_status?: AdvisorWorkInviteStatus | string | null;
  work_invite_email?: string | null;
  work_invite_sent_at?: string | null;
  work_invite_accepted_at?: string | null;
  work_team_member_id?: number | null;
};

const MODULE_SHORT: Record<AdvisorWorkforceModule, string> = {
  fitgraph: 'fit',
  physiograph: 'phy',
  dentalgraph: 'den',
  medicalgraph: 'med',
  psychiatrygraph: 'psy',
  hiregraph: 'hir',
  retailgraph: 'ret',
};

const MODULE_LABEL: Record<AdvisorWorkforceModule, string> = {
  fitgraph: 'GymAdvisor®',
  physiograph: 'PhysioAdvisor®',
  dentalgraph: 'DentalAdvisor®',
  medicalgraph: 'MedicalAdvisor®',
  psychiatrygraph: 'PsychiatryAdvisor®',
  hiregraph: 'HireAdvisor®',
  retailgraph: 'RetailAdvisor®',
};

export function advisorWorkforceLabel(module: AdvisorWorkforceModule): string {
  return MODULE_LABEL[module];
}

export function issueAdvisorWorkInviteToken(
  module: AdvisorWorkforceModule,
  companyId: number
): string {
  return `winv_${MODULE_SHORT[module]}_${companyId}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

export function parseAdvisorWorkInviteToken(token: string): {
  module: AdvisorWorkforceModule | null;
  companyId: number | null;
} {
  const m = /^winv_(fit|phy|den|med|psy|hir|ret)_(\d+)_/.exec(
    String(token || '').trim()
  );
  if (!m) return { module: null, companyId: null };
  const map: Record<string, AdvisorWorkforceModule> = {
    fit: 'fitgraph',
    phy: 'physiograph',
    den: 'dentalgraph',
    med: 'medicalgraph',
    psy: 'psychiatrygraph',
    hir: 'hiregraph',
    ret: 'retailgraph',
  };
  const companyId = Number(m[2]);
  return {
    module: map[m[1]] || null,
    companyId: Number.isFinite(companyId) ? companyId : null,
  };
}

export function buildAdvisorWorkJoinLink(
  module: AdvisorWorkforceModule,
  token: string
): string {
  const base = getAppUrl().replace(/\/$/, '');
  return `${base}/join/work/${encodeURIComponent(module)}/${encodeURIComponent(token)}`;
}

export function advisorWorkInviteShareText(opts: {
  personName?: string | null;
  businessName: string;
  inviteLink: string;
  lane: AdvisorAccessLane;
  roleLabel: string;
}): string {
  const first =
    (opts.personName || '').trim().split(/\s+/)[0] || 'there';
  const brand = (opts.businessName || '').trim() || 'the practice';
  const role = opts.roleLabel || 'the team';
  if (opts.lane === 'b2b') {
    return [
      `Hi ${first},`,
      ``,
      `${brand} invited you to join the ${role} workspace on SupplierAdvisor.`,
      ``,
      `Open this link to accept:`,
      opts.inviteLink,
    ].join('\n');
  }
  return [
    `Hi ${first},`,
    ``,
    `${brand} invited you as a ${role} — manage your diary and clients on your phone.`,
    ``,
    `Open this link to join the work app:`,
    opts.inviteLink,
  ].join('\n');
}

export function buildAdvisorWorkPortalPath(
  module: AdvisorWorkforceModule,
  portalToken: string
): string {
  if (module === 'fitgraph') {
    return `/coach/fitgraph/${encodeURIComponent(portalToken)}`;
  }
  if (module === 'hiregraph' || module === 'retailgraph') {
    return `/staff/advisor/${encodeURIComponent(module)}/${encodeURIComponent(portalToken)}`;
  }
  return `/clinician/${encodeURIComponent(module)}/${encodeURIComponent(portalToken)}`;
}

export function buildAdvisorStaffTodayPath(
  module: AdvisorWorkforceModule,
  portalToken: string
): string {
  return `/staff/advisor/${encodeURIComponent(module)}/${encodeURIComponent(portalToken)}`;
}

export function inviteExpiryIso(days = 14): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function contractorWorkInviteEmailHtml(opts: {
  inviteeName?: string | null;
  businessName: string;
  invitedBy: string;
  inviteLink: string;
  module: AdvisorWorkforceModule;
  roleLabel: string;
  logoUrl?: string | null;
}): string {
  const name = escapeHtml(opts.inviteeName || '');
  const brand = escapeHtml(opts.businessName);
  const by = escapeHtml(opts.invitedBy);
  const role = escapeHtml(opts.roleLabel);
  return renderAdvisorNoticeEmail({
    personName: opts.inviteeName,
    brand: opts.businessName,
    logoUrl: opts.logoUrl,
    moduleKey: opts.module,
    subject: `${opts.businessName} — your ${opts.roleLabel} work app`,
    headline: 'Your work app is ready',
    leadHtml: `Hello${name ? ` ${name}` : ''}, <strong>${by}</strong> invited you as a <strong>${role}</strong> at <strong>${brand}</strong>. Add this to your phone home screen — today’s board, diary, roster and messages, no desktop login required.`,
    extraHtml: `<p style="margin:12px 0 0;font-size:12px;color:#64748b;word-break:break-all;">${escapeHtml(opts.inviteLink)}</p>`,
    ctaUrl: opts.inviteLink,
    ctaLabel: 'Open work app',
  }).html;
}

export function contractorWorkInviteEmailText(opts: {
  inviteeName?: string | null;
  businessName: string;
  invitedBy: string;
  inviteLink: string;
  roleLabel: string;
}): string {
  const name = opts.inviteeName ? ` ${opts.inviteeName}` : '';
  return [
    `Hello${name},`,
    '',
    `${opts.invitedBy} invited you as ${opts.roleLabel} at ${opts.businessName}.`,
    '',
    'Open your work app (add it to your home screen):',
    opts.inviteLink,
    '',
    '— SupplierAdvisor',
  ].join('\n');
}

export async function sendContractorWorkInviteEmail(opts: {
  to: string;
  inviteeName?: string | null;
  businessName: string;
  invitedBy: string;
  inviteLink: string;
  module: AdvisorWorkforceModule;
  roleLabel: string;
}): Promise<{ sent: boolean; warning?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, warning: 'Email is not configured — copy the join link' };
  }
  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: getResendFrom(),
      replyTo: getResendReplyTo(),
      to: opts.to,
      subject: `${opts.businessName} — your ${opts.roleLabel} work app`,
      html: contractorWorkInviteEmailHtml(opts),
      text: contractorWorkInviteEmailText(opts),
    });
    if (error) return { sent: false, warning: error.message };
    return { sent: true };
  } catch (e) {
    return {
      sent: false,
      warning: e instanceof Error ? e.message : 'Email failed',
    };
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function applyPersonWorkInvite<T extends AdvisorPersonInviteFields>(
  person: T,
  patch: Partial<AdvisorPersonInviteFields>
): T {
  return { ...person, ...patch };
}

/** Keep invite fields across desk upserts unless the record sets them. */
export function mergePersonInviteFromRecord(
  prev: AdvisorPersonInviteFields | null | undefined,
  rec: Record<string, unknown>
): AdvisorPersonInviteFields {
  const engagementRaw = rec.engagement != null ? String(rec.engagement) : '';
  const engagement: AdvisorEngagement | undefined =
    engagementRaw === 'employed' || engagementRaw === 'contractor'
      ? engagementRaw
      : prev?.engagement;
  return {
    engagement,
    work_invite_token:
      rec.work_invite_token !== undefined
        ? rec.work_invite_token
          ? String(rec.work_invite_token)
          : null
        : prev?.work_invite_token ?? null,
    work_invite_status:
      rec.work_invite_status !== undefined
        ? rec.work_invite_status
          ? String(rec.work_invite_status)
          : null
        : prev?.work_invite_status ?? null,
    work_invite_email:
      rec.work_invite_email !== undefined
        ? rec.work_invite_email
          ? String(rec.work_invite_email)
          : null
        : prev?.work_invite_email ?? null,
    work_invite_sent_at:
      rec.work_invite_sent_at !== undefined
        ? rec.work_invite_sent_at
          ? String(rec.work_invite_sent_at)
          : null
        : prev?.work_invite_sent_at ?? null,
    work_invite_accepted_at:
      rec.work_invite_accepted_at !== undefined
        ? rec.work_invite_accepted_at
          ? String(rec.work_invite_accepted_at)
          : null
        : prev?.work_invite_accepted_at ?? null,
    work_team_member_id:
      rec.work_team_member_id !== undefined
        ? rec.work_team_member_id
          ? Number(rec.work_team_member_id)
          : null
        : prev?.work_team_member_id ?? null,
  };
}

export function stampDeskInvite<T extends AdvisorDeskInviteFields>(
  settings: T,
  patch: Partial<AdvisorDeskInviteFields>
): T {
  return { ...settings, ...patch };
}
