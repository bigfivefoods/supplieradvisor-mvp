/**
 * Sealed OAuth refresh tokens and Apple app passwords, plus short-lived OAuth state.
 * Uses the same server secret chain as the diary feed. Never log the plaintext.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

type StatePayload = {
  companyId: number;
  userId: string;
  provider: 'google' | 'outlook';
  exp: number;
};

function isProd(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

export function calendarSecret(): string {
  const keys = [
    process.env.SALES_DIARY_FEED_SECRET,
    process.env.DOC_SHARE_SECRET,
    process.env.INVOICE_FEEDBACK_SECRET,
    process.env.CRON_SECRET,
  ];
  for (const key of keys) {
    const value = String(key || '').trim();
    if (value) return value;
  }
  if (isProd()) throw new Error('SALES_DIARY_FEED_SECRET is required in production');
  return 'supplieradvisor-diary-feed-dev';
}

function keyBytes(): Buffer {
  return createHash('sha256').update(calendarSecret()).digest();
}

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8');
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromB64url(value: string): Buffer {
  const pad = value.length % 4 === 0 ? 0 : 4 - (value.length % 4);
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad), 'base64');
}

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${b64url(iv)}.${b64url(tag)}.${b64url(ciphertext)}`;
}

export function openSecret(sealed: string): string | null {
  const parts = String(sealed || '').split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyBytes(), fromB64url(parts[1]));
    decipher.setAuthTag(fromB64url(parts[2]));
    const plain = Buffer.concat([decipher.update(fromB64url(parts[3])), decipher.final()]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}

export function signCalendarState(opts: { companyId: number; userId: string; provider: 'google' | 'outlook' }): string {
  const payload: StatePayload = {
    companyId: Math.floor(opts.companyId),
    userId: opts.userId,
    provider: opts.provider,
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', calendarSecret()).update(body).digest();
  return `c1.${body}.${b64url(sig)}`;
}

export function readCalendarState(raw: string): StatePayload | null {
  const parts = String(raw || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'c1') return null;
  try {
    const expected = createHmac('sha256', calendarSecret()).update(parts[1]).digest();
    const got = fromB64url(parts[2]);
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
    const payload = JSON.parse(fromB64url(parts[1]).toString('utf8')) as StatePayload;
    if (!payload.companyId || !payload.userId) return null;
    if (payload.provider !== 'google' && payload.provider !== 'outlook') return null;
    if (Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
}

export function outlookConfigured(): boolean {
  return Boolean(process.env.MICROSOFT_CALENDAR_CLIENT_ID && process.env.MICROSOFT_CALENDAR_CLIENT_SECRET);
}
