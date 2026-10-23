/**
 * Columns that exist on public.bank_transactions.
 *
 * The live table predates the accounting CREATE TABLE (uuid id, tx_date).
 * Later migrations add txn_date, allocation_status, and the accounting fields.
 * There is no transaction_date, allocated, or is_allocated column.
 */
export const BANK_TRANSACTION_COLUMNS = [
  'id',
  'tx_date',
  'amount',
  'description',
  'bank_provider',
  'grok_category',
  'matched_supplier_id',
  'grok_insight',
  'created_at',
  'profile_id',
  'import_batch_id',
  'external_id',
  'balance_after',
  'allocation_status',
  'gl_account_id',
  'counterparty_name',
  'category',
  'tax_code',
  'tax_amount',
  'matched_invoice_id',
  'allocated_at',
  'allocated_by',
  'notes',
  'bank_account_id',
  'txn_date',
  'reference',
  'currency',
  'status',
  'metadata',
  'matched_payment_id',
  'matched_journal_id',
  'updated_at',
  'provider',
  'provider_txn_id',
  'bank_connection_id',
  'sync_run_id',
  'tax_inclusive',
] as const;

export type BankTransactionColumn = (typeof BANK_TRANSACTION_COLUMNS)[number];

const BANK_COLUMN_SET = new Set<string>(BANK_TRANSACTION_COLUMNS);

export function isBankTransactionColumn(name: string): boolean {
  return BANK_COLUMN_SET.has(name);
}

/** Unallocated lines for the notification bell. Empty result is a valid answer. */
export const UNALLOCATED_BANK_SELECT =
  'id, amount, description, txn_date, tx_date, created_at';

export const UNALLOCATED_BANK_FILTER =
  'allocation_status.eq.unallocated,allocation_status.is.null';

export const UNALLOCATED_BANK_ORDER = 'txn_date';

export type UnallocatedBankLine = {
  txn_date?: string | null;
  tx_date?: string | null;
  created_at?: string | null;
};

export type BankLineNotification = {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'positive';
  title: string;
  body: string;
  href: string;
  created_at: string;
  source: string;
};

export function bankLineTimestamp(row: UnallocatedBankLine, nowIso: string): string {
  if (row.txn_date) return String(row.txn_date);
  if (row.tx_date) return String(row.tx_date);
  if (row.created_at) return String(row.created_at);
  return nowIso;
}

/**
 * One bell item for unallocated bank lines.
 * A query error or an empty table yields no notification.
 */
export function unmatchedBankNotification(
  result: {
    error: unknown;
    data: UnallocatedBankLine[] | null;
  },
  nowIso: string
): BankLineNotification | null {
  if (result.error) return null;
  const rows = result.data || [];
  if (rows.length === 0) return null;
  const n = rows.length;
  return {
    id: 'bank-unmatched',
    severity: n >= 5 ? 'warning' : 'info',
    title: `${n}+ unmatched bank line${n === 1 ? '' : 's'}`,
    body: 'Allocate or auto-match in Accounting → Bank',
    href: '/dashboard/accounting/bank-reconciliation',
    created_at: bankLineTimestamp(rows[0], nowIso),
    source: 'banking',
  };
}

/** Columns written when a payment claim is linked to a bank line. */
export function bankClaimMatchPatch(opts: {
  invoiceId: number;
  now: string;
  actorUserId?: string;
}): Record<string, string | number> {
  return {
    allocation_status: 'allocated',
    matched_invoice_id: opts.invoiceId,
    allocated_at: opts.now,
    allocated_by: opts.actorUserId || 'system',
    updated_at: opts.now,
  };
}
