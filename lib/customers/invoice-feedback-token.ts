/**
 * Signed public tokens for invoice feedback links (rate / claim / RIAD).
 * HMAC + expiry, same idea as doc-share-token.ts.
 *
 * Preferred format:
 *   i1.{b64url json}.{b64url hmac-sha256}
 *
 * Unsigned v1_{companyId}_{invoiceId} and base64url("inv:…") are accepted
 * only while INVOICE_FEEDBACK_ALLOW_LEGACY is not false (printed QR transition).
 */
import { createHmac, timingSafeEqual } from 'crypto';

export type InvoiceFeedbackPayload = {
  companyId: number;
  invoiceId: number;
  invoiceNumber: string;
  exp: number;
};

function secret(): string {
  return (
    process.env.INVOICE_FEEDBACK_SECRET ||
    process.env.DOC_SHARE_SECRET ||
    process.env.CRON_SECRET ||
    'supplieradvisor-invoice-feedback-dev'
  );
}

function allowLegacyFeedbackTokens(): boolean {
  const raw = process.env.INVOICE_FEEDBACK_ALLOW_LEGACY;
  if (raw === undefined || raw === '') return true;
  return !['0', 'false', 'no', 'off'].includes(String(raw).toLowerCase().trim());
}

function ttlSeconds(): number {
  const n = Number(process.env.INVOICE_FEEDBACK_TTL_SECONDS);
  if (Number.isFinite(n) && n > 60) return Math.floor(n);
  return 60 * 60 * 24 * 730; // 2 years — printed invoices
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

export function buildInvoiceFeedbackToken(opts: {
  companyId: number;
  invoiceId: number;
  invoiceNumber?: string | null;
  ttlSeconds?: number;
}): string {
  const companyId = Math.floor(Number(opts.companyId));
  const invoiceId = Math.floor(Number(opts.invoiceId));
  if (!Number.isFinite(companyId) || companyId <= 0) {
    throw new Error('buildInvoiceFeedbackToken: valid companyId required');
  }
  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    throw new Error('buildInvoiceFeedbackToken: valid invoiceId required');
  }
  const payload: InvoiceFeedbackPayload = {
    companyId,
    invoiceId,
    invoiceNumber: String(opts.invoiceNumber || '').slice(0, 64),
    exp: Math.floor(Date.now() / 1000) + (opts.ttlSeconds ?? ttlSeconds()),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret()).update(body).digest();
  return `i1.${body}.${b64url(sig)}`;
}

/** Normalize tokens from path params / query / copy-paste. */
export function normalizeFeedbackToken(raw: unknown): string {
  let t = String(raw ?? '').trim();
  if (!t) return '';
  // Accidental full URL pasted
  const pathMatch = t.match(/\/i\/([^/?#]+)/i);
  if (pathMatch?.[1]) t = pathMatch[1];
  // Drop query/hash if they snuck into the segment
  t = t.split('?')[0].split('#')[0];
  // Decode up to twice (double-encoding from some PDF / mail clients)
  for (let i = 0; i < 2; i++) {
    try {
      const d = decodeURIComponent(t);
      if (d === t) break;
      t = d;
    } catch {
      break;
    }
  }
  // Spaces from + mishandling
  t = t.replace(/\s+/g, '+');
  return t.trim();
}

function parseHmacInvoiceFeedbackToken(
  t: string
): { companyId: number; invoiceId: number; invoiceNumber: string } | null {
  if (!t.startsWith('i1.')) return null;
  const parts = t.split('.');
  if (parts.length !== 3) return null;
  const [, body, sigB64] = parts;
  try {
    const expected = createHmac('sha256', secret()).update(body).digest();
    const got = fromB64url(sigB64);
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
      return null;
    }
    const payload = JSON.parse(
      fromB64url(body).toString('utf8')
    ) as InvoiceFeedbackPayload;
    if (!payload?.companyId || !payload?.invoiceId) return null;
    if (Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return {
      companyId: Number(payload.companyId),
      invoiceId: Number(payload.invoiceId),
      invoiceNumber: String(payload.invoiceNumber || ''),
    };
  } catch {
    return null;
  }
}

function parseLegacyInvoiceFeedbackToken(
  t: string
): { companyId: number; invoiceId: number; invoiceNumber: string } | null {
  const v1 = /^v1_(\d+)_(\d+)(?:_([A-Za-z0-9]+))?$/.exec(t);
  if (v1) {
    return {
      companyId: Number(v1[1]),
      invoiceId: Number(v1[2]),
      invoiceNumber: v1[3] || '',
    };
  }

  try {
    let b64 = t.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? 0 : 4 - (b64.length % 4);
    if (pad) b64 += '='.repeat(pad);
    const raw = Buffer.from(b64, 'base64').toString('utf8').replace(/\0/g, '').trim();
    const m = /^inv:(\d+):(\d+):(.*)$/s.exec(raw);
    if (!m) return null;
    return {
      companyId: Number(m[1]),
      invoiceId: Number(m[2]),
      invoiceNumber: m[3] || '',
    };
  } catch {
    return null;
  }
}

export function parseInvoiceFeedbackToken(
  token: string
): { companyId: number; invoiceId: number; invoiceNumber: string } | null {
  const t = normalizeFeedbackToken(token);
  if (!t) return null;

  const signed = parseHmacInvoiceFeedbackToken(t);
  if (signed) return signed;

  if (!allowLegacyFeedbackTokens()) return null;
  return parseLegacyInvoiceFeedbackToken(t);
}

export function appBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://www.supplieradvisor.com';
  return String(raw).replace(/\/$/, '');
}

export function invoiceFeedbackUrl(token: string): string {
  const safe = encodeURIComponent(token).replace(/%5F/gi, '_').replace(/%2E/gi, '.');
  return `${appBaseUrl()}/i/${safe}`;
}

/** QR image via public encoder (no extra npm dep). */
export function qrImageUrl(data: string, size = 140): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;
}
