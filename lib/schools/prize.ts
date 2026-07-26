/**
 * Headmaster prize scorecard — incentivise approved-brand procurement.
 */
import { PRIZE_WEIGHTS } from '@/lib/schools/types';

export type PrizeInputs = {
  /** % of kitchen spend / receipts on approved brands (0–100) */
  approvedBrandPct: number;
  /** Count of non-approved receive attempts in period */
  nonApprovedEvents: number;
  /** Menu adherence 0–100 (default 100 if not tracked) */
  menuAdherencePct: number;
  /** Feeding days with log / school days * 100 */
  feedingCompletenessPct: number;
  /** Stock discipline proxy 0–100 */
  stockDisciplinePct: number;
  /** Data quality: verified learners % etc. */
  dataQualityPct: number;
};

export type PrizeBreakdown = {
  approvedBrand: number;
  zeroNonapproved: number;
  menuAdherence: number;
  feedingCompleteness: number;
  stockDiscipline: number;
  dataQuality: number;
  total: number;
  inputs: PrizeInputs;
};

function clamp(n: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(lo, Math.min(hi, n));
}

export function computePrizeScore(input: PrizeInputs): PrizeBreakdown {
  const approvedBrandPct = clamp(input.approvedBrandPct);
  const menuAdherencePct = clamp(input.menuAdherencePct);
  const feedingCompletenessPct = clamp(input.feedingCompletenessPct);
  const stockDisciplinePct = clamp(input.stockDisciplinePct);
  const dataQualityPct = clamp(input.dataQualityPct);

  // Full pillar if zero non-approved events; else step down
  let zeroNonapprovedScore = 100;
  if (input.nonApprovedEvents > 0) {
    zeroNonapprovedScore = clamp(100 - input.nonApprovedEvents * 25);
  }

  const approvedBrand =
    (approvedBrandPct / 100) * PRIZE_WEIGHTS.approvedBrand;
  const zeroNonapproved =
    (zeroNonapprovedScore / 100) * PRIZE_WEIGHTS.zeroNonapproved;
  const menuAdherence =
    (menuAdherencePct / 100) * PRIZE_WEIGHTS.menuAdherence;
  const feedingCompleteness =
    (feedingCompletenessPct / 100) * PRIZE_WEIGHTS.feedingCompleteness;
  const stockDiscipline =
    (stockDisciplinePct / 100) * PRIZE_WEIGHTS.stockDiscipline;
  const dataQuality = (dataQualityPct / 100) * PRIZE_WEIGHTS.dataQuality;

  const total =
    Math.round(
      (approvedBrand +
        zeroNonapproved +
        menuAdherence +
        feedingCompleteness +
        stockDiscipline +
        dataQuality) *
        10
    ) / 10;

  return {
    approvedBrand: Math.round(approvedBrand * 10) / 10,
    zeroNonapproved: Math.round(zeroNonapproved * 10) / 10,
    menuAdherence: Math.round(menuAdherence * 10) / 10,
    feedingCompleteness: Math.round(feedingCompleteness * 10) / 10,
    stockDiscipline: Math.round(stockDiscipline * 10) / 10,
    dataQuality: Math.round(dataQuality * 10) / 10,
    total,
    inputs: {
      approvedBrandPct,
      nonApprovedEvents: input.nonApprovedEvents,
      menuAdherencePct,
      feedingCompletenessPct,
      stockDisciplinePct,
      dataQualityPct,
    },
  };
}

export function currentQuarterPeriod(d = new Date()): {
  year: number;
  quarter: number;
  starts_on: string;
  ends_on: string;
  name: string;
} {
  const year = d.getFullYear();
  const quarter = Math.floor(d.getMonth() / 3) + 1;
  const startMonth = (quarter - 1) * 3;
  const starts = new Date(year, startMonth, 1);
  const ends = new Date(year, startMonth + 3, 0);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return {
    year,
    quarter,
    starts_on: iso(starts),
    ends_on: iso(ends),
    name: `Q${quarter} ${year} Headmaster Prize`,
  };
}
