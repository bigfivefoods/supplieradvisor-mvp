/**
 * Sample chart for /preview/chart-of-accounts. Nothing here is stored.
 * Status filtering uses the same helper as the live chart API.
 */
import {
  countCoaStatus,
  filterOperatingCoa,
  parseCoaStatus,
  type CoaListRow,
} from './coa-list';

type SampleAccount = CoaListRow & {
  id: number;
  parent_id: number | null;
  currency: string;
  opening_balance: number;
  period_debit: number;
  period_credit: number;
  balance: number;
};

const SAMPLE: SampleAccount[] = [
  {
    id: 1,
    code: '1000',
    name: 'Assets',
    account_type: 'asset',
    is_header: true,
    is_active: true,
    parent_id: null,
    currency: 'ZAR',
    opening_balance: 0,
    period_debit: 0,
    period_credit: 0,
    balance: 0,
  },
  {
    id: 2,
    code: '1110',
    name: 'Bank',
    account_type: 'asset',
    is_header: false,
    is_active: true,
    parent_id: 1,
    currency: 'ZAR',
    opening_balance: 640000,
    period_debit: 12000,
    period_credit: 4000,
    balance: 648000,
  },
  {
    id: 3,
    code: '6100',
    name: 'Salaries',
    account_type: 'expense',
    is_header: false,
    is_active: true,
    parent_id: null,
    currency: 'ZAR',
    opening_balance: 80000,
    period_debit: 15000,
    period_credit: 0,
    balance: 95000,
  },
  {
    id: 4,
    code: '6200',
    name: 'Old rent',
    account_type: 'expense',
    is_header: false,
    is_active: false,
    parent_id: null,
    currency: 'ZAR',
    opening_balance: 24000,
    period_debit: 0,
    period_credit: 0,
    balance: 24000,
  },
  {
    id: 5,
    code: '6300',
    name: 'Retired insurance',
    account_type: 'expense',
    is_header: false,
    is_active: false,
    parent_id: null,
    currency: 'ZAR',
    opening_balance: 3600,
    period_debit: 0,
    period_credit: 0,
    balance: 3600,
  },
  {
    id: 6,
    code: '1180-0000004',
    name: 'AR — Hidden customer',
    account_type: 'asset',
    is_header: false,
    is_active: false,
    parent_id: null,
    currency: 'ZAR',
    opening_balance: 0,
    period_debit: 0,
    period_credit: 0,
    balance: 0,
  },
];

/** Fixture GET for the chart. Returns null for every other path. */
export function coaPreviewJson(path: string, params: URLSearchParams): unknown | null {
  if (!path.startsWith('/api/accounting/chart-of-accounts')) return null;
  const type = params.get('type');
  let accounts = SAMPLE;
  if (type && type !== 'all') {
    accounts = accounts.filter((account) => account.account_type === type);
  }
  const q = params.get('q');
  const status = parseCoaStatus(params.get('status'));
  const counts = countCoaStatus(
    filterOperatingCoa(accounts, { q, status: 'all' })
  );
  return {
    success: true,
    accounts: filterOperatingCoa(accounts, { q, status }),
    counts,
  };
}
