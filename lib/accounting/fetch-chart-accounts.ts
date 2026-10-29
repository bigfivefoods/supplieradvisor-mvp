/**
 * Load every operating chart account the server is willing to return.
 * Pickers send picker=1 (lean columns, no balances) and follow hasMore.
 * The chart page sends picker:false so period balances stay on, and still
 * follows hasMore if a response is capped.
 */
import { COA_LIST_MAX } from '@/lib/accounting/coa-list';
import type { CoaAccount } from '@/lib/accounting/types';

export type FetchedChartAccounts = {
  accounts: CoaAccount[];
  total: number;
  limit: number | null;
  offset: number;
  hasMore: boolean;
  /** True when paging stopped before the server said the list was complete. */
  truncated: boolean;
  /** Active and inactive operating counts, before the status slice. */
  counts?: { active: number; inactive: number };
  warning?: string;
  hint?: string;
  seeded?: number;
};

type PageBody = {
  accounts?: CoaAccount[];
  total?: number;
  limit?: number | null;
  offset?: number;
  hasMore?: boolean;
  counts?: { active?: number; inactive?: number };
  warning?: string;
  hint?: string;
  seeded?: number;
  error?: string;
};

const PAGE_GUARD = 40;

export async function fetchAllChartOfAccounts(
  base: URLSearchParams,
  opts: { picker: boolean; signal?: AbortSignal }
): Promise<FetchedChartAccounts> {
  const accounts: CoaAccount[] = [];
  let total = 0;
  let limit: number | null = null;
  let offset = 0;
  let hasMore = false;
  let truncated = false;
  let warning: string | undefined;
  let hint: string | undefined;
  let seeded: number | undefined;
  let counts: { active: number; inactive: number } | undefined;

  for (let page = 0; page < PAGE_GUARD; page += 1) {
    const params = new URLSearchParams(base);
    if (opts.picker) {
      params.set('picker', '1');
      params.delete('balances');
      params.set('limit', String(COA_LIST_MAX));
      params.set('offset', String(offset));
    } else if (offset > 0) {
      params.delete('picker');
      params.set('limit', String(COA_LIST_MAX));
      params.set('offset', String(offset));
    } else {
      params.delete('picker');
      params.delete('limit');
      params.delete('offset');
    }
    if (page > 0) params.delete('seed');

    const res = await fetch(`/api/accounting/chart-of-accounts?${params.toString()}`, {
      signal: opts.signal,
    });
    const data = (await res.json().catch(() => ({}))) as PageBody;
    if (!res.ok) {
      throw new Error(data.error || 'Failed to load chart of accounts');
    }

    const batch = Array.isArray(data.accounts) ? data.accounts : [];
    accounts.push(...batch);
    if (typeof data.total === 'number' && Number.isFinite(data.total)) {
      total = data.total;
    } else {
      total = accounts.length;
    }
    limit = data.limit ?? limit;
    if (data.warning) warning = data.warning;
    if (data.hint) hint = data.hint;
    if (page === 0 && data.seeded != null) seeded = Number(data.seeded);
    if (
      !counts &&
      data.counts &&
      Number.isFinite(Number(data.counts.active)) &&
      Number.isFinite(Number(data.counts.inactive))
    ) {
      counts = {
        active: Number(data.counts.active),
        inactive: Number(data.counts.inactive),
      };
    }
    hasMore = data.hasMore === true;

    if (!hasMore) break;
    if (batch.length === 0) {
      truncated = true;
      break;
    }
    offset += batch.length;
    if (page === PAGE_GUARD - 1 && hasMore) truncated = true;
  }

  if (truncated) {
    const note = `Showing ${accounts.length} of ${total} accounts.`;
    warning = warning ? `${warning} ${note}` : note;
  }

  return {
    accounts,
    total: total || accounts.length,
    limit,
    offset: 0,
    hasMore: truncated,
    truncated,
    counts,
    warning,
    hint,
    seeded,
  };
}
