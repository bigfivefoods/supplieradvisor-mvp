/**
 * Client emails: business logo first, then selected Advisor brand,
 * otherwise SupplierAdvisor®. Shared chrome for session, invoice,
 * waitlist, invite and follow-up mail.
 */
import { SA_LOGO_SRC } from '@/lib/brand/assets';
import { getAppUrl, getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';

export type AdvisorEmailKind = 'pre' | 'post';

export type AdvisorEmailSkin = {
  moduleKey: string;
  product: string;
  accent: string;
  accentDark: string;
  accentSoft: string;
};

export const SUPPLIER_EMAIL_SKIN: AdvisorEmailSkin = {
  moduleKey: 'supplier',
  product: 'SupplierAdvisor®',
  accent: '#00b4d8',
  accentDark: '#0077b6',
  accentSoft: '#e8f8fc',
};

export const ADVISOR_EMAIL_SKINS: Record<string, AdvisorEmailSkin> = {
  medicalgraph: {
    moduleKey: 'medicalgraph',
    product: 'MedicalAdvisor®',
    accent: '#4f46e5',
    accentDark: '#3730a3',
    accentSoft: '#eef2ff',
  },
  physiograph: {
    moduleKey: 'physiograph',
    product: 'PhysioAdvisor®',
    accent: '#0d9488',
    accentDark: '#0f766e',
    accentSoft: '#f0fdfa',
  },
  dentalgraph: {
    moduleKey: 'dentalgraph',
    product: 'DentalAdvisor®',
    accent: '#0284c7',
    accentDark: '#0369a1',
    accentSoft: '#f0f9ff',
  },
  psychiatrygraph: {
    moduleKey: 'psychiatrygraph',
    product: 'PsychiatryAdvisor®',
    accent: '#e11d48',
    accentDark: '#9f1239',
    accentSoft: '#fff1f2',
  },
  fitgraph: {
    moduleKey: 'fitgraph',
    product: 'GymAdvisor®',
    accent: '#E8E830',
    accentDark: '#6B6B00',
    accentSoft: '#fefce8',
  },
  hiregraph: {
    moduleKey: 'hiregraph',
    product: 'HireAdvisor®',
    accent: '#0891b2',
    accentDark: '#0e7490',
    accentSoft: '#ecfeff',
  },
  retailgraph: {
    moduleKey: 'retailgraph',
    product: 'RetailAdvisor®',
    accent: '#ea580c',
    accentDark: '#c2410c',
    accentSoft: '#fff7ed',
  },
  fieldgraph: {
    moduleKey: 'fieldgraph',
    product: 'CropAdvisor®',
    accent: '#16a34a',
    accentDark: '#15803d',
    accentSoft: '#f0fdf4',
  },
  quarrygraph: {
    moduleKey: 'quarrygraph',
    product: 'QuarryAdvisor®',
    accent: '#b45309',
    accentDark: '#92400e',
    accentSoft: '#fffbeb',
  },
  schools: {
    moduleKey: 'schools',
    product: 'SchoolAdvisor®',
    accent: '#2563eb',
    accentDark: '#1d4ed8',
    accentSoft: '#eff6ff',
  },
};

export function advisorEmailSkin(
  moduleKeyOrLabel?: string | null
): AdvisorEmailSkin {
  const raw = String(moduleKeyOrLabel || '').toLowerCase().trim();
  if (!raw) return SUPPLIER_EMAIL_SKIN;
  if (ADVISOR_EMAIL_SKINS[raw]) return ADVISOR_EMAIL_SKINS[raw];
  if (raw.includes('medical')) return ADVISOR_EMAIL_SKINS.medicalgraph;
  if (raw.includes('physio')) return ADVISOR_EMAIL_SKINS.physiograph;
  if (raw.includes('dental')) return ADVISOR_EMAIL_SKINS.dentalgraph;
  if (raw.includes('psych')) return ADVISOR_EMAIL_SKINS.psychiatrygraph;
  if (raw.includes('gym') || raw.includes('fit')) return ADVISOR_EMAIL_SKINS.fitgraph;
  if (raw.includes('hire')) return ADVISOR_EMAIL_SKINS.hiregraph;
  if (raw.includes('retail')) return ADVISOR_EMAIL_SKINS.retailgraph;
  if (raw.includes('crop') || raw.includes('field')) return ADVISOR_EMAIL_SKINS.fieldgraph;
  if (raw.includes('quarry')) return ADVISOR_EMAIL_SKINS.quarrygraph;
  if (raw.includes('school')) return ADVISOR_EMAIL_SKINS.schools;
  if (raw.includes('supplier')) return SUPPLIER_EMAIL_SKIN;
  return SUPPLIER_EMAIL_SKIN;
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

export function supplierAdvisorLogoUrl(): string {
  return absolutePublicUrl(SA_LOGO_SRC) || `${getAppUrl()}${SA_LOGO_SRC}`;
}

function hexLuminance(hex: string): number {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length !== 6) return 0;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export type ClientEmailChrome = {
  skin: AdvisorEmailSkin;
  hasModule: boolean;
  companyLogo: string | null;
  platformLogo: string;
  ink: string;
  muted: string;
  ctaBg: string;
  ctaInk: string;
};

/**
 * Logo: company mark when uploaded.
 * No company mark + Advisor module → that Advisor's colours / wordmark.
 * No module → SupplierAdvisor® logo.
 */
export function clientEmailChrome(opts: {
  moduleKey?: string | null;
  moduleLabel?: string | null;
  logoUrl?: string | null;
}): ClientEmailChrome {
  const skin = advisorEmailSkin(opts.moduleKey || opts.moduleLabel);
  const hasModule = skin.moduleKey !== 'supplier';
  const companyLogo = absolutePublicUrl(opts.logoUrl);
  const light = hexLuminance(skin.accent) > 0.62;
  return {
    skin,
    hasModule,
    companyLogo,
    platformLogo: supplierAdvisorLogoUrl(),
    ink: light ? '#0f172a' : '#ffffff',
    muted: light ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.8)',
    ctaBg: light ? skin.accentDark : skin.accent,
    ctaInk: '#ffffff',
  };
}

const FONT =
  "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function logoPlate(src: string, alt: string, maxHeight = 56): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 16px;">
    <tr>
      <td style="background:#ffffff;border-radius:18px;padding:12px 18px;box-shadow:0 8px 24px rgba(15,23,42,0.12);">
        <img src="${escapeEmailHtml(src)}" alt="${escapeEmailHtml(alt)}" height="${maxHeight}" style="display:block;margin:0 auto;max-height:${maxHeight}px;max-width:220px;width:auto;height:auto;border:0;" />
      </td>
    </tr>
  </table>`;
}

export type ClientEmailLayoutInput = {
  moduleKey?: string | null;
  moduleLabel?: string | null;
  brand: string;
  logoUrl?: string | null;
  preheader?: string;
  headline: string;
  leadHtml: string;
  kicker?: string;
  detailHtml?: string;
  extraHtml?: string;
  ctaUrl?: string | null;
  ctaLabel?: string;
  footerNote?: string;
};

export function renderClientEmailLayout(input: ClientEmailLayoutInput): string {
  const chrome = clientEmailChrome(input);
  const { skin } = chrome;
  const brand = input.brand || skin.product;
  const showBrand = brand.trim() && brand.trim() !== skin.product;
  const cta = absolutePublicUrl(input.ctaUrl);
  const preheader = escapeEmailHtml(input.preheader || '');

  let mark = '';
  if (chrome.companyLogo) {
    mark = logoPlate(chrome.companyLogo, brand, 58);
  } else if (!chrome.hasModule) {
    mark = logoPlate(chrome.platformLogo, 'SupplierAdvisor', 52);
  }

  const ctaBlock =
    cta && input.ctaLabel
      ? `<p style="margin:28px 0 8px;text-align:center;">
           <a href="${escapeEmailHtml(cta)}" style="display:inline-block;background:${chrome.ctaBg};color:${chrome.ctaInk};text-decoration:none;font-family:${FONT};font-weight:800;font-size:15px;letter-spacing:-0.2px;padding:14px 28px;border-radius:999px;">
             ${escapeEmailHtml(input.ctaLabel)}
           </a>
         </p>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeEmailHtml(brand)}</title>
</head>
<body style="margin:0;padding:0;background:#e8eef3;font-family:${FONT};">
  ${
    preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>`
      : ''
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8eef3;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #dbe4ee;">
          <tr>
            <td style="background:${skin.accent};background-image:linear-gradient(165deg,${skin.accent} 0%,${skin.accentDark} 100%);padding:36px 32px 28px;text-align:center;">
              ${mark}
              <div style="font-family:${FONT};font-size:11px;letter-spacing:.2em;font-weight:800;text-transform:uppercase;color:${chrome.muted};">
                ${escapeEmailHtml(skin.product)}
              </div>
              ${
                showBrand
                  ? `<div style="font-family:${FONT};color:${chrome.ink};font-size:28px;font-weight:800;letter-spacing:-0.6px;margin-top:8px;line-height:1.2;">
                       ${escapeEmailHtml(brand)}
                     </div>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px;font-family:${FONT};color:#0f172a;">
              ${
                input.kicker
                  ? `<p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${skin.accentDark};">${escapeEmailHtml(input.kicker)}</p>`
                  : ''
              }
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;letter-spacing:-0.4px;font-weight:800;">${input.headline}</h1>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#334155;">${input.leadHtml}</p>
              ${input.detailHtml || ''}
              ${input.extraHtml || ''}
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;font-family:${FONT};text-align:center;">
              <img src="${escapeEmailHtml(chrome.platformLogo)}" alt="SupplierAdvisor" width="36" height="36" style="display:block;margin:12px auto 8px;width:36px;height:36px;border:0;border-radius:10px;" />
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
                ${escapeEmailHtml(skin.product)}${chrome.hasModule ? ' · powered by SupplierAdvisor®' : ' · Verified. Transparent.'}
              </p>
              <p style="margin:8px 0 0;font-size:11px;line-height:1.5;color:#94a3b8;">
                ${escapeEmailHtml(input.footerNote || `Sent on behalf of ${brand}. Replies go to SupplierAdvisor.`)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function detailCard(opts: {
  skin: AdvisorEmailSkin;
  kicker: string;
  title: string;
  lines: string[];
}): string {
  const lines = opts.lines
    .filter(Boolean)
    .map(
      (line, i) =>
        `<p style="margin:${i === 0 ? '8px' : '4px'} 0 0;font-size:${i === 0 ? '17px' : '14px'};font-weight:${i === 0 ? '800' : '500'};color:${i === 0 ? '#0f172a' : '#475569'};">${line}</p>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${opts.skin.accentSoft};border:1px solid #e2e8f0;border-radius:18px;">
    <tr>
      <td style="width:6px;background:${opts.skin.accent};border-radius:18px 0 0 18px;font-size:0;">&nbsp;</td>
      <td style="padding:16px 18px;">
        <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${opts.skin.accentDark};">${escapeEmailHtml(opts.kicker)}</p>
        <p style="margin:8px 0 0;font-size:17px;font-weight:800;color:#0f172a;">${opts.title}</p>
        ${lines}
      </td>
    </tr>
  </table>`;
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
  const profileUrl = absolutePublicUrl('/me') || `${getAppUrl()}/me`;
  const extra = pre
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 4px;background:#fffbeb;border:1px solid #fde68a;border-radius:18px;">
         <tr>
           <td style="padding:16px 18px;font-family:${FONT};">
             <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#92400e;">Before you come</p>
             <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#78350f;">
               Please open the <strong>SA Member</strong> app (your personal wallet) and make sure your profile is up to date — contact details, medical aid, and emergency contact.
             </p>
             <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#78350f;">
               If you can, list any ailments, injuries, allergies or medicines you are taking. Your clinician can then prepare and look after you safely.
             </p>
             <p style="margin:14px 0 0;">
               <a href="${escapeEmailHtml(profileUrl)}" style="display:inline-block;background:#fff;color:${skin.accentDark};border:1px solid ${skin.accentDark};text-decoration:none;font-weight:800;font-size:13px;padding:10px 18px;border-radius:999px;">
                 Update SA Member profile
               </a>
             </p>
           </td>
         </tr>
       </table>`
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

  const html = renderClientEmailLayout({
    moduleKey: input.moduleKey,
    moduleLabel: input.moduleLabel,
    brand,
    logoUrl: input.logoUrl,
    preheader: subject,
    headline,
    leadHtml: lead,
    detailHtml: detailCard({
      skin,
      kicker: pre ? 'Upcoming visit' : 'Your visit',
      title: escapeEmailHtml(input.eventTitle),
      lines: [
        escapeEmailHtml(when),
        input.practitionerName
          ? escapeEmailHtml(`with ${input.practitionerName}`)
          : '',
        input.location ? escapeEmailHtml(input.location) : '',
      ],
    }),
    extraHtml: extra,
    ctaUrl: cta,
    ctaLabel: pre ? 'View / manage booking' : 'Rate this visit',
  });

  return { subject, html };
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
  moduleLabel?: string | null;
};

export function renderAdvisorInvoiceEmail(input: AdvisorInvoiceEmailInput): {
  subject: string;
  html: string;
} {
  const skin = advisorEmailSkin(input.moduleKey || input.moduleLabel);
  const brand = input.brand || skin.product;
  const name = input.personName || 'there';
  const inv = input.invoiceNumber ? String(input.invoiceNumber) : '';
  const subject = inv
    ? `Invoice ${inv} from ${brand} · ${input.amountLabel}`
    : `Invoice from ${brand} · ${input.amountLabel}`;
  const html = renderClientEmailLayout({
    moduleKey: input.moduleKey,
    moduleLabel: input.moduleLabel,
    brand,
    logoUrl: input.logoUrl,
    preheader: subject,
    headline: `Invoice ready, ${escapeEmailHtml(name)}`,
    leadHtml: `<strong>${escapeEmailHtml(brand)}</strong> sent you an invoice. It is on your SA Member profile so you can view it, pay by card, or send proof of payment.`,
    detailHtml: detailCard({
      skin,
      kicker: inv || 'Invoice',
      title: escapeEmailHtml(input.description),
      lines: [
        escapeEmailHtml(input.amountLabel),
        input.dueDate ? escapeEmailHtml(`Due ${input.dueDate}`) : '',
      ],
    }),
    ctaUrl: input.ctaUrl,
    ctaLabel: 'View invoice in SA Member',
  });
  return { subject, html };
}

export type AdvisorNoticeEmailInput = {
  personName?: string | null;
  brand: string;
  headline: string;
  leadHtml: string;
  kicker?: string;
  detailKicker?: string;
  detailTitle?: string;
  detailLines?: string[];
  extraHtml?: string;
  logoUrl?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string;
  moduleKey?: string | null;
  moduleLabel?: string | null;
  subject: string;
};

export function renderAdvisorNoticeEmail(input: AdvisorNoticeEmailInput): {
  subject: string;
  html: string;
} {
  const skin = advisorEmailSkin(input.moduleKey || input.moduleLabel);
  const brand = input.brand || skin.product;
  const html = renderClientEmailLayout({
    moduleKey: input.moduleKey,
    moduleLabel: input.moduleLabel,
    brand,
    logoUrl: input.logoUrl,
    preheader: input.subject,
    kicker: input.kicker,
    headline: input.headline,
    leadHtml: input.leadHtml,
    detailHtml:
      input.detailTitle
        ? detailCard({
            skin,
            kicker: input.detailKicker || 'Details',
            title: escapeEmailHtml(input.detailTitle),
            lines: (input.detailLines || []).map((l) => escapeEmailHtml(l)),
          })
        : undefined,
    extraHtml: input.extraHtml,
    ctaUrl: input.ctaUrl,
    ctaLabel: input.ctaLabel,
  });
  return { subject: input.subject, html };
}

function tryResend() {
  try {
    if (!process.env.RESEND_API_KEY) return null;
    return getResend();
  } catch {
    return null;
  }
}

function fromWithDisplayName(displayName: string): string {
  const base = getResendFrom();
  const addr = /<([^>]+)>/.exec(base)?.[1] || 'hello@supplieradvisor.com';
  const name = String(displayName || 'SupplierAdvisor')
    .replace(/[<>\n\r]/g, '')
    .trim()
    .slice(0, 70);
  return `${name || 'SupplierAdvisor'} <${addr}>`;
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
      from: fromWithDisplayName(input.brand),
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
      from: fromWithDisplayName(input.brand),
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

export async function sendAdvisorNoticeEmail(
  to: string,
  input: AdvisorNoticeEmailInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const resend = tryResend();
    if (!resend) {
      return { ok: false, error: 'Email not configured (RESEND_API_KEY)' };
    }
    if (!to || !to.includes('@')) {
      return { ok: false, error: 'No email' };
    }
    const { subject, html } = renderAdvisorNoticeEmail(input);
    const { error } = await resend.emails.send({
      from: fromWithDisplayName(input.brand),
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
