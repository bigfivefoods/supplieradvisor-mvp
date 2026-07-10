/**
 * Independent sales contractor commission engine.
 *
 * Progressive sliding scale — larger deals earn higher rates (max 5%):
 *   R0 – R50,000          → 1.0%
 *   R50,001 – R150,000    → 2.0%
 *   R150,001 – R400,000   → 3.0%
 *   R400,001 – R1,000,000 → 4.0%
 *   above R1,000,000      → 5.0% (cap)
 *
 * Commission is calculated progressively across bands.
 */

export type CommissionTier = {
  /** Inclusive upper bound of band (null = infinity) */
  upTo: number | null;
  /** Percent e.g. 5 for 5% */
  ratePct: number;
  label?: string;
};

/** Bigger deals → higher commission % (capped at 5%). */
export const DEFAULT_COMMISSION_TIERS: CommissionTier[] = [
  { upTo: 50_000, ratePct: 1, label: 'Starter' },
  { upTo: 150_000, ratePct: 2, label: 'Growth' },
  { upTo: 400_000, ratePct: 3, label: 'Core' },
  { upTo: 1_000_000, ratePct: 4, label: 'Enterprise' },
  { upTo: null, ratePct: 5, label: 'Strategic (max)' },
];

export const MAX_COMMISSION_PCT = 5;
export const MIN_COMMISSION_PCT = 1;

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
};

function normalizeTiers(tiers?: CommissionTier[] | null): CommissionTier[] {
  if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
    return DEFAULT_COMMISSION_TIERS;
  }
  return tiers
    .map((t) => ({
      upTo: t.upTo == null ? null : Number(t.upTo),
      ratePct: Math.min(MAX_COMMISSION_PCT, Math.max(MIN_COMMISSION_PCT, Number(t.ratePct) || 0)),
      label: t.label,
    }))
    .sort((a, b) => {
      if (a.upTo == null) return 1;
      if (b.upTo == null) return -1;
      return a.upTo - b.upTo;
    });
}

/**
 * Progressive commission for a deal amount using sliding bands.
 */
export function calculateCommission(
  dealAmount: number,
  opts?: { tiers?: CommissionTier[] | null; currency?: string }
): CommissionResult {
  const amount = Math.max(0, Number(dealAmount) || 0);
  const tiers = normalizeTiers(opts?.tiers);
  const currency = opts?.currency || 'ZAR';
  const lines: CommissionBreakdownLine[] = [];
  let remaining = amount;
  let prevCap = 0;
  let totalCommission = 0;

  for (const tier of tiers) {
    if (remaining <= 0) break;
    const cap = tier.upTo == null ? Infinity : tier.upTo;
    const bandWidth = cap === Infinity ? remaining : Math.max(0, cap - prevCap);
    const amountInBand = Math.min(remaining, bandWidth);
    if (amountInBand <= 0) {
      prevCap = cap === Infinity ? prevCap : cap;
      continue;
    }
    const commission = (amountInBand * tier.ratePct) / 100;
    lines.push({
      bandFrom: prevCap,
      bandTo: tier.upTo,
      amountInBand,
      ratePct: tier.ratePct,
      commission,
      label: tier.label,
    });
    totalCommission += commission;
    remaining -= amountInBand;
    prevCap = cap === Infinity ? prevCap + amountInBand : cap;
  }

  const effectiveRatePct = amount > 0 ? (totalCommission / amount) * 100 : 0;

  return {
    dealAmount: amount,
    commissionAmount: roundMoney(totalCommission),
    effectiveRatePct: Math.round(effectiveRatePct * 1000) / 1000,
    currency,
    lines: lines.map((l) => ({ ...l, commission: roundMoney(l.commission) })),
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
      const from = i === 0 ? 0 : (t[i - 1].upTo ?? 0) + 1;
      const to = tier.upTo == null ? 'and above' : `up to ${formatZar(tier.upTo)}`;
      return `${formatZar(from)} ${to}: ${tier.ratePct}%`;
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
 * Detect inverted (old) scale where small deals had higher % than large —
 * and replace with current DEFAULT so bigger deals earn more.
 */
export function ensureAscendingCommissionTiers(
  tiers?: CommissionTier[] | null
): CommissionTier[] {
  const t = normalizeTiers(tiers);
  if (t.length < 2) return DEFAULT_COMMISSION_TIERS;
  const first = t[0].ratePct;
  const last = t[t.length - 1].ratePct;
  // Old model: first band 5%, last band 1%
  if (first > last) return DEFAULT_COMMISSION_TIERS;
  return t;
}
