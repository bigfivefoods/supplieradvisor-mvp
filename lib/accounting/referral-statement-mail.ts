import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function emailReferralStatement(opts: {
  to: string;
  sellerName: string;
  partnerName: string;
  periodLabel: string;
  pdf: Buffer;
  filename: string;
}): Promise<void> {
  const email = opts.to.trim().toLowerCase();
  if (!email.includes('@')) {
    throw new Error('That partner has no email address on their company profile.');
  }
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Email is not configured.');
  }
  const resend = getResend();
  await resend.emails.send({
    from: getResendFrom(),
    replyTo: getResendReplyTo(),
    to: email,
    subject: `Commission statement from ${opts.sellerName}`,
    html: `<p>${escapeHtml(opts.sellerName)} has sent ${escapeHtml(opts.partnerName)} a referral commission statement for ${escapeHtml(opts.periodLabel)}.</p><p>The statement is attached.</p>`,
    attachments: [
      {
        filename: opts.filename,
        content: opts.pdf.toString('base64'),
      },
    ],
  });
}
