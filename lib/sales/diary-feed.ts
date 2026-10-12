/**
 * Secret URL for the sales diary.
 * Google, Apple, and Outlook fetch it with no Privy cookie, so the token is the gate.
 * No expiry: a subscribe link has to keep working. Rotating the server secret revokes every link.
 * Prefer SALES_DIARY_FEED_SECRET. Production may reuse the existing share or cron secret.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { appBaseUrl } from '@/lib/customers/invoice-feedback-token';

export type DiaryFeedLinks = {
  https: string;
  webcal: string;
  google: string;
  outlook: string;
};

function isProd(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function secret(): string {
  const dedicated = String(process.env.SALES_DIARY_FEED_SECRET || '').trim();
  if (dedicated) return dedicated;
  const share = String(process.env.DOC_SHARE_SECRET || '').trim();
  if (share) return share;
  const feedback = String(process.env.INVOICE_FEEDBACK_SECRET || '').trim();
  if (feedback) return feedback;
  const cron = String(process.env.CRON_SECRET || '').trim();
  if (cron) return cron;
  if (isProd()) {
    throw new Error('SALES_DIARY_FEED_SECRET is required in production');
  }
  return 'supplieradvisor-diary-feed-dev';
}

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8');
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  return Buffer.from(b64, 'base64');
}

/** Sign a company diary feed. Throws in production when no secret is configured. */
export function buildDiaryFeedToken(companyId: number): string {
  const id = Math.floor(Number(companyId));
  if (!Number.isFinite(id) || id <= 0) throw new Error('company');
  const body = b64url(JSON.stringify({ c: id, k: 'sales-diary' }));
  const sig = createHmac('sha256', secret()).update(body).digest();
  return `s1.${body}.${b64url(sig)}`;
}

export function tryDiaryFeedToken(companyId: number): string | null {
  try {
    return buildDiaryFeedToken(companyId);
  } catch {
    return null;
  }
}

/** Company id from a feed token, or null when the token is missing or forged. */
export function parseDiaryFeedToken(raw: string): number | null {
  const token = String(raw || '').trim();
  if (!token.startsWith('s1.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, body, sigB64] = parts;
  try {
    const expected = createHmac('sha256', secret()).update(body).digest();
    const got = fromB64url(sigB64);
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as { c?: unknown; k?: unknown };
    if (payload.k !== 'sales-diary') return null;
    const id = Math.floor(Number(payload.c));
    if (!Number.isFinite(id) || id <= 0) return null;
    return id;
  } catch {
    return null;
  }
}

export function diaryFeedLinks(companyId: number): DiaryFeedLinks | null {
  const token = tryDiaryFeedToken(companyId);
  if (!token) return null;
  const https = `${appBaseUrl()}/api/public/sales/diary/ics/${encodeURIComponent(token)}.ics`;
  const webcal = https.replace(/^https:/i, 'webcal:');
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent('Sales diary')}`,
  };
}
