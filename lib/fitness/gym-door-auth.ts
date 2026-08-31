/**
 * Gym door authentication helpers — Brief 31.
 *
 * - Generate a 6-digit email code (10-min TTL, stored hashed).
 * - Verify the code against the stored hash (timing-safe).
 * - Hash / verify a 4–6 digit gym PIN.
 *
 * Uses Node.js built-in `crypto` — no new dependencies.
 * NEVER stores a plaintext code or PIN.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import type { FitClient, FitCoach, FitgraphStore } from './fitgraph';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Email code valid for 10 minutes. */
export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/** One-way SHA-256 hash (hex). Used for codes and PINs. */
export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Timing-safe comparison of two hex digests. */
export function secretsMatch(plain: string, storedHash: string): boolean {
  try {
    const a = Buffer.from(hashSecret(plain), 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.byteLength !== b.byteLength) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 6-digit email code
// ---------------------------------------------------------------------------

/** Pad-left to 6 digits (e.g. "007421"). */
export function generateEmailCode(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(6, '0');
}

export type AuthCodePayload = {
  code_hash: string;
  expires_at: string; // ISO
};

/** Build a hashed code payload ready to store on a person row. */
export function buildAuthCodePayload(
  code: string,
  nowMs = Date.now()
): AuthCodePayload {
  return {
    code_hash: hashSecret(code),
    expires_at: new Date(nowMs + EMAIL_CODE_TTL_MS).toISOString(),
  };
}

/** Returns true when the code matches the stored hash AND is not expired. */
export function verifyAuthCode(
  payload: AuthCodePayload | null | undefined,
  candidateCode: string,
  nowMs = Date.now()
): boolean {
  if (!payload?.code_hash || !payload.expires_at) return false;
  if (new Date(payload.expires_at).getTime() < nowMs) return false;
  return secretsMatch(candidateCode, payload.code_hash);
}

// ---------------------------------------------------------------------------
// 4–6 digit gym PIN
// ---------------------------------------------------------------------------

export function isValidPin(raw: string): boolean {
  return /^\d{4,6}$/.test(raw.trim());
}

export function hashPin(pin: string): string {
  return hashSecret(pin.trim());
}

export function verifyPin(candidate: string, storedHash: string): boolean {
  if (!storedHash) return false;
  return secretsMatch(candidate.trim(), storedHash);
}

// ---------------------------------------------------------------------------
// Lookup helpers (fail-closed)
// ---------------------------------------------------------------------------

/** Find a FitClient by email from the gym roster. Returns null when not found. */
export function findClientByEmail(
  store: FitgraphStore,
  email: string
): FitClient | null {
  const e = email.trim().toLowerCase();
  if (!e.includes('@')) return null;
  return (
    (store.clients || []).find((c) => {
      if (c.active === false) return false;
      const emails = [c.email, c.invite_email]
        .map((v) => String(v || '').trim().toLowerCase())
        .filter((v) => v.includes('@'));
      return emails.includes(e);
    }) || null
  );
}

/** Find a FitCoach by email from the gym roster. Returns null when not found. */
export function findCoachByEmail(
  store: FitgraphStore,
  email: string
): FitCoach | null {
  const e = email.trim().toLowerCase();
  if (!e.includes('@')) return null;
  return (
    (store.coaches || []).find((c) => {
      if (c.active === false) return false;
      const emails = [c.email, c.invite_email]
        .map((v) => String(v || '').trim().toLowerCase())
        .filter((v) => v.includes('@'));
      return emails.includes(e);
    }) || null
  );
}
