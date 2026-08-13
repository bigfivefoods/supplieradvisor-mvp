import { getAppUrl } from '@/lib/resend';

/** Deep-link into SA Member so login then auto-links the portal token. */
export function memberAppLink(portalToken: string): string {
  const base = getAppUrl().replace(/\/$/, '');
  return `${base}/me?link=${encodeURIComponent(portalToken)}`;
}

export function memberAppHomeUrl(): string {
  return `${getAppUrl().replace(/\/$/, '')}/me`;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function hireInviteWhatsAppText(opts: {
  customerName?: string | null;
  brand: string;
  appLink: string;
}): string {
  const who = opts.customerName ? `${opts.customerName}, ` : '';
  return `${who}${opts.brand} invited you to SA Member — hire gear, track bookings and complete docs on your phone.\n\nOpen the app: ${opts.appLink}`;
}

export function gymInviteWhatsAppText(opts: {
  memberName?: string | null;
  brand: string;
  appLink: string;
}): string {
  const who = opts.memberName ? `${opts.memberName}, ` : '';
  return `${who}${opts.brand} invited you to SA Member — book classes and check in at the door.\n\nOpen the app: ${opts.appLink}`;
}

export function digitsPhone(raw: string | null | undefined): string {
  return String(raw || '').replace(/\D/g, '');
}

export function emailsMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const x = String(a || '').trim().toLowerCase();
  const y = String(b || '').trim().toLowerCase();
  return Boolean(x && y && x === y);
}

export function phonesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const x = digitsPhone(a);
  const y = digitsPhone(b);
  if (x.length < 7 || y.length < 7) return false;
  return x.endsWith(y) || y.endsWith(x);
}
