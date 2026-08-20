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
};
