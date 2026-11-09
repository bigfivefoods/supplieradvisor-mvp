/**
 * Posted-journal reads. The paging lives in `posted-ledger` so trial balance,
 * the balance sheet and the management pack cannot grow a second unpaged query.
 */
import {
  loadPostedLedger,
  fetchJournalLinesByEntryIds as fetchLines,
  type PostedLedgerLine,
} from '@/lib/accounting/posted-ledger';

export type PostedJournalRow = {
  id: number;
  entry_date: string;
  source?: string | null;
};

export async function fetchPostedJournals(opts: {
  profileId: number;
  from?: string | null;
  to?: string | null;
}): Promise<{ rows: PostedJournalRow[]; warning?: string }> {
  const ledger = await loadPostedLedger({
    profileId: opts.profileId,
    from: opts.from,
    to: opts.to,
    includeLines: false,
    journalColumns: 'core',
  });
  return {
    rows: ledger.journals.map((journal) => ({
      id: journal.id,
      entry_date: journal.entry_date,
      source: journal.source,
    })),
    warning: ledger.warning,
  };
}

export async function fetchPostedJournalIds(opts: {
  profileId: number;
  from?: string | null;
  to?: string | null;
}): Promise<{ ids: number[]; warning?: string }> {
  const ledger = await loadPostedLedger({
    profileId: opts.profileId,
    from: opts.from,
    to: opts.to,
    includeLines: false,
    journalColumns: 'id',
    truncateWarning: `Trial balance truncated at 50000 posted journals — contact support to archive or split the entity.`,
  });
  return {
    ids: ledger.journals.map((journal) => journal.id),
    warning: ledger.warning,
  };
}

export async function fetchJournalLinesByEntryIds(
  entryIds: number[],
  select = 'account_id, debit, credit'
): Promise<{
  lines: Array<Record<string, unknown>>;
  warning?: string;
}> {
  const wanted = /memo|counterparty/i.test(select) ? 'detail' : 'amounts';
  const columnSelect =
    wanted === 'detail'
      ? 'journal_entry_id, account_id, debit, credit, memo, counterparty'
      : select.includes('journal_entry_id')
        ? 'journal_entry_id, account_id, debit, credit'
        : 'journal_entry_id, account_id, debit, credit';
  const fetched = await fetchLines(entryIds, columnSelect);
  const lines = fetched.lines.map((line) => lineRecord(line, select));
  return { lines, warning: fetched.warning };
}

function lineRecord(
  line: PostedLedgerLine,
  select: string
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    account_id: line.account_id,
    debit: line.debit,
    credit: line.credit,
  };
  if (select.includes('journal_entry_id')) row.journal_entry_id = line.journal_entry_id;
  if (select.includes('memo')) row.memo = line.memo ?? null;
  if (select.includes('counterparty')) row.counterparty = line.counterparty ?? null;
  return row;
}
