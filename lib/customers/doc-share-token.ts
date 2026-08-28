/**
 * Signed public tokens for commercial document PDF links (WhatsApp / email).
 * Prefer DOC_SHARE_SECRET. Production may use INVOICE_FEEDBACK_SECRET or
 * CRON_SECRET so sending an invoice is not blocked when the dedicated var
 * is missing. Never uses Resend keys or a hardcoded production secret.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { appBaseUrl } from '@/lib/customers/invoice-feedback-token';

export type DocSharePayload = {
  companyId: number;
  type: 'quote' | 'order' | 'invoice';
  id: number;
  exp: number; // unix seconds
};

function isProd(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  );
}

function secret(): string {
  const dedicated = String(process.env.DOC_SHARE_SECRET || '').trim();
  if (dedicated) return dedicated;
  const feedback = String(process.env.INVOICE_FEEDBACK_SECRET || '').trim();
  if (feedback) return feedback;
  const cron = String(process.env.CRON_SECRET || '').trim();
  if (cron) return cron;
  if (isProd()) {
    throw new Error(
      'DOC_SHARE_SECRET is required in production (or INVOICE_FEEDBACK_SECRET / CRON_SECRET)'
    );
  }
  return 'supplieradvisor-doc-share-dev';
}

/** Sign a share token; null if production HMAC is not configured. */
export function tryBuildDocShareToken(
  opts: Omit<DocSharePayload, 'exp'> & { ttlSeconds?: number }
): string | null {
  try {
    return buildDocShareToken(opts);
  } catch {
    return null;
  }
}

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8');
  return b
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  return Buffer.from(b64, 'base64');
}

/** Default: 30 days for quotes (valid until often shorter). */
export function buildDocShareToken(
  opts: Omit<DocSharePayload, 'exp'> & { ttlSeconds?: number }
): string {
  const ttl = opts.ttlSeconds ?? 60 * 60 * 24 * 30;
  const payload: DocSharePayload = {
    companyId: Math.floor(Number(opts.companyId)),
    type: opts.type,
    id: Math.floor(Number(opts.id)),
    exp: Math.floor(Date.now() / 1000) + ttl,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret()).update(body).digest();
  return `d1.${body}.${b64url(sig)}`;
}

export function parseDocShareToken(raw: string): DocSharePayload | null {
  const t = String(raw || '').trim();
  if (!t.startsWith('d1.')) return null;
  const parts = t.split('.');
  if (parts.length !== 3) return null;
  const [, body, sigB64] = parts;
  try {
    const expected = createHmac('sha256', secret()).update(body).digest();
    const got = fromB64url(sigB64);
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
      return null;
    }
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as DocSharePayload;
    if (!payload?.companyId || !payload?.id || !payload?.type) return null;
    if (!['quote', 'order', 'invoice'].includes(payload.type)) return null;
    if (Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return {
      companyId: Number(payload.companyId),
      type: payload.type,
      id: Number(payload.id),
      exp: Number(payload.exp),
    };
  } catch {
    return null;
  }
}

/** Public PDF URL for WhatsApp / email body. */
export function commercialDocPdfUrl(token: string): string {
  const safe = encodeURIComponent(token);
  return `${appBaseUrl()}/api/public/docs/pdf?token=${safe}`;
}

/** Authenticated download (seller session). */
export function commercialDocPdfMemberUrl(opts: {
  companyId: number;
  type: string;
  id: number;
}): string {
  const q = new URLSearchParams({
    companyId: String(opts.companyId),
    type: opts.type,
    id: String(opts.id),
    format: 'pdf',
  });
  return `${appBaseUrl()}/api/customers/docs/render?${q}`;
}
