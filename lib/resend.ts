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

const VERIFIED_FROM = 'SupplierAdvisor <invites@supplieradvisor.com>';

/**
 * Verified Resend "from" address — always supplieradvisor.com (verified on Resend).
 * Ignores empty env values and any supplieradvisor.co.za address (not verified).
 */
export function getResendFrom(): string {
  const candidates = [
    process.env.RESEND_FROM_EMAIL,
    process.env.EMAIL_FROM,
    process.env.FROM_EMAIL,
  ];
  for (const raw of candidates) {
    const from = String(raw || '').trim().replace(/^["']|["']$/g, '');
    if (!from) continue;
    // Never use the unverified .co.za domain
    if (/@supplieradvisor\.co\.za\b/i.test(from)) continue;
    // Prefer / require supplieradvisor.com when a custom from is set
    if (/@supplieradvisor\.com\b/i.test(from) || /@resend\.dev\b/i.test(from)) {
      return from;
    }
    // Other custom domains: allow if explicitly configured (enterprise)
    if (from.includes('@') && !/@supplieradvisor\.co\.za\b/i.test(from)) {
      return from;
    }
  }
  return VERIFIED_FROM;
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
