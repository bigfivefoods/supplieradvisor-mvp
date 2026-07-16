/**
 * Ops lifecycle emails for founding waitlist status changes.
 */
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import { FOUNDING_FREE_COMPANY_LIMIT } from '@/lib/billing/lifetime';

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Soft outreach when slots open (does not change waitlist status).
 */
export async function sendFoundingSlotsOpenEmail(opts: {
  to: string;
  companyName?: string | null;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: true, skipped: true, error: 'RESEND_API_KEY not set' };
  }
  const email = String(opts.to || '')
    .toLowerCase()
    .trim();
  if (!email.includes('@')) {
    return { ok: false, error: 'Invalid email' };
  }
  const base = appUrl();
  const name = opts.companyName
    ? escapeHtml(opts.companyName)
    : 'your company';
  try {
    const resend = getResend();
    await resend.emails.send({
      from: getResendFrom(),
      replyTo: getResendReplyTo(),
      to: email,
      subject: 'Founding free-for-life seats — register on SupplierAdvisor',
      html: `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:28px;">
    <div style="font-size:12px;font-weight:700;color:#7c3aed;letter-spacing:0.08em;text-transform:uppercase;">Founding cohort</div>
    <h1 style="font-size:20px;margin:12px 0 8px;color:#0f172a;">A founding seat may be available</h1>
    <p style="color:#475569;font-size:14px;line-height:1.6;">
      You joined the SupplierAdvisor waitlist${opts.companyName ? ` for <strong>${name}</strong>` : ''}.
      Free-for-life founding capacity (first ${FOUNDING_FREE_COMPANY_LIMIT} companies) may have room —
      register soon to claim a seat.
    </p>
    <p style="margin:24px 0;">
      <a href="${base}/onboarding" style="background:#7c3aed;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">
        Register now →
      </a>
    </p>
    <p style="color:#94a3b8;font-size:12px;">SupplierAdvisor®</p>
  </div>
</body></html>`,
    });
    return { ok: true };
  } catch (e: unknown) {
    console.warn('founding slots-open email soft-fail:', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'send failed',
    };
  }
}

/**
 * Soft-send when ops moves a waitlist entry to invited or converted.
 */
export async function sendFoundingStatusEmail(opts: {
  to: string;
  companyName?: string | null;
  status: 'invited' | 'converted' | string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: true, skipped: true, error: 'RESEND_API_KEY not set' };
  }
  const email = String(opts.to || '')
    .toLowerCase()
    .trim();
  if (!email.includes('@')) {
    return { ok: false, error: 'Invalid email' };
  }

  const status = String(opts.status || '').toLowerCase();
  if (status !== 'invited' && status !== 'converted') {
    return { ok: true, skipped: true };
  }

  const base = appUrl();
  const name = opts.companyName
    ? escapeHtml(opts.companyName)
    : 'your company';
  const subject =
    status === 'converted'
      ? 'Welcome to SupplierAdvisor founding cohort'
      : 'You’re invited — claim your SupplierAdvisor founding seat';
  const ctaHref =
    status === 'converted' ? `${base}/login` : `${base}/onboarding`;
  const ctaLabel =
    status === 'converted' ? 'Sign in to your company →' : 'Register & claim seat →';
  const body =
    status === 'converted'
      ? `<p style="color:#475569;font-size:14px;line-height:1.6;">
          Great news${opts.companyName ? ` for <strong>${name}</strong>` : ''} —
          you’ve been converted into the free-for-life founding cohort
          (limit ${FOUNDING_FREE_COMPANY_LIMIT}). Sign in to complete setup on the golden path.
        </p>`
      : `<p style="color:#475569;font-size:14px;line-height:1.6;">
          A founding free-for-life seat is available for you${
            opts.companyName ? ` (<strong>${name}</strong>)` : ''
          }.
          Register your company now to claim it before capacity fills again.
        </p>`;

  try {
    const resend = getResend();
    await resend.emails.send({
      from: getResendFrom(),
      replyTo: getResendReplyTo(),
      to: email,
      subject,
      html: `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:28px;">
    <div style="font-size:12px;font-weight:700;color:#7c3aed;letter-spacing:0.08em;text-transform:uppercase;">Founding cohort</div>
    <h1 style="font-size:20px;margin:12px 0 8px;color:#0f172a;">${escapeHtml(subject)}</h1>
    ${body}
    <p style="margin:24px 0;">
      <a href="${ctaHref}" style="background:#7c3aed;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">
        ${ctaLabel}
      </a>
    </p>
    <p style="color:#94a3b8;font-size:12px;">SupplierAdvisor® · Free for life for founding companies</p>
  </div>
</body></html>`,
    });
    return { ok: true };
  } catch (e: unknown) {
    console.warn('founding status email soft-fail:', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'send failed',
    };
  }
}
