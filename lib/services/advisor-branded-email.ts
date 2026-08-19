/**
 * Branded Advisor session emails (pre-visit reminder + post-visit feedback).
 * Practice logo when uploaded; MedicalAdvisor® chrome otherwise.
 */
import { getAppUrl, getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';

export type AdvisorEmailKind = 'pre' | 'post';

export type AdvisorEmailSkin = {
  moduleKey: string;
  product: string;
  accent: string;
  accentDark: string;
  accentSoft: string;
};

export const ADVISOR_EMAIL_SKINS: Record<string, AdvisorEmailSkin> = {
  medicalgraph: {
    moduleKey: 'medicalgraph',
    product: 'MedicalAdvisor®',
    accent: '#059669',
    accentDark: '#065f46',
    accentSoft: '#ecfdf5',
  },
  physiograph: {
    moduleKey: 'physiograph',
    product: 'PhysioAdvisor®',
    accent: '#0d9488',
    accentDark: '#115e59',
    accentSoft: '#f0fdfa',
  },
  dentalgraph: {
    moduleKey: 'dentalgraph',
    product: 'DentalAdvisor®',
    accent: '#0284c7',
    accentDark: '#075985',
    accentSoft: '#f0f9ff',
  },
  psychiatrygraph: {
    moduleKey: 'psychiatrygraph',
    product: 'PsychiatryAdvisor®',
    accent: '#7c3aed',
    accentDark: '#5b21b6',
    accentSoft: '#f5f3ff',
  },
  fitgraph: {
    moduleKey: 'fitgraph',
    product: 'GymAdvisor®',
    accent: '#7c3aed',
    accentDark: '#5b21b6',
    accentSoft: '#f5f3ff',
  },
  hiregraph: {
    moduleKey: 'hiregraph',
    product: 'HireAdvisor®',
    accent: '#ea580c',
    accentDark: '#9a3412',
    accentSoft: '#fff7ed',
  },
  retailgraph: {
    moduleKey: 'retailgraph',
    product: 'RetailAdvisor®',
    accent: '#d97706',
    accentDark: '#92400e',
    accentSoft: '#fffbeb',
  },
};

export function advisorEmailSkin(
  moduleKeyOrLabel?: string | null
): AdvisorEmailSkin {
  const raw = String(moduleKeyOrLabel || '').toLowerCase();
  if (ADVISOR_EMAIL_SKINS[raw]) return ADVISOR_EMAIL_SKINS[raw];
  if (raw.includes('medical')) return ADVISOR_EMAIL_SKINS.medicalgraph;
  if (raw.includes('physio')) return ADVISOR_EMAIL_SKINS.physiograph;
  if (raw.includes('dental')) return ADVISOR_EMAIL_SKINS.dentalgraph;
  if (raw.includes('psych')) return ADVISOR_EMAIL_SKINS.psychiatrygraph;
  if (raw.includes('gym') || raw.includes('fit')) return ADVISOR_EMAIL_SKINS.fitgraph;
  if (raw.includes('hire')) return ADVISOR_EMAIL_SKINS.hiregraph;
  if (raw.includes('retail')) return ADVISOR_EMAIL_SKINS.retailgraph;
  return ADVISOR_EMAIL_SKINS.medicalgraph;
}

export function escapeEmailHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function absolutePublicUrl(
  url: string | null | undefined,
  app = getAppUrl()
): string | null {
  const s = String(url || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return `${app}${s}`;
  return `${app}/${s}`;
}

export type AdvisorSessionEmailInput = {
  kind: AdvisorEmailKind;
  personName: string;
  brand: string;
  eventTitle: string;
  date: string;
  start_time: string;
  location?: string | null;
  practitionerName?: string | null;
  logoUrl?: string | null;
  ctaUrl: string;
  moduleKey?: string | null;
  moduleLabel?: string | null;
};

export function renderAdvisorSessionEmail(input: AdvisorSessionEmailInput): {
  subject: string;
  html: string;
} {
  const skin = advisorEmailSkin(input.moduleKey || input.moduleLabel);
  const when = `${input.date} at ${String(input.start_time || '').slice(0, 5)}`;
  const brand = input.brand || skin.product;
  const name = input.personName || 'there';
  const logo = absolutePublicUrl(input.logoUrl);
  const cta = absolutePublicUrl(input.ctaUrl) || getAppUrl();
  const pre = input.kind === 'pre';
  const subject = pre
    ? `Reminder · ${input.eventTitle} at ${brand} · ${when}`
    : `How was your visit at ${brand}?`;
  const headline = pre
    ? `See you soon, ${escapeEmailHtml(name)}`
    : `Thank you, ${escapeEmailHtml(name)}`;
  const lead = pre
    ? `This is a reminder from <strong>${escapeEmailHtml(brand)}</strong> on ${escapeEmailHtml(skin.product)}. Please arrive a few minutes early and bring your medical aid card if you use one.`
    : `We hope your visit with <strong>${escapeEmailHtml(brand)}</strong> went well. A minute of feedback helps the team look after you — and the practice — even better next time.`;
  const ctaLabel = pre ? 'View / manage booking' : 'Rate this visit';
  const profileUrl = absolutePublicUrl('/me') || `${getAppUrl()}/me`;
  const prepBox = pre
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 4px;background:#fffbeb;border:1px solid #fde68a;border-radius:16px;">
         <tr>
           <td style="padding:16px 18px;font-family:system-ui,-apple-system,sans-serif;">
             <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#92400e;">Before you come</p>
             <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#78350f;">
               Please open the <strong>SA Member</strong> app (your personal wallet) and make sure your profile is up to date — contact details, medical aid, and emergency contact.
             </p>
             <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#78350f;">
               If you can, list any ailments, injuries, allergies or medicines you are taking. Your clinician can then prepare and look after you safely.
             </p>
             <p style="margin:14px 0 0;">
               <a href="${escapeEmailHtml(profileUrl)}" style="display:inline-block;background:#fff;color:${skin.accentDark};border:1px solid ${skin.accent};text-decoration:none;font-weight:800;font-size:13px;padding:10px 18px;border-radius:999px;">
                 Update SA Member profile
               </a>
             </p>
           </td>
         </tr>
       </table>`
    : '';
  const starRow =
    pre
      ? ''
      : `<p style="margin:18px 0 6px;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${skin.accentDark};">Rate your session</p>
         <p style="margin:0 0 16px;">
           ${[1, 2, 3, 4, 5]
             .map(
               (n) =>
                 `<a href="${escapeEmailHtml(`${cta}${cta.includes('?') ? '&' : '?'}session=${n}`)}" style="display:inline-block;margin-right:6px;text-decoration:none;font-size:22px;line-height:1;">⭐</a>`
             )
             .join('')}
         </p>
         <p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${skin.accentDark};">Rate the practice</p>
         <p style="margin:0 0 8px;">
           ${[1, 2, 3, 4, 5]
             .map(
               (n) =>
                 `<a href="${escapeEmailHtml(`${cta}${cta.includes('?') ? '&' : '?'}practice=${n}`)}" style="display:inline-block;margin-right:6px;text-decoration:none;font-size:22px;line-height:1;">⭐</a>`
             )
             .join('')}
         </p>`;

  const logoBlock = logo
    ? `<img src="${escapeEmailHtml(logo)}" alt="${escapeEmailHtml(brand)}" width="160" style="max-width:160px;max-height:56px;height:auto;display:block;margin:0 auto 12px;border:0;" />`
    : `<div style="width:52px;height:52px;border-radius:16px;background:rgba(255,255,255,.16);color:#fff;font-weight:800;font-size:18px;line-height:52px;margin:0 auto 12px;">${escapeEmailHtml(
        (brand.replace(/[^A-Za-z0-9]/g, ' ').trim()[0] || 'A').toUpperCase()
      )}</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f1f5f4;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f4;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #d1fae5;">
          <tr>
            <td style="background:${skin.accent};padding:28px 28px 22px;text-align:center;">
              ${logoBlock}
              <div style="font-family:system-ui,-apple-system,sans-serif;font-size:11px;letter-spacing:.18em;font-weight:800;text-transform:uppercase;color:#ecfdf5;">
                ${escapeEmailHtml(skin.product)}
              </div>
              <div style="font-family:Georgia,'Times New Roman',serif;color:#ffffff;font-size:24px;font-weight:700;margin-top:8px;line-height:1.25;">
                ${escapeEmailHtml(brand)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;font-family:system-ui,-apple-system,sans-serif;color:#0f172a;">
              <h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;">${headline}</h1>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">${lead}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${skin.accentSoft};border:1px solid #a7f3d0;border-radius:16px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${skin.accentDark};">${pre ? 'Upcoming visit' : 'Your visit'}</p>
                    <p style="margin:8px 0 0;font-size:17px;font-weight:800;color:#064e3b;">${escapeEmailHtml(input.eventTitle)}</p>
                    <p style="margin:6px 0 0;font-size:14px;color:#065f46;">${escapeEmailHtml(when)}</p>
                    ${
                      input.practitionerName
                        ? `<p style="margin:4px 0 0;font-size:13px;color:#047857;">with ${escapeEmailHtml(input.practitionerName)}</p>`
                        : ''
                    }
                    ${
                      input.location
                        ? `<p style="margin:4px 0 0;font-size:13px;color:#64748b;">${escapeEmailHtml(input.location)}</p>`
                        : ''
                    }
                  </td>
                </tr>
              </table>
              ${prepBox}
              ${starRow}
              <p style="margin:22px 0 8px;text-align:center;">
                <a href="${escapeEmailHtml(cta)}" style="display:inline-block;background:${skin.accent};color:#ffffff;text-decoration:none;font-family:system-ui,-apple-system,sans-serif;font-weight:800;font-size:14px;padding:13px 26px;border-radius:999px;">
                  ${escapeEmailHtml(ctaLabel)}
                </a>
              </p>
              <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                ${escapeEmailHtml(skin.product)} · powered by SupplierAdvisor®
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px;font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:#94a3b8;text-align:center;">
              Sent on behalf of ${escapeEmailHtml(brand)}. Replies go to SupplierAdvisor.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

function tryResend() {
  try {
    if (!process.env.RESEND_API_KEY) return null;
    return getResend();
  } catch {
    return null;
  }
}

export type AdvisorInvoiceEmailInput = {
  personName: string;
  brand: string;
  description: string;
  amountLabel: string;
  invoiceNumber?: string | null;
  dueDate?: string | null;
  logoUrl?: string | null;
  ctaUrl: string;
  moduleKey?: string | null;
};

export function renderAdvisorInvoiceEmail(input: AdvisorInvoiceEmailInput): {
  subject: string;
  html: string;
} {
  const skin = advisorEmailSkin(input.moduleKey);
  const brand = input.brand || skin.product;
  const name = input.personName || 'there';
  const logo = absolutePublicUrl(input.logoUrl);
  const cta = absolutePublicUrl(input.ctaUrl) || `${getAppUrl()}/me?tab=account`;
  const inv = input.invoiceNumber ? String(input.invoiceNumber) : '';
  const subject = inv
    ? `Invoice ${inv} from ${brand} · ${input.amountLabel}`
    : `Invoice from ${brand} · ${input.amountLabel}`;
  const logoBlock = logo
    ? `<img src="${escapeEmailHtml(logo)}" alt="${escapeEmailHtml(brand)}" width="160" style="max-width:160px;max-height:56px;height:auto;display:block;margin:0 auto 12px;border:0;" />`
    : `<div style="width:52px;height:52px;border-radius:16px;background:rgba(255,255,255,.16);color:#fff;font-weight:800;font-size:18px;line-height:52px;margin:0 auto 12px;">${escapeEmailHtml(
        (brand.replace(/[^A-Za-z0-9]/g, ' ').trim()[0] || 'A').toUpperCase()
      )}</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f1f5f4;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f4;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #d1fae5;">
          <tr>
            <td style="background:${skin.accent};padding:28px 28px 22px;text-align:center;">
              ${logoBlock}
              <div style="font-family:system-ui,-apple-system,sans-serif;font-size:11px;letter-spacing:.18em;font-weight:800;text-transform:uppercase;color:#ecfdf5;">
                ${escapeEmailHtml(skin.product)}
              </div>
              <div style="font-family:Georgia,'Times New Roman',serif;color:#ffffff;font-size:24px;font-weight:700;margin-top:8px;line-height:1.25;">
                ${escapeEmailHtml(brand)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;font-family:system-ui,-apple-system,sans-serif;color:#0f172a;">
              <h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;">Invoice ready, ${escapeEmailHtml(name)}</h1>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">
                <strong>${escapeEmailHtml(brand)}</strong> sent you an invoice. It is on your SA Member profile so you can view it, pay by card, or send proof of payment.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${skin.accentSoft};border:1px solid #a7f3d0;border-radius:16px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${skin.accentDark};">${inv ? escapeEmailHtml(inv) : 'Invoice'}</p>
                    <p style="margin:8px 0 0;font-size:17px;font-weight:800;color:#064e3b;">${escapeEmailHtml(input.description)}</p>
                    <p style="margin:8px 0 0;font-size:22px;font-weight:800;color:#0f172a;">${escapeEmailHtml(input.amountLabel)}</p>
                    ${
                      input.dueDate
                        ? `<p style="margin:6px 0 0;font-size:13px;color:#64748b;">Due ${escapeEmailHtml(input.dueDate)}</p>`
                        : ''
                    }
                  </td>
                </tr>
              </table>
              <p style="margin:22px 0 8px;text-align:center;">
                <a href="${escapeEmailHtml(cta)}" style="display:inline-block;background:${skin.accent};color:#ffffff;text-decoration:none;font-family:system-ui,-apple-system,sans-serif;font-weight:800;font-size:14px;padding:13px 26px;border-radius:999px;">
                  View invoice in SA Member
                </a>
              </p>
              <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                ${escapeEmailHtml(skin.product)} · powered by SupplierAdvisor®
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px;font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:#94a3b8;text-align:center;">
              Sent on behalf of ${escapeEmailHtml(brand)}. Replies go to SupplierAdvisor.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

export async function sendAdvisorInvoiceEmail(
  to: string,
  input: AdvisorInvoiceEmailInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const resend = tryResend();
    if (!resend) {
      return { ok: false, error: 'Email not configured (RESEND_API_KEY)' };
    }
    if (!to || !to.includes('@')) {
      return { ok: false, error: 'No email' };
    }
    const { subject, html } = renderAdvisorInvoiceEmail(input);
    const { error } = await resend.emails.send({
      from: getResendFrom(),
      replyTo: getResendReplyTo(),
      to,
      subject,
      html,
    });
    if (error) return { ok: false, error: error.message || 'Send failed' };
    return { ok: true };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Send failed',
    };
  }
}

export async function sendAdvisorSessionEmail(
  to: string,
  input: AdvisorSessionEmailInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const resend = tryResend();
    if (!resend) {
      return { ok: false, error: 'Email not configured (RESEND_API_KEY)' };
    }
    if (!to || !to.includes('@')) {
      return { ok: false, error: 'No email' };
    }
    const { subject, html } = renderAdvisorSessionEmail(input);
    const { error } = await resend.emails.send({
      from: getResendFrom(),
      replyTo: getResendReplyTo(),
      to,
      subject,
      html,
    });
    if (error) return { ok: false, error: error.message || 'Send failed' };
    return { ok: true };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Send failed',
    };
  }
}

export function appointmentEndMs(appt: {
  date: string;
  start_time: string;
  end_time?: string | null;
  duration_min?: number | null;
}): number | null {
  const date = String(appt.date || '').slice(0, 10);
  const start = String(appt.start_time || '09:00').slice(0, 5);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const startAt = new Date(`${date}T${start}:00`);
  if (Number.isNaN(startAt.getTime())) return null;
  const endRaw = appt.end_time ? String(appt.end_time).slice(0, 5) : '';
  if (endRaw && /^\d{2}:\d{2}$/.test(endRaw)) {
    const endAt = new Date(`${date}T${endRaw}:00`);
    if (!Number.isNaN(endAt.getTime()) && endAt.getTime() > startAt.getTime()) {
      return endAt.getTime();
    }
  }
  const mins = Number(appt.duration_min);
  const add = Number.isFinite(mins) && mins > 0 ? mins : 45;
  return startAt.getTime() + add * 60_000;
}

export function needsPostSessionEmail(
  booking: {
    status: string;
    post_session_emailed_at?: string | null;
    feedback_submitted_at?: string | null;
  },
  appt: {
    date: string;
    start_time: string;
    end_time?: string | null;
    duration_min?: number | null;
    status?: string;
  },
  nowMs = Date.now(),
  graceMinutes = 15
): boolean {
  if (booking.feedback_submitted_at) return false;
  if (booking.post_session_emailed_at) return false;
  if (booking.status === 'cancelled' || booking.status === 'no_show') return false;
  if (booking.status !== 'booked' && booking.status !== 'attended') return false;
  if (appt.status === 'cancelled') return false;
  if (booking.status === 'attended') return true;
  const end = appointmentEndMs(appt);
  if (end == null) return false;
  return nowMs >= end + graceMinutes * 60_000;
}
