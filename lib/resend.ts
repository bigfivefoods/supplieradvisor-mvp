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

/**
 * Verified Resend "from" address.
 * Prefer RESEND_FROM_EMAIL; fall back to the verified supplieradvisor.co.za domain
 * (onboarding@resend.dev only delivers to the Resend account owner).
 */
export function getResendFrom(): string {
  const from =
    process.env.RESEND_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    'SupplierAdvisor <invites@supplieradvisor.co.za>';
  return from.trim();
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
