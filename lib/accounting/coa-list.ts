/**
 * Brief 15 — operating CoA list (headers + posting accounts).
 * Named 1180-/2180-/4400- leaves stay off first paint unless search or party_leaves=1.
 * Inactive leftover integers (1190 AR, 4401 Member —) never dump into the tree.
 */

export const PARTY_LEAF_RE = /^(1180|2180|4400)-/;
/**
 * Historical silent cap (Brief 15 / PR #55). Do not apply this when `limit`
 * is omitted — pickers that forgot `?limit` were losing accounts such as 6900.
 */
export const COA_LIST_DEFAULT = 50;
/** Largest page a single response will return when the client asks for a page. */
export const COA_LIST_MAX = 500;
/**
 * Lean columns for GL pickers. No description, entity, sort, or balance fields.
 * `subtype` stays so AR/AP grouping in the allocation dropdown still works.
 */
export const COA_PICKER_SELECT =
  'id, code, name, account_type, subtype, parent_id, is_active, is_header, is_system, normal_balance, tax_code';

export type CoaListRow = {
  code?: string | null;
  name?: string | null;
  account_type?: string | null;
  is_header?: boolean | null;
  is_active?: boolean | null;
};

/**
 * Explicit `?limit=` page size, capped at COA_LIST_MAX.
 * Omitted, blank, or non-positive means "do not slice" — never the old default of 50.
 */
export function parseCoaListLimit(raw: string | null | undefined): number | null {
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.floor(n), COA_LIST_MAX);
}

/** Picker pages default to the max page, never the historical 50. */
export function parseCoaPickerLimit(raw: string | null | undefined): number {
  return parseCoaListLimit(raw) ?? COA_LIST_MAX;
}

export function parseCoaListOffset(raw: string | null | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

export type CoaListPage<T> = {
  rows: T[];
  total: number;
  limit: number | null;
  offset: number;
  hasMore: boolean;
};

/** Slice a filtered chart. `limit: null` returns the remainder and sets hasMore false. */
export function sliceCoaList<T>(
  rows: readonly T[],
  opts: { limit: number | null; offset?: number }
): CoaListPage<T> {
  const total = rows.length;
  const offset = Math.max(0, Math.floor(opts.offset || 0));
  if (opts.limit == null) {
    return {
      rows: offset > 0 ? rows.slice(offset) : rows.slice(),
      total,
      limit: null,
      offset,
      hasMore: false,
    };
  }
  const limit = Math.max(0, Math.floor(opts.limit));
  const page = rows.slice(offset, offset + limit);
  return {
    rows: page,
    total,
    limit,
    offset,
    hasMore: offset + page.length < total,
  };
}

const COA_PICKER_PAGE_GUARD = 40;

/**
 * Walk every page until hasMore is false. Page size may be the old default
 * of 50 or COA_LIST_MAX — the tail account is still included.
 */
export function collectCoaPages<T>(
  rows: readonly T[],
  pageSize: number
): { rows: T[]; pages: number; total: number; truncated: boolean } {
  const out: T[] = [];
  let offset = 0;
  let pages = 0;
  let total = rows.length;
  let truncated = false;
  while (pages < COA_PICKER_PAGE_GUARD) {
    const page = sliceCoaList(rows, { limit: pageSize, offset });
    total = page.total;
    pages += 1;
    out.push(...page.rows);
    if (!page.hasMore) {
      return { rows: out, pages, total, truncated: false };
    }
    if (page.rows.length === 0) {
      truncated = true;
      break;
    }
    offset += page.rows.length;
  }
  if (offset < total) truncated = true;
  return { rows: out, pages, total, truncated };
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
