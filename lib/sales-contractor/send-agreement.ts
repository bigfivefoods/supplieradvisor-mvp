/**
 * Resend the unsigned sales contractor agreement.
 * Tests pass `transport` and never open a live email client.
 */
import { getAppUrl, getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import { salesContractorAgreementEmail } from './agreement';
import { salesAgreementResendHref } from './party';

export type AgreementEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type AgreementEmailTransport = (
  payload: AgreementEmailPayload
) => Promise<{ id?: string | null; error?: string | null }>;

export async function deliverSalesContractorAgreementEmail(opts: {
  to: string;
  personName?: string | null;
  hiringCompanyName: string;
  contractorCompanyName?: string | null;
  contractorRegistrationNumber?: string | null;
  invitedBy?: string | null;
  memberStatus?: string | null;
  joinLink?: string | null;
  transport?: AgreementEmailTransport;
}): Promise<
  | { ok: true; id: string | null; subject: string; href: string }
  | { ok: false; error: string; status: number }
> {
  const href = salesAgreementResendHref({
    appUrl: getAppUrl(),
    memberStatus: opts.memberStatus,
    joinLink: opts.joinLink,
  });
  const email = salesContractorAgreementEmail({
    personName: opts.personName,
    hiringCompanyName: opts.hiringCompanyName,
    contractorCompanyName: opts.contractorCompanyName,
    contractorRegistrationNumber: opts.contractorRegistrationNumber,
    agreementLink: href,
    invitedBy: opts.invitedBy,
  });
  const payload: AgreementEmailPayload = {
    to: opts.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  };

  if (opts.transport) {
    const result = await opts.transport(payload);
    if (result.error) {
      return { ok: false, error: result.error, status: 502 };
    }
    return { ok: true, id: result.id || null, subject: email.subject, href };
  }

  if (
    process.env.AGREEMENT_EMAIL_DISABLE === '1' ||
    process.env.NODE_ENV === 'test'
  ) {
    return {
      ok: false,
      error: 'Email sending is disabled in this environment.',
      status: 503,
    };
  }
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: 'Email is not configured', status: 503 };
  }

  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: getResendFrom(),
      replyTo: getResendReplyTo(),
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      tags: [{ name: 'type', value: 'sales_contractor_agreement' }],
    });
    if (error) {
      const message =
        typeof error === 'object' && error && 'message' in error
          ? String((error as { message?: string }).message)
          : 'Email failed to send';
      return { ok: false, error: message || 'Email failed to send', status: 502 };
    }
    return { ok: true, id: data?.id || null, subject: email.subject, href };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Email failed to send',
      status: 502,
    };
  }
}
