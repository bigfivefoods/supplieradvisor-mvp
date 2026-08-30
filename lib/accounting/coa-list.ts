/**
 * Brief 15 — operating CoA list (headers + posting accounts).
 * Named 1180-/2180-/4400- leaves stay off first paint unless search or party_leaves=1.
 */

export const PARTY_LEAF_RE = /^(1180|2180|4400)-/;
export const COA_LIST_DEFAULT = 50;
export const COA_LIST_MAX = 500;

export type CoaListRow = {
  code?: string | null;
  name?: string | null;
  account_type?: string | null;
  is_header?: boolean | null;
  is_active?: boolean | null;
};

export function parseCoaListLimit(raw: string | null | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return COA_LIST_DEFAULT;
  return Math.min(Math.floor(n), COA_LIST_MAX);
}

export function isPartyLeafCode(code?: string | null): boolean {
  return PARTY_LEAF_RE.test(String(code || ''));
}

export function filterOperatingCoa<T extends CoaListRow>(
  accounts: T[],
  opts: { partyLeaves?: boolean; q?: string | null }
): T[] {
  const q = String(opts.q || '').trim().toLowerCase();
  if (q) {
    return accounts.filter(
      (a) =>
        String(a.code || '').toLowerCase().includes(q) ||
        String(a.name || '').toLowerCase().includes(q) ||
        String(a.account_type || '').toLowerCase().includes(q)
    );
  }
  if (opts.partyLeaves) {
    return accounts.filter(
      (a) => !(isPartyLeafCode(a.code) && a.is_active === false)
    );
  }
  return accounts.filter((a) => !isPartyLeafCode(a.code));
}
