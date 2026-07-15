import {
  DEFAULT_COMMISSION_TIERS,
  ensureAscendingCommissionTiers,
  type CommissionTier,
} from '@/lib/sales-contractor/commission';
import type { SalesProgramSettings } from './types';

/**
 * Resolve commission tiers for display / calc in the sales portal.
 *
 * - Actually signed contractors: freeze agreement snapshot (historical).
 * - Everyone else (pending, managers, owners): live company sales program.
 * - Fallback: platform 4% · 5% · 6%.
 *
 * Never use `subscriptionExempt` / portal "signed for access" as a freeze signal.
 */
export function liveCommissionTiers(
  program: SalesProgramSettings | null | undefined,
  agreement?: {
    status?: string | null;
    commission_tiers?: CommissionTier[] | null;
  } | null
): CommissionTier[] {
  const actuallySigned = String(agreement?.status || '').toLowerCase() === 'signed';
  if (actuallySigned && agreement?.commission_tiers?.length) {
    return ensureAscendingCommissionTiers(agreement.commission_tiers);
  }
  if (program?.commission_tiers?.length) {
    return ensureAscendingCommissionTiers(program.commission_tiers);
  }
  if (agreement?.commission_tiers?.length) {
    return ensureAscendingCommissionTiers(agreement.commission_tiers);
  }
  return DEFAULT_COMMISSION_TIERS.map((t) => ({ ...t }));
}

export function ratesLabelFromTiers(tiers: CommissionTier[]): string {
  return tiers.map((t) => `${t.ratePct}%`).join(' · ');
}

/** True when two tier schedules differ enough that a pending row should re-sync. */
export function tiersSchedulesDiffer(
  a: CommissionTier[] | null | undefined,
  b: CommissionTier[] | null | undefined
): boolean {
  const left = ensureAscendingCommissionTiers(a || []);
  const right = ensureAscendingCommissionTiers(b || []);
  if (left.length !== right.length) return true;
  for (let i = 0; i < left.length; i++) {
    if (Math.abs(Number(left[i].ratePct) - Number(right[i].ratePct)) > 0.001) {
      return true;
    }
    const lu = left[i].upTo == null ? null : Number(left[i].upTo);
    const ru = right[i].upTo == null ? null : Number(right[i].upTo);
    if (lu == null && ru == null) continue;
    if (lu == null || ru == null) return true;
    if (Math.abs(lu - ru) > 0.5) return true;
  }
  return false;
}
