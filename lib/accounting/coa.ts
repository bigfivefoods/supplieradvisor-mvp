import type { AccountType, NormalBalance } from './types';

/** Standard starter Chart of Accounts (IFRS-friendly, ZA VAT ready) */
export type CoaSeed = {
  code: string;
  name: string;
  account_type: AccountType;
  subtype?: string;
  normal_balance: NormalBalance;
  is_header?: boolean;
  description?: string;
};

export const DEFAULT_CHART_OF_ACCOUNTS: CoaSeed[] = [
  // Assets
  { code: '1000', name: 'Assets', account_type: 'asset', is_header: true, normal_balance: 'debit' },
  { code: '1100', name: 'Current assets', account_type: 'asset', subtype: 'current', is_header: true, normal_balance: 'debit' },
  { code: '1110', name: 'Bank — operating', account_type: 'asset', subtype: 'bank', normal_balance: 'debit', description: 'Primary operating bank account' },
  { code: '1120', name: 'Petty cash', account_type: 'asset', subtype: 'cash', normal_balance: 'debit' },
  { code: '1130', name: 'Accounts receivable', account_type: 'asset', subtype: 'receivable', normal_balance: 'debit' },
  { code: '1140', name: 'Inventory', account_type: 'asset', subtype: 'inventory', normal_balance: 'debit' },
  { code: '1150', name: 'VAT input (recoverable)', account_type: 'asset', subtype: 'tax', normal_balance: 'debit' },
  { code: '1160', name: 'Prepayments', account_type: 'asset', subtype: 'current', normal_balance: 'debit' },
  { code: '1200', name: 'Non-current assets', account_type: 'asset', subtype: 'fixed', is_header: true, normal_balance: 'debit' },
  { code: '1210', name: 'Property, plant & equipment', account_type: 'asset', subtype: 'fixed', normal_balance: 'debit' },
  { code: '1220', name: 'Accumulated depreciation', account_type: 'asset', subtype: 'contra_asset', normal_balance: 'credit' },
  { code: '1230', name: 'Intangible assets', account_type: 'asset', subtype: 'fixed', normal_balance: 'debit' },

  // Liabilities
  { code: '2000', name: 'Liabilities', account_type: 'liability', is_header: true, normal_balance: 'credit' },
  { code: '2100', name: 'Current liabilities', account_type: 'liability', subtype: 'current', is_header: true, normal_balance: 'credit' },
  { code: '2110', name: 'Accounts payable', account_type: 'liability', subtype: 'payable', normal_balance: 'credit' },
  { code: '2120', name: 'VAT output (payable)', account_type: 'liability', subtype: 'tax', normal_balance: 'credit' },
  { code: '2130', name: 'Accrued expenses', account_type: 'liability', subtype: 'current', normal_balance: 'credit' },
  { code: '2140', name: 'Customer deposits', account_type: 'liability', subtype: 'current', normal_balance: 'credit' },
  { code: '2200', name: 'Non-current liabilities', account_type: 'liability', subtype: 'long_term', is_header: true, normal_balance: 'credit' },
  { code: '2210', name: 'Long-term loans', account_type: 'liability', subtype: 'long_term', normal_balance: 'credit' },

  // Equity
  { code: '3000', name: 'Equity', account_type: 'equity', is_header: true, normal_balance: 'credit' },
  { code: '3100', name: 'Share capital', account_type: 'equity', subtype: 'capital', normal_balance: 'credit' },
  { code: '3200', name: 'Retained earnings', account_type: 'equity', subtype: 'retained', normal_balance: 'credit' },
  { code: '3300', name: 'Owner drawings', account_type: 'equity', subtype: 'drawings', normal_balance: 'debit' },

  // Revenue
  { code: '4000', name: 'Revenue', account_type: 'revenue', is_header: true, normal_balance: 'credit' },
  { code: '4100', name: 'Sales revenue', account_type: 'revenue', subtype: 'sales', normal_balance: 'credit' },
  { code: '4200', name: 'Service revenue', account_type: 'revenue', subtype: 'service', normal_balance: 'credit' },
  { code: '4300', name: 'Other income', account_type: 'revenue', subtype: 'other', normal_balance: 'credit' },

  // Cost of sales
  { code: '5000', name: 'Cost of sales', account_type: 'cogs', is_header: true, normal_balance: 'debit' },
  { code: '5100', name: 'Cost of goods sold', account_type: 'cogs', subtype: 'cogs', normal_balance: 'debit' },
  { code: '5200', name: 'Direct labour', account_type: 'cogs', subtype: 'labour', normal_balance: 'debit' },

  // Expenses
  { code: '6000', name: 'Operating expenses', account_type: 'expense', is_header: true, normal_balance: 'debit' },
  { code: '6100', name: 'Salaries & wages', account_type: 'expense', subtype: 'payroll', normal_balance: 'debit' },
  { code: '6200', name: 'Rent & facilities', account_type: 'expense', subtype: 'facilities', normal_balance: 'debit' },
  { code: '6300', name: 'Utilities', account_type: 'expense', subtype: 'utilities', normal_balance: 'debit' },
  { code: '6400', name: 'Marketing & sales', account_type: 'expense', subtype: 'marketing', normal_balance: 'debit' },
  { code: '6500', name: 'Travel & entertainment', account_type: 'expense', subtype: 'travel', normal_balance: 'debit' },
  { code: '6600', name: 'Professional fees', account_type: 'expense', subtype: 'professional', normal_balance: 'debit' },
  { code: '6700', name: 'Insurance', account_type: 'expense', subtype: 'insurance', normal_balance: 'debit' },
  { code: '6800', name: 'Depreciation expense', account_type: 'expense', subtype: 'depreciation', normal_balance: 'debit' },
  { code: '6900', name: 'Bank charges', account_type: 'expense', subtype: 'finance', normal_balance: 'debit' },
  { code: '6950', name: 'Interest expense', account_type: 'expense', subtype: 'finance', normal_balance: 'debit' },
  { code: '6990', name: 'Miscellaneous expense', account_type: 'expense', subtype: 'other', normal_balance: 'debit' },
];

export const DEFAULT_TAX_RATES = [
  { code: 'VAT15', name: 'Standard VAT 15%', rate: 15, tax_type: 'vat', is_default: true, country: 'ZA' },
  { code: 'VAT0', name: 'Zero-rated VAT', rate: 0, tax_type: 'vat', is_default: false, country: 'ZA' },
  { code: 'EXEMPT', name: 'VAT exempt', rate: 0, tax_type: 'vat', is_default: false, country: 'ZA' },
];
