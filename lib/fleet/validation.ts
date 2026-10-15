/**
 * FleetAdvisor® input checks. Rejects identity-number keys. Caps are bounds, not norms.
 */
import { ledgerCategoryAllowed } from './cpk';
import type { RunningCategory } from './types';

const IDENTITY_KEYS = new Set([
  'id_number',
  'id_no',
  'identity_number',
  'sa_id',
  'said',
  'passport',
  'passport_no',
  'passport_number',
  'licence_no',
  'licence_number',
  'license_no',
  'license_number',
  'drivers_licence_no',
  'driver_licence_no',
  'national_id',
]);

const MAX_TEXT = 200;
const MAX_NOTE = 2000;
const MAX_MONEY = 1_000_000_000_000;

export function findIdentityKey(value: unknown, depth = 0): string | null {
  if (depth > 6 || value == null) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findIdentityKey(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (IDENTITY_KEYS.has(key.toLowerCase())) return key;
    const hit = findIdentityKey(child, depth + 1);
    if (hit) return hit;
  }
  return null;
}

export function cleanText(value: unknown, max = MAX_TEXT): string {
  return String(value ?? '').trim().slice(0, max);
}

export function cleanEmail(value: unknown): string {
  return cleanText(value, 200).toLowerCase();
}

export function cleanMoney(value: unknown): number | null {
  if (value == null || value === '') return null;
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || Math.abs(amount) > MAX_MONEY) return null;
  return Math.trunc(amount);
}

export function sameCompanyCustomer(profileId: number | null | undefined, companyId: number): boolean {
  return profileId != null && Number(profileId) === Number(companyId);
}

export type FieldError = { ok: false; error: string } | { ok: true };

function fail(error: string): FieldError {
  return { ok: false, error };
}

export function assertNoIdentity(value: unknown): FieldError {
  const key = findIdentityKey(value);
  if (key) return fail('That form asks for a detail this desk does not store.');
  return { ok: true };
}

/** Luhn check used by a South African identity number. */
export function isSaIdNumber(digits: string): boolean {
  if (!/^\d{13}$/.test(digits)) return false;
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (digits[10] !== '0' && digits[10] !== '1') return false;
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[index]);
    if ((digits.length - index) % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** Refuse a real SA ID and licence or passport phrases. A long reference is not an ID. */
export function assertNoIdentityText(value: string): FieldError {
  const tokens = value.match(/(?<!\d)\d{13}(?!\d)/g) || [];
  if (tokens.some((token) => isSaIdNumber(token))) return fail('Remove the identity number. This desk does not store it.');
  if (/\b(passport|licence|license)\s*(number|no\.?|#)/i.test(value)) {
    return fail('Remove the licence or passport number. This desk does not store it.');
  }
  return { ok: true };
}

export function assertLedgerCategory(category: string): FieldError {
  if (!ledgerCategoryAllowed(category)) {
    return fail('Standing and capital costs belong on the cost profile, not the ledger.');
  }
  const allowed: RunningCategory[] = ['fuel', 'toll', 'border', 'maintenance', 'tyres', 'other_running', 'fine', 'other'];
  if (!allowed.includes(category as RunningCategory)) return fail('Choose a cost category.');
  return { ok: true };
}

export function assertBounded(value: unknown, label: string, max = MAX_NOTE): FieldError {
  if (value == null) return { ok: true };
  if (typeof value === 'string' && value.length > max) return fail(`${label} is too long.`);
  if (typeof value === 'object') {
    try {
      if (JSON.stringify(value).length > 8000) return fail(`${label} is too long.`);
    } catch {
      return fail(`${label} could not be read.`);
    }
  }
  return { ok: true };
}
