/**
 * Incentives for schools & SPs to only buy/deliver DBE/PEU approved products.
 *
 * Schools: headmaster prize pillars + claim eligibility / amount.
 * SPs: preferred-supplier score (0–100) with full-compliance bonus.
 */
import { SP_PRIZE_CRITERIA } from '@/lib/schools/prize-criteria';

/** Minimum approved-brand % for full claim submission */
export const CLAIM_APPROVED_MIN_PCT = 98;

/** Below this, SP is on probation (schools should deprioritise) */
export const ISP_PROBATION_PCT = 80;

/** Preferred supplier threshold — agency/school incentive to use these first */
export const ISP_PREFERRED_PCT = 95;

export type IspIncentive = {
  /** 0–100 composite prize score */
  score: number;
  compliance_pct: number;
  status: 'preferred' | 'excellent' | 'ok' | 'watch' | 'probation';
  badge: string;
  incentive_note: string;
  /** Pillar breakdown (for prize criteria UI) */
  pillars?: {
    onCatalogue: number;
    fullCompliance: number;
    podPhotos: number;
    otif: number;
  };
  full_compliance_deliveries?: number;
  deliveries_with_pod?: number;
  total_deliveries?: number;
};

export function computeIspIncentive(opts: {
  deliveries: number;
  approved_ok: number;
  wrong_brand: number;
  /** Deliveries where every line was on-catalogue */
  full_compliance_deliveries?: number;
  /** Deliveries with POD photo/file */
  deliveries_with_pod?: number;
  /** On-time deliveries (when expected_date known) */
  otif_ok?: number;
  otif_known?: number;
}): IspIncentive {
  const deliveries = Math.max(0, opts.deliveries);
  const approved = Math.max(0, opts.approved_ok);
  const compliance_pct =
    deliveries > 0
      ? Math.round((approved / deliveries) * 1000) / 10
      : 100;

  const fullClean = Math.max(0, opts.full_compliance_deliveries ?? approved);
  const fullCleanPct =
    deliveries > 0
      ? Math.round((Math.min(fullClean, deliveries) / deliveries) * 1000) / 10
      : 100;

  const podN = Math.max(0, opts.deliveries_with_pod ?? 0);
  const podPct =
    deliveries > 0
      ? Math.round((Math.min(podN, deliveries) / deliveries) * 1000) / 10
      : 0;

  const otifKnown = Math.max(0, opts.otif_known ?? 0);
  const otifOk = Math.max(0, opts.otif_ok ?? 0);
  const otifPct =
    otifKnown > 0
      ? Math.round((otifOk / otifKnown) * 1000) / 10
      : deliveries > 0
        ? 80 // neutral when not tracked
        : 100;

  // Weights from SP_PRIZE_CRITERIA
  const wOn = SP_PRIZE_CRITERIA.find((c) => c.id === 'onCatalogue')!.weight;
  const wFull = SP_PRIZE_CRITERIA.find((c) => c.id === 'fullCompliance')!.weight;
  const wPod = SP_PRIZE_CRITERIA.find((c) => c.id === 'podPhotos')!.weight;
  const wOtif = SP_PRIZE_CRITERIA.find((c) => c.id === 'otif')!.weight;

  const onCatalogue = (compliance_pct / 100) * wOn;
  // Full-compliance pillar: reward clean DNs heavily (extra points vs mixed)
  const fullCompliance = (fullCleanPct / 100) * wFull;
  const podPhotos = (podPct / 100) * wPod;
  const otif = (otifPct / 100) * wOtif;

  const score =
    Math.round((onCatalogue + fullCompliance + podPhotos + otif) * 10) / 10;

  let status: IspIncentive['status'];
  if (compliance_pct >= ISP_PREFERRED_PCT && deliveries >= 3 && fullCleanPct >= 90) {
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
    preferred: 'Preferred supplier · 95%+ approved · clean DNs',
    excellent: 'Excellent · on-catalogue',
    ok: 'Compliant',
    watch: 'Watch · mixed / off-list lines',
    probation: 'Probation · off-catalogue risk',
  };

  return {
    score,
    compliance_pct,
    status,
    badge: badges[status],
    incentive_note:
      status === 'preferred' || status === 'excellent'
        ? 'Schools earn prize points and full claims when ordering from you — full-compliance DNs earn max SP points.'
        : status === 'probation'
          ? 'You may list other items on the DN, but off-catalogue volume hurts preferred status and school orders.'
          : 'Raise on-catalogue % and attach photo POD on every drop to climb the SP prize score.',
    pillars: {
      onCatalogue: Math.round(onCatalogue * 10) / 10,
      fullCompliance: Math.round(fullCompliance * 10) / 10,
      podPhotos: Math.round(podPhotos * 10) / 10,
      otif: Math.round(otif * 10) / 10,
    },
    full_compliance_deliveries: fullClean,
    deliveries_with_pod: podN,
    total_deliveries: deliveries,
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
        'Full claim — GRNs are on the DBE/PEU approved foods list. Keeps headmaster prize score high.',
    };
  }

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
    incentive_note: `Only ${pct}% of receipts are on the approved list. Claim reduced by ~${clawback}% — order only DBE/PEU approved products to unlock full funding and prizes.`,
  };
}

export const SCHOOL_APPROVED_INCENTIVE_COPY =
  'Schools that order and receive only DBE/PEU approved foods earn higher headmaster prize scores (55% of points) and full claim funding.';

export const ISP_APPROVED_INCENTIVE_COPY =
  'SPs may add other items on a delivery note, but preferred status and max prize points require full compliance to the DBE approved list, photo POD, and on-time delivery.';

/** Classify delivery lines for compliance scoring */
export function scoreDeliveryLines(
  lines: Array<{
    approved?: boolean | null;
    approved_product_id?: number | null;
    qty_delivered?: number;
    qty_received?: number;
    qty_ordered?: number;
    qty?: number;
  }>
): {
  total_qty: number;
  approved_qty: number;
  compliance_pct: number;
  full_compliance: boolean;
  line_count: number;
  approved_line_count: number;
} {
  let total_qty = 0;
  let approved_qty = 0;
  let line_count = 0;
  let approved_line_count = 0;
  for (const l of lines) {
    const qty = Number(
      l.qty_received ?? l.qty_delivered ?? l.qty_ordered ?? l.qty ?? 0
    );
    if (!(qty > 0)) continue;
    line_count += 1;
    total_qty += qty;
    const ok =
      l.approved === true ||
      (l.approved !== false &&
        l.approved_product_id != null &&
        Number(l.approved_product_id) > 0);
    if (ok) {
      approved_qty += qty;
      approved_line_count += 1;
    }
  }
  const compliance_pct =
    total_qty > 0
      ? Math.round((approved_qty / total_qty) * 1000) / 10
      : 100;
  return {
    total_qty,
    approved_qty,
    compliance_pct,
    full_compliance: line_count > 0 && approved_line_count === line_count,
    line_count,
    approved_line_count,
  };
}
