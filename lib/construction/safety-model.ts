/**
 * Health and safety dates. Flags come only from expires_on or valid_to.
 */
import { addDaysIso, type ConstructionSafetyRow } from './constructiongraph';
import { findBannedField } from './diary-model';

export const SAFETY_SEVERITIES = ['near_miss', 'first_aid', 'lost_time', 'property'] as const;
export type SafetySeverity = (typeof SAFETY_SEVERITIES)[number];

export const LEGACY_SAFETY_KINDS = ['toolbox', 'incident', 'inspection', 'permit'] as const;
export const SAFETY_KINDS = [
  ...LEGACY_SAFETY_KINDS,
  'induction',
  'risk_assessment',
  'method_statement',
] as const;

export function expiryFlag(
  iso: string | null | undefined,
  today: string
): 'none' | 'ok' | 'expiring' | 'expired' {
  if (!iso) return 'none';
  const day = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return 'none';
  if (day < today) return 'expired';
  if (day <= addDaysIso(today, 30)) return 'expiring';
  return 'ok';
}

export function rowExpiry(row: ConstructionSafetyRow, today: string) {
  const fromExpires = expiryFlag(row.expires_on, today);
  const fromValid = expiryFlag(row.valid_to, today);
  if (fromExpires === 'expired' || fromValid === 'expired') return 'expired' as const;
  if (fromExpires === 'expiring' || fromValid === 'expiring') return 'expiring' as const;
  if (fromExpires === 'ok' || fromValid === 'ok') return 'ok' as const;
  return 'none' as const;
}

export function assertSafetyRows(
  rows: ConstructionSafetyRow[]
): { ok: true } | { ok: false; error: string } {
  const banned = findBannedField(rows);
  if (banned) return { ok: false, error: 'Identity numbers are not stored' };
  for (const row of rows) {
    if (row.severity && !SAFETY_SEVERITIES.includes(row.severity as SafetySeverity)) {
      return { ok: false, error: 'Severity not recognised' };
    }
  }
  return { ok: true };
}

export function expiringInductions(rows: ConstructionSafetyRow[], today: string) {
  return rows.filter(
    (row) => row.kind === 'induction' && rowExpiry(row, today) === 'expiring'
  );
}
