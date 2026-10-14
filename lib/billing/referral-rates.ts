/**
 * Supply-chain referral rate table — safe for marketing/client bundles.
 * No Supabase, Privy, viem, or Node server imports.
 */

export const REFERRAL_MAX_LEVELS = 3;

/** Hard cap across all levels combined */
export const REFERRAL_TOTAL_CAP_PCT = 10;

/**
 * Suggested commercial split — rewards direct invites most,
 * still pays two generations deeper (total 10%).
 */
export const REFERRAL_LEVEL_RATES_PCT: readonly [number, number, number] = [
  6, // L1 — direct invite
  3, // L2
  1, // L3
];

export const REFERRAL_LEVEL_LABELS: readonly [string, string, string] = [
  'Direct invite (L1)',
  'Second level (L2)',
  'Third level (L3)',
];

export function referralRatesSummary(): string {
  return `L1 ${REFERRAL_LEVEL_RATES_PCT[0]}% · L2 ${REFERRAL_LEVEL_RATES_PCT[1]}% · L3 ${REFERRAL_LEVEL_RATES_PCT[2]}% (max ${REFERRAL_TOTAL_CAP_PCT}% total)`;
}

export function referralSuggestedCopy(): string {
  return (
    `SupplierAdvisor pays companies that grow a trusted network. ` +
    `Invite suppliers, customers, or partners (or share your referral link). ` +
    `When they pay for the platform, you earn ${REFERRAL_LEVEL_RATES_PCT[0]}% of that subscription. ` +
    `If they invite someone who pays, you earn ${REFERRAL_LEVEL_RATES_PCT[1]}%. ` +
    `One level further pays ${REFERRAL_LEVEL_RATES_PCT[2]}%. ` +
    `Combined rewards never exceed ${REFERRAL_TOTAL_CAP_PCT}% of the paying company's subscription fee. ` +
    `Do good trade — verified partners, clean ops, on-time delivery — and the system rewards you for it.`
  );
}

function roundZar(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ReferralLevelEarnings = {
  level: 1 | 2 | 3;
  ratePct: number;
  label: string;
  /** Your fee per paying company at this level */
  perCompanyMonthly: number;
  monthlyZar: number;
  annualZar: number;
};

/**
 * Illustrative earnings if `companyCount` companies **below you in the chain**
 * each pay `monthlyZar`, and all sit at the same level relative to you.
 * (Real networks mix L1/L2/L3 — this shows magnitude at each depth.)
 */
export function referralLevelEarningsScenario(
  companyCount: number,
  monthlyZar: number,
  level: 1 | 2 | 3
): ReferralLevelEarnings {
  const n = Math.max(0, Math.floor(companyCount));
  const base = Math.max(0, Number(monthlyZar) || 0);
  const ratePct = REFERRAL_LEVEL_RATES_PCT[level - 1] ?? 0;
  const perCompanyMonthly = roundZar((base * ratePct) / 100);
  const monthly = roundZar(n * perCompanyMonthly);
  return {
    level,
    ratePct,
    label: REFERRAL_LEVEL_LABELS[level - 1],
    perCompanyMonthly,
    monthlyZar: monthly,
    annualZar: roundZar(monthly * 12),
  };
}

/** Full L1/L2/L3 magnitude for a company count (marketing scale cards). */
export function referralChainScaleScenario(
  companyCount: number,
  monthlyZar: number
): {
  count: number;
  baseMonthlyZar: number;
  levels: [ReferralLevelEarnings, ReferralLevelEarnings, ReferralLevelEarnings];
  /**
   * If you have `count` paying companies at L1 **and** at L2 **and** at L3
   * (stack all three depths) — total you could earn.
   */
  totalMonthlyZar: number;
  totalAnnualZar: number;
  /** If those companies were split equally L1/L2/L3 — rough blend */
  blendedMonthlyZar: number;
  blendedAnnualZar: number;
} {
  const levels = [
    referralLevelEarningsScenario(companyCount, monthlyZar, 1),
    referralLevelEarningsScenario(companyCount, monthlyZar, 2),
    referralLevelEarningsScenario(companyCount, monthlyZar, 3),
  ] as [ReferralLevelEarnings, ReferralLevelEarnings, ReferralLevelEarnings];
  const totalMonthly = roundZar(
    levels[0].monthlyZar + levels[1].monthlyZar + levels[2].monthlyZar
  );
  // Equal mix of levels (1/3 each) for a "balanced network" illustration
  const blendedMonthly = roundZar(totalMonthly / 3);
  return {
    count: Math.max(0, Math.floor(companyCount)),
    baseMonthlyZar: Math.max(0, Number(monthlyZar) || 0),
    levels,
    totalMonthlyZar: totalMonthly,
    totalAnnualZar: roundZar(totalMonthly * 12),
    blendedMonthlyZar: blendedMonthly,
    blendedAnnualZar: roundZar(blendedMonthly * 12),
  };
}

/** @deprecated use referralLevelEarningsScenario / referralChainScaleScenario */
export function referralDirectEarningsScenario(
  companyCount: number,
  monthlyZar: number
): { count: number; monthlyZar: number; annualZar: number; perCompanyMonthly: number } {
  const n = Math.max(0, Math.floor(companyCount));
  const l1 = referralLevelEarningsScenario(n, monthlyZar, 1);
  return {
    count: n,
    monthlyZar: l1.monthlyZar,
    annualZar: l1.annualZar,
    perCompanyMonthly: l1.perCompanyMonthly,
  };
}

/** Default scale scenarios: 10 / 50 / 200 companies down the chain. */
export const REFERRAL_SCALE_SCENARIO_COUNTS = [10, 50, 200] as const;
