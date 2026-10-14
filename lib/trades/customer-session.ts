import { createHash, randomBytes, randomInt } from 'node:crypto';

export const TRADE_SESSION_COOKIE = 'sa_trade_customer';
export const TRADE_SESSION_DAYS = 30;
export const TRADE_OTP_MINUTES = 15;
export const TRADE_MAGIC_DAYS = 7;

export function hashSecret(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function newSecret(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function newOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function sessionCookieOptions(maxAgeSec = TRADE_SESSION_DAYS * 24 * 60 * 60) {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSec,
  };
}

export function magicLink(origin: string, publicToken: string, magic: string): string {
  const url = new URL(
    `/customer/tradegraph/${encodeURIComponent(publicToken)}`,
    origin
  );
  url.searchParams.set('magic', magic);
  return url.toString();
}
