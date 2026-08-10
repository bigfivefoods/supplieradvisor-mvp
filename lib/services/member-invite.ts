/**
 * Service-module member/patient invites.
 * FitAdvisor clients · PhysioAdvisor / DentalAdvisor patients can be emailed a join
 * link to open their portal (classes, appointments, feedback, medical share).
 */
import { getAppUrl } from '@/lib/resend';

export type ServiceMemberModule =
  | 'fitgraph'
  | 'physiograph'
  | 'dentalgraph';

export const SERVICE_MEMBER_INVITE_STATUSES = [
  'none',
  'pending',
  'accepted',
  'revoked',
  'expired',
] as const;

export type ServiceMemberInviteStatus =
  (typeof SERVICE_MEMBER_INVITE_STATUSES)[number];

/** Shared invite fields stored on FitClient / PhysioPatient / DentalPatient */
export type ServiceMemberInviteFields = {
  invite_token?: string | null;
  invite_status?: ServiceMemberInviteStatus | string | null;
  invite_email?: string | null;
  invite_sent_at?: string | null;
  invite_accepted_at?: string | null;
  invite_expires_at?: string | null;
  /** When true (default for clinic), portal can show medical chart summary */
  share_medical?: boolean;
  /** When true (default for gym), portal shows classes & bookings */
  share_schedule?: boolean;
  /** When true (default), portal shows feedback prompts / history */
  share_feedback?: boolean;
};

const MODULE_SHORT: Record<ServiceMemberModule, string> = {
  fitgraph: 'fit',
  physiograph: 'phy',
  dentalgraph: 'den',
};

const MODULE_LABEL: Record<ServiceMemberModule, string> = {
  fitgraph: 'FitAdvisor® gym membership',
  physiograph: 'PhysioAdvisor® clinic patient portal',
  dentalgraph: 'DentalAdvisor® practice patient portal',
};

const MODULE_ROLE: Record<ServiceMemberModule, string> = {
  fitgraph: 'member / client',
  physiograph: 'patient',
  dentalgraph: 'patient',
};

const MODULE_PORTAL_PATH: Record<ServiceMemberModule, string> = {
  fitgraph: '/member/fitgraph',
  physiograph: '/member/physiograph',
  dentalgraph: '/member/dentalgraph',
};

export function isServiceMemberModule(
  raw: string | null | undefined
): raw is ServiceMemberModule {
  const m = String(raw || '').toLowerCase();
  return m === 'fitgraph' || m === 'physiograph' || m === 'dentalgraph';
}

/** Invite token embeds module short + company id for fast resolve. */
export function issueServiceMemberInviteToken(
  module: ServiceMemberModule,
  companyId: number
): string {
  const short = MODULE_SHORT[module];
  return `sinv_${short}_${companyId}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

export function parseServiceMemberInviteToken(token: string): {
  module: ServiceMemberModule | null;
  companyId: number | null;
} {
  const m = /^sinv_(fit|phy|den)_(\d+)_/.exec(String(token || '').trim());
  if (!m) return { module: null, companyId: null };
  const short = m[1];
  const companyId = Number(m[2]);
  const module =
    short === 'fit'
      ? 'fitgraph'
      : short === 'phy'
        ? 'physiograph'
        : short === 'den'
          ? 'dentalgraph'
          : null;
  return {
    module,
    companyId: Number.isFinite(companyId) ? companyId : null,
  };
}

export function buildServiceMemberInviteLink(
  module: ServiceMemberModule,
  token: string
): string {
  const base = getAppUrl().replace(/\/$/, '');
  return `${base}/join/member/${encodeURIComponent(module)}/${encodeURIComponent(token)}`;
}

export function buildServiceMemberPortalLink(
  module: ServiceMemberModule,
  portalToken: string
): string {
  const base = getAppUrl().replace(/\/$/, '');
  const path = MODULE_PORTAL_PATH[module];
  return `${base}${path}/${encodeURIComponent(portalToken)}`;
}

export function serviceMemberModuleLabel(module: ServiceMemberModule): string {
  return MODULE_LABEL[module];
}

export function serviceMemberRoleLabel(module: ServiceMemberModule): string {
  return MODULE_ROLE[module];
}

export function inviteExpiryIso(days = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function isInviteExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return false;
  return t < Date.now();
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function serviceMemberInviteEmailHtml(params: {
  inviteeName?: string | null;
  businessName: string;
  invitedBy: string;
  inviteLink: string;
  module: ServiceMemberModule;
}): string {
  const inviteeName = params.inviteeName
    ? escapeHtml(String(params.inviteeName))
    : null;
  const businessName = escapeHtml(String(params.businessName));
  const invitedBy = escapeHtml(String(params.invitedBy));
  const role = escapeHtml(MODULE_ROLE[params.module]);
  const product = escapeHtml(MODULE_LABEL[params.module]);
  const inviteLink = String(params.inviteLink || '').trim();
  const inviteLinkAttr = escapeHtml(inviteLink);
  const benefits =
    params.module === 'fitgraph'
      ? 'open class vacancies, book or join waitlists, see your bookings, leave class feedback, and update your member profile'
      : 'open appointment vacancies, book or join waitlists, see your visits, leave feedback, and view shared medical / clinical information';

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:620px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#00b4d8 0%,#0077b6 100%);padding:36px 40px;color:#fff;text-align:center;">
      <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;margin-bottom:8px;">SupplierAdvisor®</div>
      <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">You're invited as a ${role}</h1>
    </div>
    <div style="padding:36px 40px;">
      <p style="color:#334155;font-size:16px;line-height:1.7;margin:0 0 18px;">
        Hello${inviteeName ? ` ${inviteeName}` : ''},
      </p>
      <p style="color:#334155;font-size:16px;line-height:1.7;margin:0 0 18px;">
        <strong>${invitedBy}</strong> at <strong>${businessName}</strong> has invited you to join their
        <strong>${product}</strong> portal on SupplierAdvisor.
      </p>
      <p style="color:#334155;font-size:16px;line-height:1.7;margin:0 0 20px;">
        Once you accept, you can ${benefits}.
      </p>
      <div style="text-align:center;margin:24px 0 20px;">
        <a href="${inviteLinkAttr}" style="background:#00b4d8;color:#fff;padding:16px 40px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;">
          Accept invitation →
        </a>
      </div>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:14px;padding:16px 18px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#0369a1;">
          Your join link
        </p>
        <p style="margin:0;font-size:13px;line-height:1.55;word-break:break-all;">
          <a href="${inviteLinkAttr}" style="color:#0077b6;font-weight:600;">${inviteLinkAttr}</a>
        </p>
        <p style="margin:10px 0 0;font-size:12px;color:#64748b;line-height:1.5;">
          This link expires in 14 days. Use the same email this invitation was sent to.
        </p>
      </div>
    </div>
    <div style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;">
      SupplierAdvisor® · Verified. Transparent. Accelerating humanity.
    </div>
  </div>
</body>
</html>`;
}

export function serviceMemberInviteEmailText(params: {
  inviteeName?: string | null;
  businessName: string;
  invitedBy: string;
  inviteLink: string;
  module: ServiceMemberModule;
}): string {
  const name = params.inviteeName ? String(params.inviteeName).trim() : '';
  const link = String(params.inviteLink || '').trim();
  const role = MODULE_ROLE[params.module];
  const product = MODULE_LABEL[params.module];
  return [
    `Hello${name ? ` ${name}` : ''},`,
    '',
    `${params.invitedBy} at ${params.businessName} invited you as a ${role} on ${product}.`,
    '',
    'Accept your invitation (expires in 14 days):',
    link,
    '',
    'After accepting you can view schedules, book, share feedback, and (for clinics) see shared medical information.',
    '',
    '— SupplierAdvisor',
  ].join('\n');
}

/** Defaults applied when first inviting a member/patient */
export function defaultShareFlags(
  module: ServiceMemberModule
): Pick<
  ServiceMemberInviteFields,
  'share_medical' | 'share_schedule' | 'share_feedback'
> {
  if (module === 'fitgraph') {
    return {
      share_schedule: true,
      share_feedback: true,
      share_medical: false,
    };
  }
  return {
    share_schedule: true,
    share_feedback: true,
    share_medical: true,
  };
}

/**
 * Merge invite-related fields from a dashboard upsert patch onto a prior row.
 * Does not generate tokens — only persists explicit share/invite fields.
 */
export function mergeInviteFieldsFromRecord(
  prev: ServiceMemberInviteFields | null | undefined,
  rec: Record<string, unknown>
): ServiceMemberInviteFields {
  const out: ServiceMemberInviteFields = {
    invite_token:
      rec.invite_token !== undefined
        ? rec.invite_token
          ? String(rec.invite_token)
          : null
        : prev?.invite_token ?? null,
    invite_status:
      rec.invite_status !== undefined
        ? rec.invite_status
          ? String(rec.invite_status)
          : null
        : prev?.invite_status ?? null,
    invite_email:
      rec.invite_email !== undefined
        ? rec.invite_email
          ? String(rec.invite_email).toLowerCase().trim()
          : null
        : prev?.invite_email ?? null,
    invite_sent_at:
      rec.invite_sent_at !== undefined
        ? rec.invite_sent_at
          ? String(rec.invite_sent_at)
          : null
        : prev?.invite_sent_at ?? null,
    invite_accepted_at:
      rec.invite_accepted_at !== undefined
        ? rec.invite_accepted_at
          ? String(rec.invite_accepted_at)
          : null
        : prev?.invite_accepted_at ?? null,
    invite_expires_at:
      rec.invite_expires_at !== undefined
        ? rec.invite_expires_at
          ? String(rec.invite_expires_at)
          : null
        : prev?.invite_expires_at ?? null,
    share_schedule:
      rec.share_schedule !== undefined
        ? rec.share_schedule !== false
        : prev?.share_schedule !== false,
    share_feedback:
      rec.share_feedback !== undefined
        ? rec.share_feedback !== false
        : prev?.share_feedback !== false,
    share_medical:
      rec.share_medical !== undefined
        ? rec.share_medical === true
        : prev?.share_medical === true,
  };
  return out;
}

/** Safe clinical / medical summary for patient portals (no full chart dump). */
export function portalSharedMedicalSummary(input: {
  clinical?: {
    diagnosis_notes?: string;
    injury_notes?: string;
    injury_areas?: string[];
    injury_status?: string;
    training_modifications?: string;
    goals?: string;
    pain_score?: number | null;
    contraindications?: string;
  } | null;
  medical?: {
    allergies?: string;
    chronic_conditions?: string;
    current_meds?: string;
    medical_aid?: {
      scheme_name?: string;
      plan_name?: string;
      membership_number?: string;
    };
  } | null;
  diagnosis_notes?: string | null;
}): Record<string, unknown> | null {
  const clinical = input.clinical || null;
  const medical = input.medical || null;
  const summary: Record<string, unknown> = {};
  if (clinical?.injury_status) summary.injury_status = clinical.injury_status;
  if (clinical?.injury_areas?.length)
    summary.injury_areas = clinical.injury_areas;
  if (clinical?.injury_notes) summary.injury_notes = clinical.injury_notes;
  if (clinical?.diagnosis_notes || input.diagnosis_notes) {
    summary.diagnosis_notes =
      clinical?.diagnosis_notes || input.diagnosis_notes || undefined;
  }
  if (clinical?.training_modifications)
    summary.care_notes = clinical.training_modifications;
  if (clinical?.goals) summary.goals = clinical.goals;
  if (clinical?.pain_score != null) summary.pain_score = clinical.pain_score;
  if (clinical?.contraindications)
    summary.contraindications = clinical.contraindications;
  if (medical?.allergies) summary.allergies = medical.allergies;
  if (medical?.chronic_conditions)
    summary.chronic_conditions = medical.chronic_conditions;
  if (medical?.current_meds) summary.current_meds = medical.current_meds;
  if (medical?.medical_aid?.scheme_name) {
    summary.medical_aid = {
      scheme_name: medical.medical_aid.scheme_name,
      plan_name: medical.medical_aid.plan_name,
      membership_number: medical.medical_aid.membership_number
        ? `••••${String(medical.medical_aid.membership_number).slice(-4)}`
        : undefined,
    };
  }
  return Object.keys(summary).length ? summary : null;
}
