/** Accounting module types — GL, AR/AP, bank, tax, assets */

export type AccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'expense'
  | 'cogs';

export type NormalBalance = 'debit' | 'credit';

export type CoaAccount = {
  id: number;
  profile_id?: number | null;
  code: string;
  name: string;
  account_type: AccountType | string;
  subtype?: string | null;
  parent_id?: number | null;
  is_active?: boolean | null;
  is_system?: boolean | null;
  is_header?: boolean | null;
  currency?: string | null;
  tax_code?: string | null;
  normal_balance?: NormalBalance | string | null;
  description?: string | null;
  sort_order?: number | null;
  entity_id?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  /** computed */
  balance?: number;
};

export type JournalLineInput = {
  account_id: number;
  debit?: number;
  credit?: number;
  memo?: string;
  counterparty?: string;
  tax_code?: string;
};

export type JournalEntry = {
  id: number;
  profile_id?: number | null;
  entry_number?: string | null;
  entry_date: string;
  memo?: string | null;
  status: string; // draft | posted | void
  source?: string | null;
  source_id?: string | null;
  currency?: string | null;
  entity_id?: number | null;
  period_id?: number | null;
  created_by?: string | null;
  posted_at?: string | null;
  onchain_tx?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  lines?: JournalLine[];
  total_debit?: number;
  total_credit?: number;
};

export type JournalLine = {
  id?: number;
  journal_entry_id?: number;
  account_id: number;
  debit?: number | null;
  credit?: number | null;
  memo?: string | null;
  counterparty?: string | null;
  tax_code?: string | null;
  account?: CoaAccount | null;
};

/** direction: receivable (AR) | payable (AP) */
export type InvoiceDirection = 'receivable' | 'payable';

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'void'
  | 'cancelled';

export type AccountingInvoice = {
  id: number;
  profile_id?: number | null;
  direction: InvoiceDirection | string;
  counterparty_name?: string | null;
  counterparty_profile_id?: number | null;
  customer_id?: number | null;
  supplier_id?: number | null;
  invoice_number?: string | null;
  status: string;
  issue_date?: string | null;
  due_date?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  tax_rate?: number | null;
  tax_amount?: number | null;
  total_amount?: number | null;
  amount_paid?: number | null;
  po_id?: number | null;
  sales_order_id?: number | null;
  order_id?: number | null;
  notes?: string | null;
  items?: InvoiceLineItem[] | null;
  bill_to_email?: string | null;
  billing_address?: string | null;
  entity_id?: number | null;
  paid_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  balance_due?: number;
};

export type InvoiceLineItem = {
  description: string;
  quantity?: number;
  unit_price?: number;
  amount?: number;
  tax_rate?: number;
  account_id?: number;
};

export type PaymentRecord = {
  id: number;
  profile_id?: number | null;
  invoice_id?: number | null;
  direction: string; // inbound | outbound
  amount: number;
  currency?: string | null;
  method?: string | null;
  reference?: string | null;
  paid_at?: string | null;
  status?: string | null;
  onchain_tx?: string | null;
  counterparty_name?: string | null;
  bank_account_id?: number | null;
  entity_id?: number | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  invoice?: AccountingInvoice | null;
};

export type BankAccount = {
  id: number;
  profile_id?: number | null;
  entity_id?: number | null;
  gl_account_id?: number | null;
  name: string;
  bank_name?: string | null;
  account_number?: string | null;
  account_type?: string | null;
  currency?: string | null;
  opening_balance?: number | null;
  current_balance?: number | null;
  is_default?: boolean | null;
  status?: string | null;
  provider?: string | null;
  wallet_address?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  unreconciled_count?: number;
};

export type BankTransaction = {
  /** Production legacy table uses UUID ids; newer envs may use bigint. */
  id: number | string;
  profile_id?: number | null;
  bank_account_id: number;
  txn_date: string;
  /** Legacy column name — normalized to txn_date on read when present. */
  tx_date?: string | null;
  description?: string | null;
  reference?: string | null;
  amount: number;
  currency?: string | null;
  status: string;
  /** unallocated | allocated | matched_invoice | excluded */
  allocation_status?: string | null;
  gl_account_id?: number | null;
  counterparty_name?: string | null;
  category?: string | null;
  tax_code?: string | null;
  tax_amount?: number | null;
  balance_after?: number | null;
  external_id?: string | null;
  import_batch_id?: number | null;
  matched_payment_id?: number | null;
  matched_journal_id?: number | null;
  matched_invoice_id?: number | null;
  allocated_at?: string | null;
  allocated_by?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  /** joined */
  gl_account_name?: string | null;
};

export type AccountingEntity = {
  id: number;
  profile_id?: number | null;
  /** Company profile this entity represents (group company / self) */
  linked_profile_id?: number | null;
  code: string;
  name: string;
  legal_name?: string | null;
  country?: string | null;
  currency?: string | null;
  tax_number?: string | null;
  registration_number?: string | null;
  is_primary?: boolean | null;
  status?: string | null;
  address?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  /** Enriched from company_group_links when present */
  group_link_type?: string | null;
  group_link_label?: string | null;
  group_role?: 'parent' | 'child' | null;
};

export type AccountingPeriod = {
  id: number;
  profile_id?: number | null;
  entity_id?: number | null;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  fiscal_year?: number | null;
};

export type AccountingSettings = {
  id?: number;
  profile_id?: number | null;
  base_currency?: string | null;
  fiscal_year_start_month?: number | null;
  default_tax_rate?: number | null;
  invoice_prefix_ar?: string | null;
  invoice_prefix_ap?: string | null;
  journal_prefix?: string | null;
  next_ar_number?: number | null;
  next_ap_number?: number | null;
  next_journal_number?: number | null;
  lock_date?: string | null;
  require_balanced_journals?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

export type TaxRate = {
  id: number;
  profile_id?: number | null;
  code: string;
  name: string;
  rate: number;
  country?: string | null;
  tax_type?: string | null;
  /** standard | zero_rated | exempt | out_of_scope */
  category?: string | null;
  is_default?: boolean | null;
  is_recoverable?: boolean | null;
  gl_account_id?: number | null;
  status?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type FixedAsset = {
  id: number;
  profile_id?: number | null;
  entity_id?: number | null;
  asset_code?: string | null;
  name: string;
  category?: string | null;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  residual_value?: number | null;
  useful_life_months?: number | null;
  depreciation_method?: string | null;
  depreciation_rate?: number | null;
  accumulated_depreciation?: number | null;
  book_value?: number | null;
  status?: string | null;
  disposal_date?: string | null;
  disposal_proceeds?: number | null;
  location?: string | null;
  serial_number?: string | null;
  notes?: string | null;
};

export type AccountingSummary = {
  coaCount: number;
  coaActive: number;
  journalsPosted: number;
  journalsDraft: number;
  arOpen: number;
  arOpenAmount: number;
  arOverdue: number;
  arOverdueAmount: number;
  apOpen: number;
  apOpenAmount: number;
  apOverdue: number;
  apOverdueAmount: number;
  paymentsThisMonth: number;
  paymentsThisMonthAmount: number;
  bankAccounts: number;
  bankBalance: number;
  unreconciled: number;
  entities: number;
  assets: number;
  assetsBookValue: number;
  currency: string;
};

export const ACCOUNT_TYPES: { value: AccountType; label: string; normal: NormalBalance }[] = [
  { value: 'asset', label: 'Asset', normal: 'debit' },
  { value: 'liability', label: 'Liability', normal: 'credit' },
  { value: 'equity', label: 'Equity', normal: 'credit' },
  { value: 'revenue', label: 'Revenue', normal: 'credit' },
  { value: 'expense', label: 'Expense', normal: 'debit' },
  { value: 'cogs', label: 'Cost of sales', normal: 'debit' },
];

export const INVOICE_STATUSES = [
  'draft',
  'sent',
  'partial',
  'paid',
  'overdue',
  'void',
  'cancelled',
] as const;

export const PAYMENT_METHODS = [
  'eft',
  'cash',
  'card',
  'yoco',
  'stripe',
  'crypto',
  'cheque',
  'other',
] as const;

export function formatMoney(
  amount: number | null | undefined,
  currency = 'ZAR',
  opts?: { compact?: boolean }
): string {
  const n = Number(amount || 0);
  const ccy = currency || 'ZAR';
  const abs = Math.abs(n);
  // Auto-compact large values so KPI cards don't overflow on mobile
  const compact =
    opts?.compact === true || (opts?.compact !== false && abs >= 100_000);
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: ccy,
      notation: compact ? 'compact' : 'standard',
      minimumFractionDigits: compact ? 0 : 2,
      maximumFractionDigits: compact ? 1 : 2,
    }).format(n);
  } catch {
    return `${ccy} ${n.toFixed(compact ? 0 : 2)}`;
  }
}

export function invoiceBalance(inv: Pick<AccountingInvoice, 'total_amount' | 'amount_paid'>): number {
  return Math.max(0, Number(inv.total_amount || 0) - Number(inv.amount_paid || 0));
}

export function isOverdue(inv: Pick<AccountingInvoice, 'due_date' | 'status' | 'total_amount' | 'amount_paid'>): boolean {
  if (['paid', 'void', 'cancelled', 'draft'].includes(String(inv.status || ''))) return false;
  if (invoiceBalance(inv) <= 0) return false;
  if (!inv.due_date) return false;
  const due = new Date(inv.due_date);
  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

export function statusClass(status: string): string {
  const s = String(status || '').toLowerCase();
  if (s === 'paid' || s === 'posted' || s === 'reconciled' || s === 'active' || s === 'completed') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-100';
  }
  if (s === 'overdue' || s === 'void' || s === 'cancelled' || s === 'disposed') {
    return 'bg-red-50 text-red-800 border-red-100';
  }
  if (s === 'partial' || s === 'sent' || s === 'draft' || s === 'unreconciled' || s === 'open') {
    return 'bg-amber-50 text-amber-900 border-amber-100';
  }
  return 'bg-neutral-50 text-neutral-700 border-neutral-100';
}

export function accountTypeLabel(t: string): string {
  return ACCOUNT_TYPES.find((a) => a.value === t)?.label || t;
}

/** Monthly straight-line depreciation */
export function monthlyDepreciation(asset: Pick<FixedAsset, 'purchase_cost' | 'residual_value' | 'useful_life_months'>): number {
  const cost = Number(asset.purchase_cost || 0);
  const residual = Number(asset.residual_value || 0);
  const months = Math.max(1, Number(asset.useful_life_months || 60));
  return Math.max(0, (cost - residual) / months);
}

export function computeBookValue(asset: Pick<FixedAsset, 'purchase_cost' | 'accumulated_depreciation'>): number {
  return Math.max(0, Number(asset.purchase_cost || 0) - Number(asset.accumulated_depreciation || 0));
}
