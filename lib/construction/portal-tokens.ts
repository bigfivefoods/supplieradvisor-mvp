/**
 * ConstructionAdvisor® portal tokens. Server only (node:crypto).
 * Do not import this file from client pages. constructiongraph.ts is on the
 * client graph; minting and hashing for routes live here.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const ATTEMPT_SALT = 'constructiongraph-portal-attempt-v1';

export function newPortalToken(): string {
  return `cgp_${randomBytes(32).toString('hex')}`;
}

export function hashPortalToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function portalTokenHint(token: string): string {
  return token.slice(-4);
}

export function newPortalRowId(): string {
  return `cgpr_${randomBytes(16).toString('hex')}`;
}

/** timingSafeEqual on equal-length hex. Length mismatches return false. */
export function digestsMatch(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length === 0 || a.length !== b.length || a.length % 2 !== 0) return false;
  try {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    if (left.length !== right.length || left.length * 2 !== a.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function isPortalTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(token);
}

/** Salted SHA-256 of a client IP. The raw IP is never stored. */
export function portalAttemptKeyHash(ip: string): string {
  return createHash('sha256').update(`${ATTEMPT_SALT}:${ip}`).digest('hex');
}
