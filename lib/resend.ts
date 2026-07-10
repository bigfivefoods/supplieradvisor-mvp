import { Resend } from 'resend';

let resendClient: Resend | null = null;

export function getResend(): Resend {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY in environment variables.');
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

/** Default transactional sender — domain must be verified in Resend. */
const DEFAULT_FROM = 'SupplierAdvisor <invites@supplieradvisor.com>';
/** Optional reply destination so recipients can respond to a real inbox. */
const DEFAULT_REPLY_TO = 'connect@supplieradvisor.com';

/**
 * Normalize a From header to a verified supplieradvisor.com address.
 * Accepts "Name <user@domain>" or bare "user@domain".
 */
function normalizeSupplierAdvisorFrom(raw: string | undefined | null): string | null {
  const from = String(raw || '')
    .trim()
    .replace(/^["']|["']$/g, '');
  if (!from) return null;
  // Never use unverified .co.za
  if (/@supplieradvisor\.co\.za\b/i.test(from)) return null;

  // Already a full From with @supplieradvisor.com
  if (/@supplieradvisor\.com\b/i.test(from)) {
    // Ensure display name is present for legitimacy
    if (from.includes('<') && from.includes('>')) return from;
    return `SupplierAdvisor <${from.replace(/^.*\s/, '').replace(/[<>]/g, '')}>`;
  }

  // Bare local-part like "invites" or "team" → map onto verified domain
  if (/^[a-z0-9._+-]+$/i.test(from)) {
    return `SupplierAdvisor <${from.toLowerCase()}@supplieradvisor.com>`;
  }

  // resend.dev sandbox only (dev)
  if (/@resend\.dev\b/i.test(from)) return from;

  return null;
}

/**
 * Verified Resend "from" address — always @supplieradvisor.com when possible.
 *
 * Once supplieradvisor.com is verified in Resend, any mailbox on that domain
 * can send (invites@, team@, noreply@, etc.) — you do not need a full inbox
 * provider unless you want people to reply.
 *
 * Env (optional): RESEND_FROM_EMAIL=SupplierAdvisor <invites@supplieradvisor.com>
 */
export function getResendFrom(): string {
  const candidates = [
    process.env.RESEND_FROM_EMAIL,
    process.env.EMAIL_FROM,
    process.env.FROM_EMAIL,
  ];
  for (const raw of candidates) {
    const normalized = normalizeSupplierAdvisorFrom(raw);
    if (normalized) return normalized;
  }
  return DEFAULT_FROM;
}

/**
 * Reply-To for transactional mail so replies land in a real inbox.
 * Env (optional): RESEND_REPLY_TO=connect@supplieradvisor.com
 */
export function getResendReplyTo(): string {
  const raw = String(process.env.RESEND_REPLY_TO || DEFAULT_REPLY_TO)
    .trim()
    .replace(/^["']|["']$/g, '');
  if (raw && /@supplieradvisor\.com\b/i.test(raw) && !/@supplieradvisor\.co\.za\b/i.test(raw)) {
    return raw.includes('<') ? raw : raw;
  }
  return DEFAULT_REPLY_TO;
}

/** Shared options for all Resend send calls (from + reply_to). */
export function getResendSendDefaults(): { from: string; replyTo: string } {
  return {
    from: getResendFrom(),
    replyTo: getResendReplyTo(),
  };
}

export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  // Production deploys should use the public marketing domain for invite links
  if (process.env.VERCEL_ENV === 'production') {
    return 'https://www.supplieradvisor.com';
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '');
  }
  return 'https://www.supplieradvisor.com';
}
