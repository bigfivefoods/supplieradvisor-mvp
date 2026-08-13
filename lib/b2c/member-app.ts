import { getAppUrl } from '@/lib/resend';

/** Deep-link into SA Member so login then auto-links the portal token. */
export function memberAppLink(portalToken: string): string {
  const base = getAppUrl().replace(/\/$/, '');
  return `${base}/me?link=${encodeURIComponent(portalToken)}`;
}

export function memberAppHomeUrl(): string {
  return `${getAppUrl().replace(/\/$/, '')}/me`;
}

export type MemberAppJoinKind =
  | 'hire'
  | 'gym'
  | 'physio'
  | 'dental'
  | 'medical'
  | 'psychiatry'
  | 'customer'
  | 'supplier';

export function isPlatformJoinKind(kind?: string | null): boolean {
  return kind === 'supplier';
}

/** Brand poster / desk QR — SA Member (B2C) or company join (B2B customer/supplier). */
export function memberAppJoinPath(opts: {
  companyId?: number | null;
  kind?: MemberAppJoinKind | string | null;
  brand?: string | null;
}): string {
  const q = new URLSearchParams();
  if (isPlatformJoinKind(opts.kind)) {
    q.set('lane', 'b2b');
    q.set('as', String(opts.kind));
    if (opts.companyId && Number.isFinite(Number(opts.companyId))) {
      q.set('company', String(opts.companyId));
    }
    if (opts.brand?.trim()) q.set('brand', opts.brand.trim());
    return `/onboarding?${q.toString()}`;
  }
  q.set('join', '1');
  if (opts.companyId && Number.isFinite(Number(opts.companyId))) {
    q.set('company', String(opts.companyId));
  }
  if (opts.kind) q.set('kind', String(opts.kind));
  if (opts.brand?.trim()) q.set('brand', opts.brand.trim());
  return `/me?${q.toString()}`;
}

export function memberAppJoinUrl(
  origin: string,
  opts: {
    companyId?: number | null;
    kind?: MemberAppJoinKind | string | null;
    brand?: string | null;
  }
): string {
  const base = String(origin || '').replace(/\/$/, '') || getAppUrl().replace(/\/$/, '');
  return `${base}${memberAppJoinPath(opts)}`;
}

export function memberAppQrSrc(absoluteUrl: string, size = 280): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(absoluteUrl)}`;
}

export function memberAppJoinWhatsAppText(opts: {
  brand: string;
  appLink: string;
  kind?: MemberAppJoinKind | string | null;
  audience?: 'members' | 'patients' | 'customers' | 'suppliers';
}): string {
  if (opts.kind === 'supplier' || opts.audience === 'suppliers') {
    return `${opts.brand} invited you to join SupplierAdvisor as a supplier — register your company to trade on the network.\n\nOpen: ${opts.appLink}`;
  }
  if (opts.kind === 'customer') {
    return `${opts.brand} invited you to SA Member — your personal wallet for this account. Shop, book, manage subscriptions and stay connected.\n\nOpen: ${opts.appLink}`;
  }
  if (opts.kind === 'hire') {
    return `${opts.brand} — get the free SA Member app and link this hire desk to your wallet.\n\nOpen: ${opts.appLink}`;
  }
  return `${opts.brand} — get the free SA Member app, create your profile, and link this business to your wallet.\n\nOpen: ${opts.appLink}`;
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
