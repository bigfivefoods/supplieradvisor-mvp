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
