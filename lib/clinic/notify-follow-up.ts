/**
 * Check-in / follow-up notifications for clinic Advisors.
 * Always targets both the member PWA and the practice desk.
 */
import { notifyLinkedMember } from '@/lib/b2c/member-push';
import { pushToCompany } from '@/lib/push/web-push';
import { resolveCompanyEmails } from '@/lib/billing/company-emails';
import { getAppUrl, getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import type { PatientFollowUp } from '@/lib/clinic/patient-follow-up';
import { pickCompanyLogoUrl } from '@/lib/business/company-logo';
import {
  escapeEmailHtml,
  sendAdvisorNoticeEmail,
} from '@/lib/services/advisor-branded-email';

export const CLINIC_FOLLOW_UP_MODULES = [
  'medicalgraph',
  'physiograph',
  'dentalgraph',
  'psychiatrygraph',
  'vetgraph',
] as const;

export type ClinicFollowUpModule = (typeof CLINIC_FOLLOW_UP_MODULES)[number];

export type FollowUpNotifyMode = 'scheduled' | 'now' | 'due' | 'booked';

const BRAND: Record<ClinicFollowUpModule, string> = {
  medicalgraph: 'MedicalAdvisor®',
  physiograph: 'PhysioAdvisor®',
  dentalgraph: 'DentalAdvisor®',
  psychiatrygraph: 'PsychiatryAdvisor®',
  vetgraph: 'VetAdvisor®',
};

export function clinicFollowUpPaths(module: ClinicFollowUpModule, opts: {
  patientId: string;
  portalToken?: string | null;
  appointmentId?: string | null;
}) {
  const desk = opts.appointmentId
    ? `/dashboard/${module}/calendar`
    : `/dashboard/${module}/patients/${encodeURIComponent(opts.patientId)}`;
  const portal = opts.portalToken
    ? `/member/${module}/${encodeURIComponent(opts.portalToken)}`
    : '/me';
  return { desk, portal };
}

export function followUpNotifyCopy(opts: {
  module: ClinicFollowUpModule;
  brand: string;
  patientName: string;
  followUp: Pick<
    PatientFollowUp,
    'title' | 'advice' | 'message' | 'remind_on'
  >;
  mode: FollowUpNotifyMode;
  appointmentWhen?: string | null;
}) {
  const brand = opts.brand || BRAND[opts.module];
  const title =
    opts.followUp.title?.trim() ||
    (opts.mode === 'booked'
      ? 'Follow-up appointment'
      : 'Check-in after your visit');
  const advice = (opts.followUp.advice || '').trim();
  const extra = (opts.followUp.message || '').trim();
  const when = opts.appointmentWhen || opts.followUp.remind_on;
  const memberBody =
    opts.mode === 'booked'
      ? [
          `${brand} booked your follow-up for ${when}.`,
          advice,
          extra,
        ]
          .filter(Boolean)
          .join(' ')
      : opts.mode === 'scheduled'
        ? [
            `${brand} scheduled a check-in for ${opts.followUp.remind_on}.`,
            advice,
            extra,
          ]
            .filter(Boolean)
            .join(' ')
        : [advice || 'Please check in with the practice.', extra]
            .filter(Boolean)
            .join(' ');
  const advisorBody =
    opts.mode === 'booked'
      ? `${opts.patientName} · follow-up booked ${when}`
      : opts.mode === 'scheduled'
        ? `${opts.patientName} · check-in scheduled ${opts.followUp.remind_on}`
        : `${opts.patientName} · check-in now · ${advice || title}`;
  return { title, memberBody, advisorBody };
}

export async function notifyFollowUpCheckIn(opts: {
  companyId: number;
  module: ClinicFollowUpModule;
  brand?: string | null;
  patient: {
    id: string;
    name: string;
    email?: string | null;
    platform_user_id?: string | null;
    portal_token?: string | null;
  };
  followUp: PatientFollowUp;
  mode: FollowUpNotifyMode;
  appointment?: { id?: string; date?: string; start_time?: string } | null;
}): Promise<{ member: number; desk: number }> {
  const brand = opts.brand || BRAND[opts.module];
  const when = opts.appointment?.date
    ? `${opts.appointment.date} ${(opts.appointment.start_time || '').slice(0, 5)}`.trim()
    : null;
  const copy = followUpNotifyCopy({
    module: opts.module,
    brand,
    patientName: opts.patient.name,
    followUp: opts.followUp,
    mode: opts.mode,
    appointmentWhen: when,
  });
  const paths = clinicFollowUpPaths(opts.module, {
    patientId: opts.patient.id,
    portalToken: opts.patient.portal_token,
    appointmentId: opts.appointment?.id || opts.followUp.next_appointment_id,
  });
  const tag = `followup-${opts.followUp.id}`;

  const member = await notifyLinkedMember({
    platformUserId: opts.patient.platform_user_id,
    title: copy.title,
    body: copy.memberBody,
    url: paths.portal,
    tag,
    topic: 'care',
  });

  let desk = 0;
  try {
    const pushed = await pushToCompany(
      opts.companyId,
      {
        title: `${BRAND[opts.module]} · ${copy.title}`,
        body: copy.advisorBody,
        url: paths.desk,
        tag,
      },
      { topic: 'all' }
    );
    desk = pushed.sent;
  } catch {
    /* soft */
  }

  try {
    const supabase = getSupabaseServer();
    await supabase.from('activity_log').insert({
      profile_id: opts.companyId,
      actor_user_id: 'clinic',
      action: 'clinic.follow_up',
      entity_type: opts.module,
      entity_id: opts.followUp.id,
      summary: copy.advisorBody,
      metadata: {
        mode: opts.mode,
        patient_id: opts.patient.id,
        remind_on: opts.followUp.remind_on,
      },
    });
  } catch {
    /* soft */
  }

  const resend = getResend();
  const app = getAppUrl();
  let logoUrl: string | null = null;
  try {
    const { data: prof } = await getSupabaseServer()
      .from('profiles')
      .select('logo_url')
      .eq('id', opts.companyId)
      .maybeSingle();
    logoUrl = pickCompanyLogoUrl(prof);
  } catch {
    /* soft */
  }
  if (opts.patient.email && opts.patient.email.includes('@')) {
    try {
      await sendAdvisorNoticeEmail(opts.patient.email, {
        personName: opts.patient.name,
        brand,
        logoUrl,
        moduleKey: opts.module,
        subject: `${copy.title} · ${brand}`,
        headline: escapeEmailHtml(copy.title),
        leadHtml: `Hi ${escapeEmailHtml(opts.patient.name)}, ${escapeEmailHtml(copy.memberBody)}`,
        ctaUrl: `${app}${paths.portal}`,
        ctaLabel: 'Open your portal',
      });
    } catch (err) {
      console.warn('[follow-up member email]', err);
    }
  }

  try {
    const { emails } = await resolveCompanyEmails(opts.companyId, {
      roleAllowlist: ['owner', 'admin', 'operations', 'ops'],
      limit: 6,
    });
    if (resend && emails.length) {
      await resend.emails.send({
        from: getResendFrom(),
        to: emails,
        replyTo: getResendReplyTo(),
        subject: `${BRAND[opts.module]} · ${copy.title}`,
        text: [
          copy.advisorBody,
          '',
          copy.memberBody,
          '',
          `Open: ${app}${paths.desk}`,
        ].join('\n'),
      });
    }
  } catch (err) {
    console.warn('[follow-up desk email]', err);
  }

  return { member: member.sent, desk };
}

export function advisorBellFollowUps(
  meta: Record<string, unknown> | null | undefined,
  today = new Date().toISOString().slice(0, 10)
): Array<{
  id: string;
  severity: 'warning' | 'info';
  title: string;
  body: string;
  href: string;
  created_at: string;
  source: string;
}> {
  const out: Array<{
    id: string;
    severity: 'warning' | 'info';
    title: string;
    body: string;
    href: string;
    created_at: string;
    source: string;
  }> = [];
  for (const module of CLINIC_FOLLOW_UP_MODULES) {
    const raw = meta?.[module];
    if (!raw || typeof raw !== 'object') continue;
    const patients = (raw as { patients?: unknown[] }).patients;
    if (!Array.isArray(patients)) continue;
    for (const p of patients) {
      if (!p || typeof p !== 'object') continue;
      const patient = p as {
        id?: string;
        name?: string;
        follow_ups?: PatientFollowUp[];
      };
      for (const f of patient.follow_ups || []) {
        if (f.status !== 'scheduled' && f.status !== 'sent') continue;
        if (f.remind_on > today) continue;
        out.push({
          id: `followup-${module}-${f.id}`,
          severity: 'warning',
          title: f.title || 'Patient check-in due',
          body: `${patient.name || 'Patient'} · ${f.advice}`,
          href: patient.id
            ? `/dashboard/${module}/patients/${encodeURIComponent(patient.id)}`
            : `/dashboard/${module}/calendar`,
          created_at: f.sent_at || f.created_at || today,
          source: module,
        });
      }
    }
  }
  return out.slice(0, 8);
}
