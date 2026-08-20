/**
 * Design-proof emails — same chrome every platform send uses.
 */
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import { businessInviteEmailHtml } from '@/lib/invites/email';
import {
  renderAdvisorInvoiceEmail,
  renderAdvisorNoticeEmail,
  renderAdvisorSessionEmail,
} from '@/lib/services/advisor-branded-email';

export const EMAIL_DESIGN_SAMPLE_TO = 'craig@bigfivefoods.com';

export function buildEmailDesignSamples(to = EMAIL_DESIGN_SAMPLE_TO): Array<{
  key: string;
  subject: string;
  html: string;
  to: string;
}> {
  const app = 'https://www.supplieradvisor.com';
  const invite = businessInviteEmailHtml({
    inviteeName: 'Craig',
    businessName: 'Big Five Foods',
    invitedBy: 'SupplierAdvisor',
    inviteLink: `${app}/join/sample-invite`,
  });
  const gym = renderAdvisorSessionEmail({
    kind: 'pre',
    personName: 'Craig',
    brand: 'Demo gym',
    eventTitle: 'Hyrox engine · 06:00',
    date: '2026-08-21',
    start_time: '06:00',
    location: 'Main floor',
    practitionerName: 'Coach Sam',
    ctaUrl: `${app}/member/fitgraph/sample`,
    moduleKey: 'fitgraph',
  });
  const invoice = renderAdvisorInvoiceEmail({
    personName: 'Craig',
    brand: 'Balance Physio',
    description: 'Physio consult · 45 min',
    amountLabel: 'R850',
    invoiceNumber: 'INV-1001',
    dueDate: '2026-08-25',
    ctaUrl: `${app}/me?tab=account`,
    moduleKey: 'physiograph',
  });
  const po = renderAdvisorNoticeEmail({
    brand: 'SupplierAdvisor',
    subject: 'New purchase order #4821',
    headline: 'Inbound purchase order',
    leadHtml:
      '<strong>Big Five Foods</strong> raised <strong>PO #4821</strong> against your catalogue. Total <strong>R12,480</strong> · 4 lines.',
    detailKicker: 'Trade loop',
    detailTitle: 'PO #4821',
    detailLines: ['ZAR 12,480', '4 lines', 'Accept or decline from inbound orders'],
    ctaUrl: `${app}/dashboard/customers/orders?tab=inbound`,
    ctaLabel: 'Open inbound POs →',
  });
  return [
    {
      key: 'invite',
      subject: '[Sample] You’re invited to SupplierAdvisor',
      html: invite,
      to,
    },
    {
      key: 'gym',
      subject: `[Sample] ${gym.subject}`,
      html: gym.html,
      to,
    },
    {
      key: 'invoice',
      subject: `[Sample] ${invoice.subject}`,
      html: invoice.html,
      to,
    },
    {
      key: 'po',
      subject: `[Sample] ${po.subject}`,
      html: po.html,
      to,
    },
  ].map((row) => ({ ...row, to }));
}

export async function sendEmailDesignSamples(opts?: {
  to?: string;
}): Promise<{ ok: boolean; sent: string[]; errors: string[] }> {
  const to = String(opts?.to || EMAIL_DESIGN_SAMPLE_TO)
    .trim()
    .toLowerCase();
  if (!to.includes('@')) {
    return { ok: false, sent: [], errors: ['Invalid to'] };
  }
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, sent: [], errors: ['RESEND_API_KEY not set'] };
  }
  const resend = getResend();
  const from = getResendFrom();
  const replyTo = getResendReplyTo();
  const sent: string[] = [];
  const errors: string[] = [];
  for (const sample of buildEmailDesignSamples(to)) {
    try {
      const { error } = await resend.emails.send({
        from,
        replyTo,
        to,
        subject: sample.subject,
        html: sample.html,
        tags: [{ name: 'kind', value: 'design_sample' }],
      });
      if (error) errors.push(`${sample.key}: ${error.message || 'send failed'}`);
      else sent.push(sample.key);
    } catch (e) {
      errors.push(
        `${sample.key}: ${e instanceof Error ? e.message : 'send failed'}`
      );
    }
  }
  return { ok: errors.length === 0 && sent.length > 0, sent, errors };
}
