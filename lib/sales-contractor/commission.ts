/**
 * Independent sales contractor commission engine.
 *
 * Stepped scale (whole deal at one rate) — work backwards from a super-link load:
 *   Super-link (32 t) and above  → 6%
 *   Half-link to under full link → 5%
 *   Below half a super-link      → 4%
 *
 * One super-link payload = 32 tonnes. Illustrative value for thresholds uses
 * SUPER_LINK_EXAMPLE_ZAR_PER_TONNE (not a live price list).
 */

export type CommissionTier = {
  /** Inclusive upper bound of band (null = infinity) — used for display / stepped caps */
  upTo: number | null;
  /** Percent e.g. 5 for 5% */
  ratePct: number;
  label?: string;
};

/** Super-link payload for commission bands (one “link”). */
export const SUPER_LINK_TONNES = 32;
/** Illustrative ZAR per tonne for band thresholds and worked examples only. */
export const SUPER_LINK_EXAMPLE_ZAR_PER_TONNE = 5_000;

/** Deal value of one full super-link load (illustrative). */
export function superLinkDealValue(): number {
  return SUPER_LINK_TONNES * SUPER_LINK_EXAMPLE_ZAR_PER_TONNE;
}

/** Half a super-link (illustrative) — 5% band starts here. */
export function halfSuperLinkDealValue(): number {
  return superLinkDealValue() / 2;
}

export const MAX_COMMISSION_PCT = 6;
export const MIN_COMMISSION_PCT = 4;

/**
 * Display / storage tiers — thresholds anchored to super-link value.
 * Rate applies to the **whole deal** (stepped). Full super-link load → 6%.
 */
export const DEFAULT_COMMISSION_TIERS: CommissionTier[] = [
  {
    upTo: halfSuperLinkDealValue(),
    ratePct: 4,
    label: 'Starter (below ½ super-link)',
  },
  {
    upTo: superLinkDealValue(),
    ratePct: 5,
    label: 'Growth (½ to under 1 super-link)',
  },
  {
    upTo: null,
    ratePct: 6,
    label: 'Super-link (32 t) & above',
  },
];

export type CommissionBreakdownLine = {
  bandFrom: number;
  bandTo: number | null;
  amountInBand: number;
  ratePct: number;
  commission: number;
  label?: string;
};

export type CommissionResult = {
  dealAmount: number;
  commissionAmount: number;
  effectiveRatePct: number;
  currency: string;
  lines: CommissionBreakdownLine[];
  tiers: CommissionTier[];
  /** Stepped rate applied to the whole deal */
  appliedRatePct: number;
};

function normalizeTiers(tiers?: CommissionTier[] | null): CommissionTier[] {
  if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
    return DEFAULT_COMMISSION_TIERS;
  }
  return tiers
    .map((t) => ({
      upTo: t.upTo == null ? null : Number(t.upTo),
      ratePct: Math.min(
        MAX_COMMISSION_PCT,
        Math.max(MIN_COMMISSION_PCT, Number(t.ratePct) || MIN_COMMISSION_PCT)
      ),
      label: t.label,
    }))
    .sort((a, b) => {
      if (a.upTo == null) return 1;
      if (b.upTo == null) return -1;
      return a.upTo - b.upTo;
    });
}

/**
 * Stepped commission: whole deal at one rate.
 * Worked backwards from a full super-link (32 t) at 6%:
 *   ≥ 1 super-link value → 6%
 *   ≥ ½ super-link and < 1 → 5%
 *   < ½ super-link → 4%
 */
export function calculateCommission(
  dealAmount: number,
  opts?: { tiers?: CommissionTier[] | null; currency?: string }
): CommissionResult {
  const amount = Math.max(0, Number(dealAmount) || 0);
  const tiers = normalizeTiers(opts?.tiers);
  const currency = opts?.currency || 'ZAR';

  // Anchors: prefer tier upTo values when default 3-tier shape, else super-link constants
  const half =
    tiers.length >= 2 && tiers[0].upTo != null
      ? Number(tiers[0].upTo)
      : halfSuperLinkDealValue();
  const full =
    tiers.length >= 2 && tiers[1].upTo != null
      ? Number(tiers[1].upTo)
      : superLinkDealValue();

  const rate4 = tiers[0]?.ratePct ?? MIN_COMMISSION_PCT;
  const rate5 = tiers[1]?.ratePct ?? 5;
  const rate6 =
    tiers.find((t) => t.upTo == null)?.ratePct ??
    tiers[tiers.length - 1]?.ratePct ??
    MAX_COMMISSION_PCT;

  let ratePct: number;
  let bandFrom = 0;
  let bandTo: number | null = null;
  let label: string | undefined;

  // Full super-link and above → top rate (6%)
  if (amount >= full) {
    ratePct = rate6;
    bandFrom = full;
    bandTo = null;
    label = tiers.find((t) => t.upTo == null)?.label || 'Super-link (32 t) & above';
  } else if (amount >= half) {
    ratePct = rate5;
    bandFrom = half;
    bandTo = full;
    label = tiers[1]?.label || 'Growth (½ to under 1 super-link)';
  } else {
    ratePct = rate4;
    bandFrom = 0;
    bandTo = half;
    label = tiers[0]?.label || 'Starter (below ½ super-link)';
  }

  const commission = (amount * ratePct) / 100;

  const lines: CommissionBreakdownLine[] = [
    {
      bandFrom,
      bandTo,
      amountInBand: amount,
      ratePct,
      commission: roundMoney(commission),
      label,
    },
  ];

  return {
    dealAmount: amount,
    commissionAmount: roundMoney(commission),
    effectiveRatePct: ratePct,
    appliedRatePct: ratePct,
    currency,
    lines,
    tiers,
  };
}

export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function formatZar(n: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

export function formatZarPrecise(n: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);
}

/** Human-readable tier table for agreements / UI */
export function tiersSummaryText(tiers?: CommissionTier[] | null): string {
  const t = normalizeTiers(tiers);
  return t
    .map((tier, i) => {
      const from = i === 0 ? 0 : (t[i - 1].upTo ?? 0);
      const to =
        tier.upTo == null ? 'and above (super-link 32 t+)' : `up to ${formatZar(tier.upTo)}`;
      return `${formatZar(from)} ${to}: ${tier.ratePct}% on whole deal`;
    })
    .join(' · ');
}

export function parseStoredTiers(raw: unknown): CommissionTier[] {
  if (!raw) return DEFAULT_COMMISSION_TIERS;
  if (typeof raw === 'string') {
    try {
      return normalizeTiers(JSON.parse(raw));
    } catch {
      return DEFAULT_COMMISSION_TIERS;
    }
  }
  if (Array.isArray(raw)) return normalizeTiers(raw as CommissionTier[]);
  return DEFAULT_COMMISSION_TIERS;
}

/**
 * Upgrade legacy scales (old 3.5–5.5 progressive, inverted, etc.) to current DEFAULT.
 */
export function ensureAscendingCommissionTiers(
  tiers?: CommissionTier[] | null
): CommissionTier[] {
  if (!tiers || !Array.isArray(tiers) || tiers.length < 2) {
    return DEFAULT_COMMISSION_TIERS;
  }
  const rawRates = tiers.map((x) => Number(x.ratePct) || 0);
  const firstRaw = rawRates[0];
  const lastRaw = rawRates[rawRates.length - 1];
  const hasLegacy =
    rawRates.some((r) => r === 3.5 || r === 5.5 || r === 4.5) ||
    firstRaw < MIN_COMMISSION_PCT - 0.01 ||
    lastRaw < MAX_COMMISSION_PCT - 0.01 ||
    firstRaw > lastRaw;
  if (hasLegacy || tiers.length !== 3) {
    return DEFAULT_COMMISSION_TIERS;
  }
  // Accept only 4 / 5 / 6 structure
  if (
    Math.abs(firstRaw - 4) > 0.01 ||
    Math.abs(lastRaw - 6) > 0.01
  ) {
    return DEFAULT_COMMISSION_TIERS;
  }
  return normalizeTiers(tiers);
}
