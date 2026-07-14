/**
 * Client-safe WhatsApp share helpers (wa.me deep links).
 * No Twilio required — opens WhatsApp with pre-filled invite text.
 */

/** Digits-only E.164 (no +) for https://wa.me/<digits>?text=… */
export function toWhatsAppE164Digits(
  phone: string | null | undefined,
  defaultCountry = '27'
): string | null {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  // SA local: 082… → 2782…
  if (d.startsWith('0') && d.length === 10) {
    d = `${defaultCountry}${d.slice(1)}`;
  }
  // 9-digit mobile without leading 0 (82… / 71…)
  if (d.length === 9 && /^[6-8]/.test(d)) {
    d = `${defaultCountry}${d}`;
  }
  // Already country-coded (e.g. 27…)
  if (d.length < 10 || d.length > 15) return null;
  return d;
}

export function formatPhoneDisplay(phone: string | null | undefined): string {
  const d = toWhatsAppE164Digits(phone);
  if (!d) return String(phone || '').trim();
  if (d.startsWith('27') && d.length === 11) {
    return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  }
  return `+${d}`;
}

export function buildWhatsAppShareUrl(opts: {
  phone?: string | null;
  text: string;
}): string {
  const digits = toWhatsAppE164Digits(opts.phone);
  const q = encodeURIComponent(opts.text);
  if (digits) return `https://wa.me/${digits}?text=${q}`;
  // No number → WhatsApp contact picker / share sheet
  return `https://wa.me/?text=${q}`;
}

export function resellerInviteWhatsAppText(params: {
  resellerName?: string | null;
  companyName?: string | null;
  inviteLink: string;
}): string {
  const first =
    (params.resellerName || '').trim().split(/\s+/)[0] || 'there';
  const company =
    (params.companyName || '').trim() || 'your network operator';
  return [
    `Hi ${first}! 👋`,
    ``,
    `You've been invited as a *container network reseller* for *${company}* on SupplierAdvisor.`,
    ``,
    `Tap the link to confirm and open your portal:`,
    params.inviteLink,
    ``,
    `In the portal you can see stock, record sales, earn commission, log customer feedback, and report field issues (RIAD).`,
  ].join('\n');
}
