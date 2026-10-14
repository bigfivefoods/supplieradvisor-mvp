import type { PushPayload } from '@/lib/push/web-push';

/**
 * TradeAdvisor® alerts reuse the platform mailer and web push.
 * Required for email: RESEND_API_KEY
 * Optional for email: RESEND_FROM_EMAIL, RESEND_REPLY_TO (defaults exist)
 * Required for push: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
 * Optional for push: VAPID_SUBJECT (defaults to mailto:ops@supplieradvisor.com)
 * Missing keys skip that channel. The job, invoice, or request is still saved.
 */
export const TRADE_EMAIL_ENV = ['RESEND_API_KEY'] as const;
export const TRADE_EMAIL_OPTIONAL_ENV = ['RESEND_FROM_EMAIL', 'RESEND_REPLY_TO'] as const;
export const TRADE_PUSH_ENV = ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'] as const;
export const TRADE_PUSH_OPTIONAL_ENV = ['VAPID_SUBJECT'] as const;

export function tradeNotifyConfig(): {
  email: boolean;
  push: boolean;
  missing: string[];
} {
  const missing = [
    ...TRADE_EMAIL_ENV.filter((key) => !process.env[key]),
    ...TRADE_PUSH_ENV.filter((key) => !process.env[key]),
  ];
  return {
    email: Boolean(process.env.RESEND_API_KEY),
    push: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    missing,
  };
}

export async function sendTradeEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<'sent' | 'skipped' | 'failed'> {
  const to = String(opts.to || '').trim();
  if (!to.includes('@') || !process.env.RESEND_API_KEY) return 'skipped';
  try {
    const { getResend, getResendSendDefaults } = await import('@/lib/resend');
    const resend = getResend();
    const sent = await resend.emails.send({
      ...getResendSendDefaults(),
      to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (sent.error) return 'failed';
    return 'sent';
  } catch {
    return 'failed';
  }
}

export async function sendTradePush(
  subs: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload
): Promise<number> {
  if (!subs.length) return 0;
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return 0;
  }
  try {
    const webpush = await import('web-push');
    const subject = process.env.VAPID_SUBJECT || 'mailto:ops@supplieradvisor.com';
    webpush.setVapidDetails(
      subject,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12, urgency: 'normal' }
        );
        sent += 1;
      } catch {
        /* one bad endpoint should not block the rest */
      }
    }
    return sent;
  } catch {
    return 0;
  }
}

export function tradeStatusEmail(opts: {
  brand: string;
  customerName: string;
  title: string;
  body: string;
  url: string;
}): { subject: string; html: string; text: string } {
  const subject = `${opts.brand}: ${opts.title}`;
  const text = `${opts.customerName}\n\n${opts.body}\n\n${opts.url}\n\nTradeAdvisor® on SupplierAdvisor®`;
  const html = `<div style="font-family:system-ui,sans-serif;color:#0f172a">
    <div style="height:8px;background:#00b4d8"></div>
    <p style="font-size:18px;font-weight:700">${escapeHtml(opts.brand)}</p>
    <p>${escapeHtml(opts.body)}</p>
    <p><a href="${escapeHtml(opts.url)}" style="color:#0077b6">${escapeHtml(opts.url)}</a></p>
    <p style="color:#64748b;font-size:12px">TradeAdvisor® on SupplierAdvisor®</p>
  </div>`;
  return { subject, html, text };
}

/** Email the tradesperson and push to their company subscriptions. Either channel may be skipped. */
export async function notifyTradesperson(opts: {
  companyId: number;
  email: string;
  brand: string;
  title: string;
  body: string;
  url: string;
}): Promise<{ email: 'sent' | 'skipped' | 'failed'; push: number }> {
  let email: 'sent' | 'skipped' | 'failed' = 'skipped';
  try {
    const mail = tradeStatusEmail({
      brand: opts.brand,
      customerName: 'Desk',
      title: opts.title,
      body: opts.body,
      url: opts.url,
    });
    email = await sendTradeEmail({ to: opts.email, ...mail });
  } catch {
    email = 'failed';
  }
  let push = 0;
  try {
    const { pushToCompany } = await import('@/lib/push/web-push');
    const result = await pushToCompany(opts.companyId, {
      title: `${opts.brand}: ${opts.title}`,
      body: opts.body,
      url: opts.url,
      tag: 'tradegraph',
    });
    push = result.sent;
  } catch {
    push = 0;
  }
  return { email, push };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
