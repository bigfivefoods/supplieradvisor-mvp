/**
 * The only posted-ledger read used by financial reports.
 * PostgREST returns at most 1,000 rows unless the query is paged with
 * `.range`. Every statement (AFS, balance sheet, trial balance, management
 * accounts page and PDF) loads journals through `loadPostedLedger` and
 * totals them with `totalsFromLedger`.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { round2 } from '@/lib/accounting/server';

export const POSTED_LEDGER_PAGE = 1000;
export const POSTED_LEDGER_HARD_CAP = 50_000;
const LINE_CHUNK = 150;

const JOURNAL_SELECT = {
  id: 'id, entry_date',
  core: 'id, entry_date, source',
  detail:
    'id, entry_date, status, source, source_id, memo, entry_number, currency, posted_at, created_at, metadata',
} as const;

const LINE_SELECT = {
  amounts: 'journal_entry_id, account_id, debit, credit',
  detail: 'journal_entry_id, account_id, debit, credit, memo, counterparty',
} as const;

export type PostedLedgerJournal = {
  id: number;
  entry_date: string;
  source: string | null;
  source_id?: string | null;
  status?: string | null;
  memo?: string | null;
  entry_number?: string | null;
  currency?: string | null;
  posted_at?: string | null;
  created_at?: string | null;
  metadata?: unknown;
};

export type PostedLedgerLine = {
  journal_entry_id: number;
  account_id: number;
  debit: number;
  credit: number;
  memo?: string | null;
  counterparty?: string | null;
};

export type PostedLedger = {
  journals: PostedLedgerJournal[];
  lines: PostedLedgerLine[];
  warning?: string;
};

export type LedgerTotalRow = {
  account_id: number;
  debit: number;
  credit: number;
};

type LedgerClient = {
  // Supabase's builder is thenable. Tests pass an in-memory double.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

function isColumnError(message: string): boolean {
  return /column|42703/i.test(message);
}

function mapJournal(row: Record<string, unknown>): PostedLedgerJournal | null {
  const id = Number(row.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    entry_date: String(row.entry_date || '').slice(0, 10),
    source: row.source != null ? String(row.source) : null,
    source_id: row.source_id != null ? String(row.source_id) : null,
    status: row.status != null ? String(row.status) : null,
    memo: row.memo != null ? String(row.memo) : null,
    entry_number: row.entry_number != null ? String(row.entry_number) : null,
    currency: row.currency != null ? String(row.currency) : null,
    posted_at: row.posted_at != null ? String(row.posted_at) : null,
    created_at: row.created_at != null ? String(row.created_at) : null,
    metadata: row.metadata,
  };
}

function mapLine(row: Record<string, unknown>): PostedLedgerLine | null {
  const accountId = Number(row.account_id);
  const journalId = Number(row.journal_entry_id);
  if (!Number.isFinite(accountId) || !Number.isFinite(journalId)) return null;
  return {
    journal_entry_id: journalId,
    account_id: accountId,
    debit: Number(row.debit || 0),
    credit: Number(row.credit || 0),
    memo: row.memo != null ? String(row.memo) : null,
    counterparty: row.counterparty != null ? String(row.counterparty) : null,
  };
}

async function pageJournals(
  client: LedgerClient,
  opts: {
    profileId: number;
    from?: string | null;
    to?: string | null;
    select: string;
    truncateWarning: string;
  }
): Promise<{ rows: PostedLedgerJournal[]; warning?: string; columnMissing?: boolean }> {
  const rows: PostedLedgerJournal[] = [];
  let offset = 0;
  while (offset < POSTED_LEDGER_HARD_CAP) {
    let query = client
      .from('journal_entries')
      .select(opts.select)
      .eq('profile_id', opts.profileId)
      .eq('status', 'posted')
      .order('id', { ascending: true })
      .range(offset, offset + POSTED_LEDGER_PAGE - 1);
    if (opts.from) query = query.gte('entry_date', opts.from);
    if (opts.to) query = query.lte('entry_date', opts.to);
    const { data, error } = await query;
    if (error) {
      if (isColumnError(error.message || '')) {
        return { rows: [], columnMissing: true, warning: error.message };
      }
      return { rows, warning: error.message };
    }
    const page = (data || []) as Array<Record<string, unknown>>;
    for (const row of page) {
      const mapped = mapJournal(row);
      if (mapped) rows.push(mapped);
    }
    if (page.length < POSTED_LEDGER_PAGE) return { rows };
    offset += POSTED_LEDGER_PAGE;
  }
  return { rows, warning: opts.truncateWarning };
}

export async function fetchJournalLinesByEntryIds(
  entryIds: number[],
  select: string = LINE_SELECT.amounts,
  client?: LedgerClient
): Promise<{ lines: PostedLedgerLine[]; warning?: string; columnMissing?: boolean }> {
  const supabase = (client ?? getSupabaseServer()) as LedgerClient;
  const lines: PostedLedgerLine[] = [];
  const chunks: number[][] = [];
  for (let i = 0; i < entryIds.length; i += LINE_CHUNK) {
    chunks.push(entryIds.slice(i, i + LINE_CHUNK));
  }
  for (let i = 0; i < chunks.length; i += 4) {
    const batch = chunks.slice(i, i + 4);
    const pages = await Promise.all(
      batch.map((chunk) =>
        supabase.from('journal_lines').select(select).in('journal_entry_id', chunk)
      )
    );
    for (const page of pages) {
      if (page.error) {
        if (isColumnError(page.error.message || '')) {
          return { lines, columnMissing: true, warning: page.error.message };
        }
        return { lines, warning: page.error.message };
      }
      const rows = (page.data || []) as Array<Record<string, unknown>>;
      for (const row of rows) {
        const mapped = mapLine(row);
        if (mapped) lines.push(mapped);
      }
    }
  }
  return { lines };
}

export async function loadPostedLedger(opts: {
  profileId: number;
  from?: string | null;
  to?: string | null;
  includeLines?: boolean;
  journalColumns?: keyof typeof JOURNAL_SELECT;
  lineColumns?: keyof typeof LINE_SELECT;
  truncateWarning?: string;
  /** In-memory double for tests. Production reports omit this. */
  client?: LedgerClient;
}): Promise<PostedLedger> {
  const supabase = (opts.client ?? getSupabaseServer()) as LedgerClient;
  const from = opts.from ? String(opts.from).slice(0, 10) : null;
  const to = opts.to ? String(opts.to).slice(0, 10) : null;
  const truncateWarning =
    opts.truncateWarning ||
    `Journal fetch truncated at ${POSTED_LEDGER_HARD_CAP} posted journals.`;
  const order: Array<keyof typeof JOURNAL_SELECT> =
    opts.journalColumns === 'detail'
      ? ['detail', 'core', 'id']
      : opts.journalColumns === 'id'
        ? ['id']
        : ['core', 'id'];

  let journals: PostedLedgerJournal[] = [];
  let warning: string | undefined;
  for (const key of order) {
    const page = await pageJournals(supabase, {
      profileId: opts.profileId,
      from,
      to,
      select: JOURNAL_SELECT[key],
      truncateWarning,
    });
    if (page.columnMissing) continue;
    journals = page.rows;
    warning = page.warning;
    break;
  }

  if (opts.includeLines === false || !journals.length) {
    return { journals, lines: [], warning };
  }

  const ids = journals.map((journal) => journal.id);
  const lineOrder: Array<keyof typeof LINE_SELECT> =
    opts.lineColumns === 'detail' ? ['detail', 'amounts'] : ['amounts'];
  let lines: PostedLedgerLine[] = [];
  for (const key of lineOrder) {
    const fetched = await fetchJournalLinesByEntryIds(ids, LINE_SELECT[key], supabase);
    if (fetched.columnMissing) continue;
    lines = fetched.lines;
    warning = [warning, fetched.warning].filter(Boolean).join(' ') || undefined;
    break;
  }
  return { journals, lines, warning };
}

/**
 * Debit/credit by account for the journals in `opts`.
 * Date and source filters apply in memory so one paged load can feed
 * several statement windows (AFS current, comparative, and the P&L period).
 */
export function totalsFromLedger(opts: {
  journals: Array<{ id: number; entry_date?: string | null; source?: string | null }>;
  lines: Array<{
    journal_entry_id?: number | null;
    account_id: number;
    debit?: number | null;
    credit?: number | null;
  }>;
  from?: string | null;
  to?: string | null;
  excludeSources?: string[] | null;
}): {
  rows: LedgerTotalRow[];
  entry_count: number;
  total_debit: number;
  total_credit: number;
} {
  const from = opts.from ? String(opts.from).slice(0, 10) : null;
  const to = opts.to ? String(opts.to).slice(0, 10) : null;
  const exclude = new Set(
    (opts.excludeSources || []).map((source) => String(source).toLowerCase())
  );
  const live = new Set<number>();
  for (const journal of opts.journals) {
    const id = Number(journal.id);
    if (!Number.isFinite(id)) continue;
    const date = String(journal.entry_date || '').slice(0, 10);
    if (from && date && date < from) continue;
    if (to && date && date > to) continue;
    const source = String(journal.source || '').toLowerCase();
    if (exclude.size && exclude.has(source)) continue;
    live.add(id);
  }

  const byAccount = new Map<number, { debit: number; credit: number }>();
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of opts.lines) {
    const journalId = Number(line.journal_entry_id);
    if (Number.isFinite(journalId) && journalId > 0 && !live.has(journalId)) continue;
    const accountId = Number(line.account_id);
    if (!Number.isFinite(accountId)) continue;
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    totalDebit += debit;
    totalCredit += credit;
    const current = byAccount.get(accountId) || { debit: 0, credit: 0 };
    current.debit += debit;
    current.credit += credit;
    byAccount.set(accountId, current);
  }

  return {
    entry_count: live.size,
    total_debit: round2(totalDebit),
    total_credit: round2(totalCredit),
    rows: [...byAccount.entries()].map(([account_id, value]) => ({
      account_id,
      debit: round2(value.debit),
      credit: round2(value.credit),
    })),
  };
}
