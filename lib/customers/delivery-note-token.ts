/**
 * Signed, revocable tokens for a public delivery-note view.
 * The nonce lives on the note in invoice metadata. Rotating it revokes old links.
 * Reuses DOC_SHARE_SECRET (or the same fallbacks as commercial document links).
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { appBaseUrl } from '@/lib/customers/invoice-feedback-token';
import type { DeliveryNoteRecord } from '@/lib/customers/delivery-note';

export type DeliveryNoteTokenPayload = {
  companyId: number;
  invoiceId: number;
  noteId: string;
  nonce: string;
  exp: number;
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

export function deliveryNoteTtlSeconds(): number {
  const n = Number(process.env.DELIVERY_NOTE_TTL_SECONDS);
  if (Number.isFinite(n) && n > 60) return Math.floor(n);
  return 60 * 60 * 24 * 180;
}

export function buildDeliveryNoteToken(opts: {
  companyId: number;
  invoiceId: number;
  noteId: string;
  nonce: string;
  ttlSeconds?: number;
}): string {
  const companyId = Math.floor(Number(opts.companyId));
  const invoiceId = Math.floor(Number(opts.invoiceId));
  const noteId = String(opts.noteId || '').trim();
  const nonce = String(opts.nonce || '').trim();
  if (!Number.isFinite(companyId) || companyId <= 0) {
    throw new Error('buildDeliveryNoteToken: valid companyId required');
  }
  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    throw new Error('buildDeliveryNoteToken: valid invoiceId required');
  }
  if (!noteId || !nonce) {
    throw new Error('buildDeliveryNoteToken: noteId and nonce required');
  }
  const payload: DeliveryNoteTokenPayload = {
    companyId,
    invoiceId,
    noteId: noteId.slice(0, 80),
    nonce: nonce.slice(0, 80),
    exp: Math.floor(Date.now() / 1000) + (opts.ttlSeconds ?? deliveryNoteTtlSeconds()),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret()).update(body).digest();
  return `dn1.${body}.${b64url(sig)}`;
}

export function tryBuildDeliveryNoteToken(
  opts: Parameters<typeof buildDeliveryNoteToken>[0]
): string | null {
  try {
    return buildDeliveryNoteToken(opts);
  } catch {
    return null;
  }
}

export function normalizeDeliveryNoteToken(raw: unknown): string {
  let t = String(raw ?? '').trim();
  if (!t) return '';
  const pathMatch = t.match(/\/d\/([^/?#]+)/i);
  if (pathMatch?.[1]) t = pathMatch[1];
  t = t.split('?')[0].split('#')[0];
  for (let i = 0; i < 2; i++) {
    try {
      const d = decodeURIComponent(t);
      if (d === t) break;
      t = d;
    } catch {
      break;
    }
  }
  return t.trim();
}

export function parseDeliveryNoteToken(raw: string): DeliveryNoteTokenPayload | null {
  const t = normalizeDeliveryNoteToken(raw);
  if (!t.startsWith('dn1.')) return null;
  const parts = t.split('.');
  if (parts.length !== 3) return null;
  const [, body, sigB64] = parts;
  try {
    const expected = createHmac('sha256', secret()).update(body).digest();
    const got = fromB64url(sigB64);
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
      return null;
    }
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as DeliveryNoteTokenPayload;
    if (!payload?.companyId || !payload?.invoiceId || !payload?.noteId || !payload?.nonce) {
      return null;
    }
    if (Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return {
      companyId: Number(payload.companyId),
      invoiceId: Number(payload.invoiceId),
      noteId: String(payload.noteId),
      nonce: String(payload.nonce),
      exp: Number(payload.exp),
    };
  } catch {
    return null;
  }
}

function sameSecret(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

/** True only when the token nonce still matches and the note is not revoked. */
export function deliveryNoteTokenMatches(
  note: DeliveryNoteRecord | null | undefined,
  payload: DeliveryNoteTokenPayload | null
): boolean {
  if (!note || !payload) return false;
  if (note.revoked_at) return false;
  if (note.id !== payload.noteId) return false;
  if (Number(note.invoice_id) && Number(note.invoice_id) !== payload.invoiceId) return false;
  return sameSecret(note.nonce, payload.nonce);
}

export function deliveryNotePublicUrl(token: string): string {
  const safe = encodeURIComponent(token);
  return `${appBaseUrl()}/d/${safe}`;
}

export function deliveryNotePdfUrl(token: string): string {
  const safe = encodeURIComponent(token);
  return `${appBaseUrl()}/api/public/delivery-note/pdf?token=${safe}`;
}

export function rotateNonce(): string {
  const buf = new Uint8Array(18);
  crypto.getRandomValues(buf);
  return Buffer.from(buf).toString('base64url');
}
