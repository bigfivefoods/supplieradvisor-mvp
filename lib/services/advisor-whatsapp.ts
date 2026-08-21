/**
 * WhatsApp deep links + message templates for Advisor desk / portals.
 * Uses wa.me (no Twilio required). Optional Twilio can wrap later.
 */

export function normalizeWhatsAppNumber(raw?: string | null): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (!d || /^0+$/.test(d)) return null;
  // SA local 0xx → 27xx
  if (d.startsWith('0') && d.length === 10) d = `27${d.slice(1)}`;
  if (/^0+$/.test(d)) return null;
  return d;
}

export function isPlaceholderPhone(raw?: string | null): boolean {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length >= 6 && /^0+$/.test(d);
}

export function whatsAppUrl(phone: string, text: string): string {
  const n = normalizeWhatsAppNumber(phone);
  const q = encodeURIComponent(text);
  if (!n) return `https://wa.me/?text=${q}`;
  return `https://wa.me/${n}?text=${q}`;
}

export const WA_TEMPLATES = {
  booking_confirm: (opts: {
    name: string;
    brand: string;
    title: string;
    date: string;
    time: string;
    manageUrl?: string;
  }) =>
    `Hi ${opts.name}, your booking at ${opts.brand} is confirmed:\n${opts.title}\n${opts.date} at ${opts.time.slice(0, 5)}${
      opts.manageUrl ? `\nManage: ${opts.manageUrl}` : ''
    }\n— ${opts.brand}`,

  reminder_24h: (opts: {
    name: string;
    brand: string;
    title: string;
    date: string;
    time: string;
    manageUrl?: string;
  }) =>
    `Reminder: ${opts.title} tomorrow (${opts.date}) at ${opts.time.slice(0, 5)} — ${opts.brand}.${
      opts.manageUrl ? ` Details: ${opts.manageUrl}` : ''
    }`,

  waitlist_offer: (opts: {
    name: string;
    brand: string;
    title: string;
    date: string;
    time: string;
  }) =>
    `Good news ${opts.name}! A spot opened for ${opts.title} on ${opts.date} at ${opts.time.slice(0, 5)} at ${opts.brand}. You're booked — see you there.`,

  recall: (opts: {
    name: string;
    brand: string;
    reason?: string;
  }) =>
    `Hi ${opts.name}, it's time for your follow-up${
      opts.reason ? ` (${opts.reason})` : ''
    } at ${opts.brand}. Reply to this message or book online.`,

  no_show_followup: (opts: {
    name: string;
    brand: string;
    title: string;
  }) =>
    `Hi ${opts.name}, we missed you at ${opts.title} (${opts.brand}). Reply to rebook — happy to help find a time.`,
} as const;

export type WaTemplateId = keyof typeof WA_TEMPLATES;
