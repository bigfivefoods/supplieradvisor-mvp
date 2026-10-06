/**
 * Notices for a credit application. The bank account number stays off the email.
 */
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import { formatMoney } from '@/lib/accounting/types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
}

export function creditSubmittedHtml(opts: {
  sellerName: string;
  applicantName: string;
  requested: string;
  terms: string;
}): string {
  const link = `${appUrl()}/dashboard/customers/credit`;
  return `<p>${escapeHtml(opts.applicantName)} submitted a trade credit application to ${escapeHtml(opts.sellerName)}.</p>
<p>Requested limit ${escapeHtml(opts.requested)}. Terms ${escapeHtml(opts.terms || 'not chosen')}.</p>
<p><a href="${link}">Open Customers → Credit</a></p>`;
}

export function creditDecisionHtml(opts: {
  sellerName: string;
  decision: 'approved' | 'declined';
  limit: string;
  terms: string;
  notes: string;
}): string {
  const headline =
    opts.decision === 'approved'
      ? `${escapeHtml(opts.sellerName)} approved a credit limit of ${escapeHtml(opts.limit)}${
          opts.terms ? ` on ${escapeHtml(opts.terms)}` : ''
        }.`
      : `${escapeHtml(opts.sellerName)} declined the credit application.`;
  const note = opts.notes ? `<p>${escapeHtml(opts.notes)}</p>` : '';
  return `<p>${headline}</p>${note}`;
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const email = to.trim().toLowerCase();
  if (!email.includes('@') || !process.env.RESEND_API_KEY) return;
  const resend = getResend();
  await resend.emails.send({
    from: getResendFrom(),
    replyTo: getResendReplyTo(),
    to: email,
    subject,
    html,
  });
}

export async function emailCreditSubmitted(opts: {
  to: string;
  sellerName: string;
  applicantName: string;
  requestedLimit: number | null;
  currency: string;
  terms: string;
}): Promise<void> {
  const requested = formatMoney(opts.requestedLimit, opts.currency || 'ZAR', { compact: false });
  await send(
    opts.to,
    `Credit application from ${opts.applicantName}`,
    creditSubmittedHtml({
      sellerName: opts.sellerName,
      applicantName: opts.applicantName,
      requested,
      terms: opts.terms,
    })
  );
}

export async function emailCreditDecision(opts: {
  to: string;
  sellerName: string;
  decision: 'approved' | 'declined';
  approvedLimit: number | null;
  currency: string;
  terms: string;
  notes: string;
}): Promise<void> {
  const limit = formatMoney(opts.approvedLimit, opts.currency || 'ZAR', { compact: false });
  await send(
    opts.to,
    opts.decision === 'approved'
      ? `${opts.sellerName} approved your credit application`
      : `${opts.sellerName} declined your credit application`,
    creditDecisionHtml({
      sellerName: opts.sellerName,
      decision: opts.decision,
      limit,
      terms: opts.terms,
      notes: opts.notes,
    })
  );
}
