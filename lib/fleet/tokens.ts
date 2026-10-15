/**
 * FleetAdvisor® portal tokens. Server only (node:crypto).
 * Do not import this file from a client component.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function newPortalToken(): string {
  return `fgp_${randomBytes(32).toString('hex')}`;
}

export function hashPortalToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function portalTokenHint(token: string): string {
  return token.slice(-4);
}

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
  return /^fgp_[0-9a-f]{64}$/.test(token);
}
