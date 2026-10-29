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

export type CoaStatusFilter = 'active' | 'inactive' | 'all';

/** `null` means the caller did not ask — keep the historical operating list. */
export function parseCoaStatus(
  raw: string | null | undefined
): CoaStatusFilter | null {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'active' || s === 'inactive' || s === 'all') return s;
  return null;
}

export function countCoaStatus<T extends CoaListRow>(
  accounts: T[]
): { active: number; inactive: number } {
  let active = 0;
  let inactive = 0;
  for (const account of accounts) {
    if (account.is_active === false) inactive += 1;
    else active += 1;
  }
  return { active, inactive };
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

function matchesCoaQuery(account: CoaListRow, q: string): boolean {
  if (!q) return true;
  return (
    String(account.code || '').toLowerCase().includes(q) ||
    String(account.name || '').toLowerCase().includes(q) ||
    String(account.account_type || '').toLowerCase().includes(q)
  );
}

/** Party leaves and leftover integers stay off the operating tree unless searching. */
function structurallyVisible(
  account: CoaListRow,
  opts: { partyLeaves?: boolean },
  q: string
): boolean {
  if (q) return true;
  if (isLeftoverPartyIntegerCode(account.code, account.name)) return false;
  if (!opts.partyLeaves && isPartyLeafCode(account.code)) return false;
  return true;
}

/**
 * Omitted status keeps the historical list: search can still find inactive rows,
 * and the operating chart stays active-only (bank allocation and other pickers).
 * An explicit status applies even while searching.
 */
function statusAllows(
  account: CoaListRow,
  status: CoaStatusFilter | null,
  q: string
): boolean {
  if (status === 'all') return true;
  if (status === 'inactive') return account.is_active === false;
  if (status === 'active') return account.is_active !== false;
  if (q) return true;
  return account.is_active !== false;
}

export function accountMatchesCoaStatus(
  account: CoaListRow,
  status: CoaStatusFilter
): boolean {
  return statusAllows(account, status, '');
}

export function filterOperatingCoa<T extends CoaListRow>(
  accounts: T[],
  opts: {
    partyLeaves?: boolean;
    q?: string | null;
    status?: CoaStatusFilter | null;
  }
): T[] {
  const q = String(opts.q || '').trim().toLowerCase();
  const status = opts.status === undefined ? null : opts.status;
  return accounts.filter(
    (account) =>
      matchesCoaQuery(account, q) &&
      structurallyVisible(account, opts, q) &&
      statusAllows(account, status, q)
  );
}
