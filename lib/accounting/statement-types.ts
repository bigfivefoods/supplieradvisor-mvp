/** Client-safe types for the general ledger and cash-flow statement. */

export type LedgerNormal = 'debit' | 'credit';

export type LedgerMovement = {
  date: string;
  journal_id: number;
  entry_number: string | null;
  memo: string | null;
  line_memo: string | null;
  source: string | null;
  debit: number;
  credit: number;
  balance: number;
  natural_balance: number;
};

export type LedgerAccount = {
  account_id: number;
  code: string;
  name: string;
  account_type: string;
  subtype: string | null;
  normal_balance: LedgerNormal;
  opening: number;
  opening_natural: number;
  period_debit: number;
  period_credit: number;
  closing: number;
  closing_natural: number;
  movement_count: number;
  movements: LedgerMovement[];
};

export type GeneralLedger = {
  from: string;
  to: string;
  accounts: LedgerAccount[];
  total_period_debit: number;
  total_period_credit: number;
  balanced: boolean;
  difference: number;
  journal_count: number;
  warning?: string;
  basis: string;
};

export type CashFlowClass = 'operating' | 'investing' | 'financing';

export type CashFlowJournal = {
  journal_id: number;
  date: string;
  entry_number: string | null;
  memo: string | null;
  source: string | null;
  account_code: string | null;
  account_name: string | null;
  amount: number;
  inflow: number;
  outflow: number;
};

export type CashFlowMonth = {
  month: string;
  operating: number;
  investing: number;
  financing: number;
  net: number;
  inflow: number;
  outflow: number;
};

export type Ias7Line = {
  name: string;
  class: CashFlowClass;
  inflow: number;
  outflow: number;
  net: number;
  journals?: CashFlowJournal[];
};

export type IndirectAdjust = {
  name: string;
  amount: number;
};

export type IndirectOperating = {
  profit: number;
  adjustments: IndirectAdjust[];
  netOperating: number;
};

export type Ias7CashFlow = {
  method: 'direct';
  from: string;
  to: string;
  operating: Ias7Line[];
  investing: Ias7Line[];
  financing: Ias7Line[];
  netOperating: number;
  netInvesting: number;
  netFinancing: number;
  netChange: number;
  openingCash: number;
  closingCash: number;
  impliedClose: number;
  reconciled: boolean;
  journalCount: number;
  warning?: string;
  indirect?: IndirectOperating;
  policies: string[];
  months?: CashFlowMonth[];
  budget?: CashFlowBudget;
};

export type CashFlowBudget = {
  set: boolean;
  note: string;
  operatingInflow: number;
  operatingOutflow: number;
  netOperating: number;
  months: Array<{
    month: string;
    inflow: number;
    outflow: number;
    net: number;
  }>;
};

export type BalanceSheetRow = {
  id: number;
  code: string;
  name: string;
  account_type: string;
  subtype: string | null;
  section: string;
  section_label: string;
  amount: number;
};

export type BalanceSheetSummary = {
  assets: number;
  liabilities: number;
  equity: number;
  equityBase: number;
  netIncome: number;
  currentAssets: number;
  nonCurrentAssets: number;
  currentLiabilities: number;
  nonCurrentLiabilities: number;
  balanced: boolean;
};

export type BalanceSheetCompleteness = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

export const SOFP_POLICIES = [
  'Presented as at the reporting date (IAS 1.54–80 / US GAAP classified balance sheet). Amounts are closing ledger balances of all posted journals through that date, not a period movement.',
  'Assets = liabilities + equity. Unclosed profit or loss is rolled into equity until a year-end close transfers it to retained earnings.',
  'Current versus non-current split follows IAS 1.60 using chart subtypes and account codes (receivables, inventory, bank, payables, tax, long-term borrowings).',
  'Trade receivables are the unpaid balance of invoices whose performance obligation has been satisfied (IFRS 15 / ASC 606). Revenue is recognised on the income statement at issue; cash later settles the asset and is not a second sale.',
  'VAT output is a liability and VAT input an asset until the return is settled. Expected credit losses (IFRS 9) reduce receivables when posted from the ECL worksheet.',
] as const;
