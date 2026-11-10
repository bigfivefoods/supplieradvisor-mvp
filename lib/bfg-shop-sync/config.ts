/**
 * bigfivegroup.africa shop sync: configuration (contract v1.0, section 1).
 *
 * The endpoint is OFF unless BFG_SYNC_ENABLED is exactly "true".
 * Values are read from the environment only. They are never logged.
 */

export const CONTRACT_VERSION = '1.0';
export const ALLOWED_PROFILE_ID = 102;
export const SYNC_ACTOR = 'bfg_shop_sync';
export const SHOP_ORIGIN = 'bfg_shop';
export const SHOP_ORDER_ORIGIN = 'bigfivegroup_web';
export const SHOP_CUSTOMER_SOURCE = 'bigfivegroup_web';
export const SHOP_REFERENCE_PREFIX = 'bfg-shop-';
export const DUNNING_PAUSED_MARKER = '[dunning paused]';
export const MAX_BODY_BYTES = 256 * 1024;
export const TIMESTAMP_WINDOW_SECONDS = 300;

export type SyncConfig =
  | { state: 'disabled' }
  | { state: 'misconfigured' }
  | {
      state: 'ok';
      secret: string;
      profileId: number;
      callbackUrl: string | null;
      bankAccountId: number | null;
    };

type Env = Record<string, string | undefined>;

export function isSyncEnabled(env: Env = process.env): boolean {
  return String(env.BFG_SYNC_ENABLED || '').trim().toLowerCase() === 'true';
}

/**
 * Resolve the sync configuration. A missing secret, or a profile id that is
 * not exactly 102, refuses the request (state "misconfigured").
 */
export function readSyncConfig(env: Env = process.env): SyncConfig {
  if (!isSyncEnabled(env)) return { state: 'disabled' };
  const secret = String(env.BFG_SYNC_SIGNING_SECRET || '').trim();
  if (!secret) return { state: 'misconfigured' };
  const profileRaw = String(env.BFG_SYNC_PROFILE_ID || '').trim();
  if (!/^\d+$/.test(profileRaw) || Number(profileRaw) !== ALLOWED_PROFILE_ID) {
    return { state: 'misconfigured' };
  }
  const bankRaw = String(env.BFG_SYNC_BANK_ACCOUNT_ID || '').trim();
  const bankId = /^\d+$/.test(bankRaw) ? Number(bankRaw) : 0;
  const callback = String(env.BFG_SHOP_CALLBACK_URL || '').trim();
  return {
    state: 'ok',
    secret,
    profileId: ALLOWED_PROFILE_ID,
    callbackUrl: /^https:\/\//i.test(callback) ? callback : null,
    bankAccountId: bankId > 0 ? bankId : null,
  };
}
