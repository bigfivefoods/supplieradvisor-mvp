/**
 * Incentives for schools & SPs to only buy/deliver DBE/DoH approved products.
 *
 * Schools: headmaster prize pillars + claim eligibility / amount.
 * SPs: preferred-supplier score (drives school ranking & agency probation).
 */

/** Minimum approved-brand % for full claim submission */
export const CLAIM_APPROVED_MIN_PCT = 98;

/** Below this, SP is on probation (schools should deprioritise) */
export const ISP_PROBATION_PCT = 80;

/** Preferred supplier threshold — agency/school incentive to use these first */
export const ISP_PREFERRED_PCT = 95;

export type IspIncentive = {
  /** 0–100 composite: approved deliveries + volume reliability */
  score: number;
  compliance_pct: number;
  status: 'preferred' | 'excellent' | 'ok' | 'watch' | 'probation';
  /** Short human copy for dashboards */
  badge: string;
  incentive_note: string;
};

export function computeIspIncentive(opts: {
  deliveries: number;
  approved_ok: number;
  wrong_brand: number;
}): IspIncentive {
  const deliveries = Math.max(0, opts.deliveries);
  const approved = Math.max(0, opts.approved_ok);
  const compliance_pct =
    deliveries > 0
      ? Math.round((approved / deliveries) * 1000) / 10
      : 100;

  // Score heavily weights approved-product deliveries (incentive to stay on catalogue)
  const score = Math.round(compliance_pct * 10) / 10;

  let status: IspIncentive['status'];
  if (compliance_pct >= ISP_PREFERRED_PCT && deliveries >= 3) {
    status = 'preferred';
  } else if (compliance_pct >= ISP_PREFERRED_PCT) {
    status = 'excellent';
  } else if (compliance_pct >= 80) {
    status = 'ok';
  } else if (compliance_pct >= 60) {
    status = 'watch';
  } else {
    status = 'probation';
  }

  const badges: Record<IspIncentive['status'], string> = {
    preferred: 'Preferred supplier · 95%+ approved',
    excellent: 'Excellent · on-catalogue',
    ok: 'Compliant',
    watch: 'Watch · wrong brands',
    probation: 'Probation · off-catalogue risk',
  };

  return {
    score,
    compliance_pct,
    status,
    badge: badges[status],
    incentive_note:
      status === 'preferred' || status === 'excellent'
        ? 'Schools earn prize points and full claims when ordering from you — stay on the DBE/DoH list.'
        : status === 'probation'
          ? 'Deliver only agency-approved products or risk suspension and lost school orders.'
          : 'Improve on-catalogue deliveries to become a preferred supplier.',
  };
}

/**
 * Claim funding incentive: full amount only when approved-brand adherence is high.
 * Scales claim amount by approved % below the threshold (soft clawback).
 */
export function applyApprovedProductClaimIncentive(opts: {
  claimAmount: number;
  approvedBrandPct: number;
}): {
  eligible_full: boolean;
  claim_amount: number;
  claim_amount_full: number;
  approved_brand_pct: number;
  clawback_pct: number;
  block_reason: string | null;
  incentive_note: string;
} {
  const full = Math.max(0, opts.claimAmount);
  const pct = Math.max(0, Math.min(100, opts.approvedBrandPct));
  const eligible_full = pct >= CLAIM_APPROVED_MIN_PCT;

  if (eligible_full) {
    return {
      eligible_full: true,
      claim_amount: Math.round(full * 100) / 100,
      claim_amount_full: Math.round(full * 100) / 100,
      approved_brand_pct: pct,
      clawback_pct: 0,
      block_reason: null,
      incentive_note:
        'Full claim — GRNs are on the DBE/DoH approved foods list. Keeps headmaster prize score high.',
    };
  }

  // Soft clawback: claim scales with approved % (incentive not to buy off-list)
  const scaled = Math.round(full * (pct / 100) * 100) / 100;
  const clawback = Math.round((100 - pct) * 10) / 10;

  return {
    eligible_full: false,
    claim_amount: scaled,
    claim_amount_full: Math.round(full * 100) / 100,
    approved_brand_pct: pct,
    clawback_pct: clawback,
    block_reason:
      pct < 80
        ? `Approved foods only ${pct}% — claim blocked until kitchen receipts use the department list (min ${CLAIM_APPROVED_MIN_PCT}%)`
        : null,
    incentive_note: `Only ${pct}% of receipts are on the approved list. Claim reduced by ~${clawback}% — order only DBE/DoH approved products to unlock full funding and prizes.`,
  };
}

export const SCHOOL_APPROVED_INCENTIVE_COPY =
  'Schools that order and receive only DBE/DoH approved foods earn higher headmaster prize scores (55% of points) and full claim funding.';

export const ISP_APPROVED_INCENTIVE_COPY =
  'SPs that deliver only approved products become preferred suppliers, keep school orders, and avoid probation or association suspension.';
