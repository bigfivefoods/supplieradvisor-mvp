/**
 * Independent sales contractor commission engine.
 *
 * Stepped scale (whole deal at one rate) — work backwards from a super-link load:
 *   Super-link (full load) and above  → 6%
 *   Half-link to under full link      → 5%
 *   Below half a super-link           → 4%
 *
 * One super-link ≈ 32 000 units of finished goods (≈ 32 t payload class).
 * Illustrative unit price R45 → deal value R1 440 000 (≈ R1.5m).
 */

export type CommissionTier = {
  /** Inclusive upper bound of band (null = infinity) — used for display / stepped caps */
  upTo: number | null;
  /** Percent e.g. 5 for 5% */
  ratePct: number;
  label?: string;
};

/**
 * Super-link payload class (~32 t combination).
 * Commission uses unit count × finished-goods unit price, not R/tonne.
 */
export const SUPER_LINK_TONNES = 32;
/** Approximate finished-goods units that fill one super-link. */
export const SUPER_LINK_UNITS = 32_000;
/** Illustrative finished-goods unit price (ZAR) for band thresholds and examples. */
export const SUPER_LINK_UNIT_PRICE_ZAR = 45;

/** @deprecated Use SUPER_LINK_UNIT_PRICE_ZAR — kept as alias for older imports */
export const SUPER_LINK_EXAMPLE_ZAR_PER_TONNE = SUPER_LINK_UNIT_PRICE_ZAR;

/** Deal value of one full super-link load (illustrative). R45 × 32 000 = R1 440 000. */
export function superLinkDealValue(): number {
  return SUPER_LINK_UNITS * SUPER_LINK_UNIT_PRICE_ZAR;
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
    label: 'Super-link (~32 000 units) & above',
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

export type NormalizeTiersOpts = {
  /** Default min rate clamp (inclusive). */
  minPct?: number;
  /** Default max rate clamp (inclusive). */
  maxPct?: number;
  /** If true and tiers empty, return DEFAULT_COMMISSION_TIERS. Default true. */
  fallbackDefault?: boolean;
};

/**
 * Normalize commission tiers without forcing platform 4/5/6%.
 * Company programs may define any rates within min/max.
 */
export function normalizeCommissionTiers(
  tiers?: CommissionTier[] | null,
  opts?: NormalizeTiersOpts
): CommissionTier[] {
  const minPct = opts?.minPct ?? 0;
  const maxPct = opts?.maxPct ?? 100;
  const fallbackDefault = opts?.fallbackDefault !== false;
  if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
    return fallbackDefault ? DEFAULT_COMMISSION_TIERS : [];
  }
  return tiers
    .map((t) => {
      const raw = Number(t.ratePct);
      const ratePct = Number.isFinite(raw)
        ? Math.min(maxPct, Math.max(minPct, raw))
        : minPct;
      return {
        upTo: t.upTo == null || t.upTo === ('' as unknown) ? null : Number(t.upTo),
        ratePct,
        label: t.label ? String(t.label) : undefined,
      };
    })
    .filter((t) => t.upTo == null || Number.isFinite(t.upTo))
    .sort((a, b) => {
      if (a.upTo == null) return 1;
      if (b.upTo == null) return -1;
      return a.upTo - b.upTo;
    });
}

/** @deprecated Prefer normalizeCommissionTiers — kept for older call sites. */
function normalizeTiers(tiers?: CommissionTier[] | null): CommissionTier[] {
  return normalizeCommissionTiers(tiers);
}

/**
 * Stepped commission: whole deal at one rate based on which band the deal falls into.
 * Works with any company-defined tier list (thresholds ascending, last open-ended).
 */
export function calculateCommission(
  dealAmount: number,
  opts?: { tiers?: CommissionTier[] | null; currency?: string }
): CommissionResult {
  const amount = Math.max(0, Number(dealAmount) || 0);
  const tiers = normalizeCommissionTiers(opts?.tiers);
  const currency = opts?.currency || 'ZAR';

  // Ascending thresholds: band i is [prevUp, upTo) ; last open band is [prevUp, ∞)
  let chosen = tiers[tiers.length - 1];
  let bandFrom = 0;
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    const lower = i === 0 ? 0 : Number(tiers[i - 1].upTo ?? 0);
    const upper = t.upTo == null ? Infinity : Number(t.upTo);
    if (amount >= lower && amount < upper) {
      chosen = t;
      bandFrom = lower;
      break;
    }
    if (i === tiers.length - 1) {
      chosen = t;
      bandFrom = lower;
    }
  }

  const ratePct = Number(chosen?.ratePct) || 0;
  const bandTo = chosen?.upTo == null ? null : Number(chosen.upTo);
  const label = chosen?.label;
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
  const t = normalizeCommissionTiers(tiers);
  return t
    .map((tier, i) => {
      const from = i === 0 ? 0 : (t[i - 1].upTo ?? 0);
      const to =
        tier.upTo == null
          ? 'and above'
          : `up to ${formatZar(tier.upTo)}`;
      return `${formatZar(from)} ${to}: ${tier.ratePct}% on whole deal`;
    })
    .join(' · ');
}

export function parseStoredTiers(
  raw: unknown,
  opts?: NormalizeTiersOpts
): CommissionTier[] {
  if (!raw) return DEFAULT_COMMISSION_TIERS;
  if (typeof raw === 'string') {
    try {
      return normalizeCommissionTiers(JSON.parse(raw), opts);
    } catch {
      return DEFAULT_COMMISSION_TIERS;
    }
  }
  if (Array.isArray(raw)) {
    return normalizeCommissionTiers(raw as CommissionTier[], opts);
  }
  return DEFAULT_COMMISSION_TIERS;
}

/**
 * Preserve company/custom tiers. Only upgrade clearly broken or empty data
 * to platform defaults. Does NOT force 4/5/6%.
 */
export function ensureAscendingCommissionTiers(
  tiers?: CommissionTier[] | null
): CommissionTier[] {
  if (!tiers || !Array.isArray(tiers) || tiers.length < 1) {
    return DEFAULT_COMMISSION_TIERS;
  }
  const normalized = normalizeCommissionTiers(tiers);
  if (!normalized.length) return DEFAULT_COMMISSION_TIERS;

  // Detect old progressive rates that were never company-configured
  const rawRates = tiers.map((x) => Number(x.ratePct) || 0);
  const caps = tiers.map((t) => (t.upTo == null ? null : Number(t.upTo)));
  const hasLegacyCaps = caps.some(
    (c) => c != null && (c === 160_000 || c === 80_000 || c === 50_000)
  );
  const hasLegacyRates = rawRates.some(
    (r) => r === 3.5 || r === 5.5 || r === 4.5
  );
  if (hasLegacyCaps && hasLegacyRates) {
    return DEFAULT_COMMISSION_TIERS;
  }

  // Ensure last tier is open-ended
  if (normalized[normalized.length - 1].upTo != null) {
    const copy = [...normalized];
    copy[copy.length - 1] = { ...copy[copy.length - 1], upTo: null };
    return copy;
  }
  return normalized;
}
