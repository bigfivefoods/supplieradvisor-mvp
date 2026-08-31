/**
 * Brief 15 — operating CoA list (headers + posting accounts).
 * Named 1180-/2180-/4400- leaves stay off first paint unless search or party_leaves=1.
 * Inactive leftover integers (1190 AR, 4401 Member —) never dump into the tree.
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

/** Leftover named party integers that must not paint as a member-per-line chart. */
export function isLeftoverPartyIntegerCode(
  code?: string | null,
  name?: string | null
): boolean {
  const c = String(code || '').trim();
  if (!c || !/^\d+$/.test(c)) return false;
  const n = Number(c);
  if (n >= 1181 && n < 2000 && n !== 1200) return true;
  if (n >= 2181 && n < 3000) return true;
  if (n >= 4401 && n <= 4699) return true;
  return false;
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
    return accounts.filter((a) => {
      if (a.is_active === false) return false;
      if (isLeftoverPartyIntegerCode(a.code, a.name)) return false;
      return true;
    });
  }
  return accounts.filter((a) => {
    if (a.is_active === false) return false;
    if (isPartyLeafCode(a.code)) return false;
    if (isLeftoverPartyIntegerCode(a.code, a.name)) return false;
    return true;
  });
}
