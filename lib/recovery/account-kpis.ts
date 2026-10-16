import type { RecoverBookStats, RecoverRole } from './types';

type AccountRow = {
  state?: string | null;
  balance_cents?: number | null;
  assignee?: string | null;
};

export type AccountKpiFigures = {
  placed: number;
  /** Null means the balance query failed. Do not render that as R 0,00. */
  balanceCents: number | null;
  assigned: number;
  unassigned: number;
  arrangement: number;
  paid: number;
};

/**
 * Figures for the Accounts page.
 * An agent ignores desk book stats. Placed stays the rows on this page and
 * Balance stays the sum of those rows, which is what the page showed when
 * the agent book was null.
 */
export function accountKpiFigures(input: {
  role: RecoverRole;
  rows: readonly AccountRow[];
  stats?: RecoverBookStats | null;
  placedCount?: number;
  serverQuery: boolean;
}): AccountKpiFigures {
  const rows = input.rows;
  const fromRows: AccountKpiFigures = {
    placed: input.serverQuery ? (input.placedCount ?? rows.length) : rows.length,
    balanceCents: rows.reduce((sum, row) => sum + (row.state === 'active' ? Number(row.balance_cents || 0) : 0), 0),
    assigned: rows.filter((row) => row.assignee).length,
    unassigned: rows.filter((row) => !row.assignee && row.state === 'active').length,
    arrangement: rows.filter((row) => row.state === 'arrangement').length,
    paid: rows.filter((row) => row.state === 'paid').length,
  };
  if (input.role === 'agent' || !input.stats) {
    if (input.role === 'agent') {
      return { ...fromRows, placed: rows.length };
    }
    return fromRows;
  }
  return {
    placed: input.stats.placedCount,
    balanceCents: input.stats.placedBalanceCents,
    assigned: input.stats.assignedCount,
    unassigned: input.stats.unassignedCount,
    arrangement: input.stats.arrangementCount ?? fromRows.arrangement,
    paid: input.stats.paidCount ?? fromRows.paid,
  };
}
