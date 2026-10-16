import type { RecoverBookStats } from './types';

/** One account row, shaped like the columns `loadBookStats` used to scan. */
export type BookCountRow = {
  balance_cents?: number | null;
  assigned_to?: string | null;
  state?: string | null;
};

/**
 * Counts a book in memory. `closedCount` is state `closed` only
 * (`prescribed` and `stopped` stay out). Live head-counts use the same rules.
 * `placedBalanceCents` here is the full active sum. The database loader still
 * sums only the first 2,000 balance rows and says so.
 */
export function summariseBookRows(rows: readonly BookCountRow[]): RecoverBookStats {
  const active = rows.filter((row) => row.state === 'active' || !row.state);
  return {
    placedCount: rows.length,
    placedBalanceCents: active.reduce((sum, row) => sum + Number(row.balance_cents || 0), 0),
    assignedCount: rows.filter((row) => Boolean(row.assigned_to)).length,
    unassignedCount: rows.filter((row) => !row.assigned_to && (row.state === 'active' || !row.state)).length,
    imported: rows.length > 0,
    arrangementCount: rows.filter((row) => row.state === 'arrangement').length,
    paidCount: rows.filter((row) => row.state === 'paid').length,
    recalledCount: rows.filter((row) => row.state === 'recalled').length,
    closedCount: rows.filter((row) => row.state === 'closed').length,
  };
}

export type BookCountFilter = 'placed' | 'assigned' | 'unassigned' | 'arrangement' | 'paid' | 'recalled' | 'closed';

type CountResult = { count: number | null; error: { message?: string; code?: string } | null };
type BalanceResult = { data: BookCountRow[] | null; error: { message?: string; code?: string } | null };

export type BookStatsClient = {
  count(filter: BookCountFilter): Promise<CountResult>;
  balance(): Promise<BalanceResult>;
};

export function isBookStatsPending(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '').toLowerCase();
  const recoverObject = message.includes('recover_');
  const missing =
    code === '42P01' ||
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find');
  return recoverObject && missing;
}

/** Turns head-counts plus a balance sample into book stats. Shared by the loader and tests. */
export async function assembleBookStats(source: BookStatsClient): Promise<RecoverBookStats | null> {
  const filters: BookCountFilter[] = ['placed', 'assigned', 'unassigned', 'arrangement', 'paid', 'recalled', 'closed'];
  const [counts, balance] = await Promise.all([
    Promise.all(filters.map((filter) => source.count(filter))),
    source.balance(),
  ]);
  if (counts.some((row) => isBookStatsPending(row.error))) return null;
  if (counts.some((row) => row.error || row.count == null)) return null;
  if (isBookStatsPending(balance.error)) return null;
  const value = (filter: BookCountFilter) => counts[filters.indexOf(filter)]?.count ?? 0;
  const placedBalanceCents = balance.error
    ? null
    : (balance.data || [])
        .filter((row) => row.state === 'active' || !row.state)
        .reduce((sum, row) => sum + Number(row.balance_cents || 0), 0);
  return bookStatsFromCounts({
    placed: value('placed'),
    assigned: value('assigned'),
    unassigned: value('unassigned'),
    arrangement: value('arrangement'),
    paid: value('paid'),
    recalled: value('recalled'),
    closed: value('closed'),
    placedBalanceCents,
    imported: value('placed') > 0,
  });
}

export function bookStatsFromCounts(input: {
  placed: number;
  assigned: number;
  unassigned: number;
  arrangement: number;
  paid: number;
  recalled: number;
  closed: number;
  placedBalanceCents: number | null;
  imported?: boolean;
}): RecoverBookStats {
  return {
    placedCount: input.placed,
    placedBalanceCents: input.placedBalanceCents,
    assignedCount: input.assigned,
    unassignedCount: input.unassigned,
    imported: input.imported ?? input.placed > 0,
    arrangementCount: input.arrangement,
    paidCount: input.paid,
    recalledCount: input.recalled,
    closedCount: input.closed,
  };
}
