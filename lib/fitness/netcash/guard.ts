/**
 * Company 110 is VUKA Fitness. This module refuses that company until
 * go-live is explicitly approved. The approval flag is read, never printed.
 * Fixtures, seeds, and tests must keep using another company id.
 */

export const LOCKED_COMPANY_ID = 110;

export function companyAllowed(companyId: number): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return { ok: false, error: 'A company is required.' };
  }
  if (companyId === LOCKED_COMPANY_ID && process.env.GYM_NETCASH_ALLOW_COMPANY_110 !== '1') {
    return {
      ok: false,
      error: 'This gym is locked until debit-order go-live is approved.',
    };
  }
  return { ok: true };
}
