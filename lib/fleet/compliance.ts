/**
 * FleetAdvisor® expiry status. Computed, never stored. Today is injected.
 */
import { addDays } from './cpk';
import { formatSastDate, sastDate } from './format';
import type { ComplianceKind } from './types';

export type ComplianceState = 'valid' | 'expiring' | 'expired' | 'no_date';

export const COMPLIANCE_LABELS: Record<ComplianceKind, string> = {
  licence_disc: 'Licence disc',
  roadworthy: 'Roadworthy',
  operator_card: 'Operator card',
  insurance: 'Insurance renewal',
  cross_border_permit: 'Cross-border permit',
  abnormal_permit: 'Abnormal permit',
  other_permit: 'Other permit',
  driver_licence: 'Driving licence',
  prdp: 'PrDP',
  medical: 'Medical review',
  induction: 'Induction',
  other: 'Other',
};

export function complianceStatus(
  expiresOn: string | null | undefined,
  today: string,
  windowDays: number
): ComplianceState {
  const expiry = sastDate(expiresOn);
  const day = sastDate(today);
  if (!expiry || !day) return 'no_date';
  if (expiry < day) return 'expired';
  const window = Math.max(0, Math.trunc(windowDays));
  const edge = addDays(day, window);
  if (expiry <= edge) return 'expiring';
  return 'valid';
}

export function daysBetween(from: string, toExclusive: string): number {
  const start = sastDate(from);
  const end = sastDate(toExclusive);
  if (!start || !end || start >= end) return 0;
  let count = 0;
  for (let day = start; day < end; day = addDays(day, 1)) {
    count += 1;
    if (count > 4000) break;
  }
  return count;
}

export function complianceLabel(
  expiresOn: string | null | undefined,
  today: string,
  windowDays: number
): string {
  const state = complianceStatus(expiresOn, today, windowDays);
  if (state === 'no_date') return 'No expiry date';
  const expiry = sastDate(expiresOn);
  const day = sastDate(today);
  if (!expiry || !day) return 'No expiry date';
  if (state === 'expired') {
    const days = daysBetween(expiry, day);
    return days === 1 ? 'Expired 1 day ago' : `Expired ${days} days ago`;
  }
  return `Expires ${formatSastDate(expiry)}`;
}

export function prdpCategoryMissing(kind: string, detail: unknown): boolean {
  if (kind !== 'prdp') return false;
  if (!detail || typeof detail !== 'object') return true;
  const category = (detail as { category?: unknown }).category;
  return typeof category !== 'string' || category.trim().length === 0;
}
