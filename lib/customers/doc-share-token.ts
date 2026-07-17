/**
 * Signed public tokens for commercial document PDF links (WhatsApp / email).
 * HMAC with DOC_SHARE_SECRET or CRON_SECRET or RESEND_API_KEY fallback.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { appBaseUrl } from '@/lib/customers/invoice-feedback-token';

export type DocSharePayload = {
  companyId: number;
  type: 'quote' | 'order' | 'invoice';
  id: number;
  exp: number; // unix seconds
};

function secret(): string {
  return (
    process.env.DOC_SHARE_SECRET ||
    process.env.CRON_SECRET ||
    process.env.RESEND_API_KEY ||
    'supplieradvisor-doc-share-dev'
  );
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
