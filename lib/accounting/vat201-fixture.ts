/**
 * Fixture books for the VAT201 preview. Not company 102’s live ledger.
 * The VAT number is the registration on that profile so the sample reads
 * the same way the settings screen will. No production database is read.
 */
import { assembleVatDocuments, type AssembleInvoice, type AssembleJournal, type AssembleLine } from '@/lib/accounting/vat201-assemble';
import {
  buildVat201Pack,
  vatPeriods,
  type Vat201Report,
  type VatAccountSnap,
  type VatBasis,
  type VatVendorSettings,
} from '@/lib/accounting/vat201-model';

export const FIXTURE_TODAY = '2026-11-09';
export const FIXTURE_PERIOD_END = '2025-08-31';

export const FIXTURE_SETTINGS: VatVendorSettings = {
  vatNumber: '4280321847',
  basis: 'payment',
  category: 'B',
  effectiveFrom: '2025-05-29',
  firstPeriodEnd: '2025-06-30',
  filingChannel: 'efiling',
};

export const FIXTURE_ACCOUNTS: VatAccountSnap[] = [
  { id: 1, code: '1110', name: 'Bank — operating', account_type: 'asset', subtype: 'bank' },
  { id: 4, code: '1150', name: 'VAT input (recoverable)', account_type: 'asset', subtype: 'tax' },
  { id: 5, code: '2120', name: 'VAT output (payable)', account_type: 'liability', subtype: 'tax' },
  { id: 6, code: '2130', name: 'Accrued expenses', account_type: 'liability', subtype: 'current' },
  { id: 7, code: '2140', name: 'Customer deposits', account_type: 'liability', subtype: 'current' },
  { id: 8, code: '1210', name: 'Property, plant & equipment', account_type: 'asset', subtype: 'fixed' },
  { id: 9, code: '4100', name: 'Sales revenue', account_type: 'revenue', subtype: 'sales' },
  { id: 10, code: '6990', name: 'Miscellaneous expense', account_type: 'expense', subtype: 'other' },
];

const goods = [{ description: 'Dried fruit', quantity: 10 }];

export const FIXTURE_INVOICES: AssembleInvoice[] = [
  {
    id: 1001,
    direction: 'receivable',
    status: 'paid',
    issue_date: '2025-06-20',
    invoice_number: 'INV-1001',
    counterparty_name: 'Harbour Grocers',
    subtotal: 10000,
    tax_amount: 1500,
    total_amount: 11500,
    tax_code: 'VAT15',
    tax_rate: 15,
    amount_paid: 11500,
    paid_at: '2025-07-15',
    billing_address: '12 Example Street, Durban',
    customer_vat_number: '4111111111',
    items: goods,
    metadata: { recognition_journal_id: 1 },
  },
  {
    id: 1002,
    direction: 'receivable',
    status: 'paid',
    issue_date: '2025-07-02',
    invoice_number: 'INV-1002',
    counterparty_name: 'Maputo Foods',
    subtotal: 8000,
    tax_amount: 0,
    total_amount: 8000,
    tax_code: 'VAT0',
    tax_rate: 0,
    amount_paid: 8000,
    paid_at: '2025-07-02',
    billing_address: '4 Export Lane, Durban',
    customer_vat_number: '4111111112',
    items: [{ description: 'Zero-rated export', quantity: 40 }],
    metadata: { vat201_field: '2A', export: true, recognition_journal_id: 2 },
  },
  {
    id: 1003,
    direction: 'receivable',
    status: 'paid',
    issue_date: '2025-07-10',
    invoice_number: 'INV-1003',
    counterparty_name: 'North Coast School',
    subtotal: 2000,
    tax_amount: 0,
    total_amount: 2000,
    tax_code: 'EXEMPT',
    tax_rate: 0,
    amount_paid: 2000,
    paid_at: '2025-07-10',
    billing_address: '8 School Road, Ballito',
    customer_vat_number: '4111111113',
    items: [{ description: 'Exempt supply', quantity: 1 }],
    metadata: { vat_category: 'exempt', recognition_journal_id: 3 },
  },
  {
    id: 1004,
    direction: 'receivable',
    status: 'paid',
    issue_date: '2025-08-01',
    invoice_number: 'INV-1004',
    counterparty_name: 'Plant Buyers',
    subtotal: 20000,
    tax_amount: 3000,
    total_amount: 23000,
    tax_code: 'VAT15',
    tax_rate: 15,
    amount_paid: 23000,
    paid_at: '2025-08-20',
    billing_address: '9 Mill Road, Pinetown',
    customer_vat_number: '4111111114',
    items: [{ description: 'Packing line', quantity: 1 }],
    metadata: { capital: true, recognition_journal_id: 4 },
  },
  {
    id: 1005,
    direction: 'receivable',
    status: 'partial',
    issue_date: '2025-08-08',
    invoice_number: 'INV-1005',
    counterparty_name: 'Corner Cafe',
    subtotal: 2000,
    tax_amount: 300,
    total_amount: 2300,
    tax_code: 'VAT15',
    tax_rate: 15,
    amount_paid: 1150,
    paid_at: '2025-08-25',
    billing_address: '3 Beach Road, Umhlanga',
    customer_vat_number: '4111111115',
    items: goods,
    metadata: { recognition_journal_id: 5 },
  },
  {
    id: 200,
    direction: 'payable',
    status: 'issued',
    issue_date: '2025-07-05',
    invoice_number: 'BILL-200',
    counterparty_name: 'Sugar Mill',
    subtotal: 4000,
    tax_amount: 600,
    total_amount: 4600,
    tax_code: 'VAT15',
    tax_rate: 15,
    amount_paid: 0,
    supplier_vat_number: '4222222221',
    items: [{ description: 'Sugar', quantity: 20 }],
    metadata: { tax_invoice: true, supplier_address: 'Mill Lane, Durban', recognition_journal_id: 6 },
  },
  {
    id: 201,
    direction: 'payable',
    status: 'paid',
    issue_date: '2025-05-10',
    invoice_number: 'BILL-201',
    counterparty_name: 'Equipment Co',
    subtotal: 20000,
    tax_amount: 3000,
    total_amount: 23000,
    tax_code: 'VAT15',
    tax_rate: 15,
    amount_paid: 23000,
    paid_at: '2025-08-12',
    supplier_vat_number: '4222222222',
    items: [{ description: 'Forklift', quantity: 1 }],
    metadata: { tax_invoice: true, capital: true, supplier_address: '14 Plant Street, Johannesburg', recognition_journal_id: 7 },
  },
  {
    id: 202,
    direction: 'payable',
    status: 'paid',
    issue_date: '2025-07-18',
    invoice_number: 'BILL-202',
    counterparty_name: 'Packaging Desk',
    subtotal: 1000,
    tax_amount: 150,
    total_amount: 1150,
    tax_code: 'VAT15',
    tax_rate: 15,
    amount_paid: 1150,
    paid_at: '2025-07-28',
    items: [{ description: '', quantity: 1 }],
    metadata: { recognition_journal_id: 8 },
  },
  {
    id: 203,
    direction: 'payable',
    status: 'paid',
    issue_date: '2025-08-02',
    invoice_number: 'BILL-203',
    counterparty_name: 'Cold Store',
    subtotal: 6000,
    tax_amount: 900,
    total_amount: 6900,
    tax_code: 'VAT15',
    tax_rate: 15,
    amount_paid: 6900,
    paid_at: '2025-08-19',
    supplier_vat_number: '4222222223',
    items: [{ description: 'Storage', quantity: 1 }],
    metadata: { tax_invoice: true, recognition_journal_id: 9 },
  },
  {
    id: 204,
    direction: 'payable',
    status: 'paid',
    issue_date: '2025-08-03',
    invoice_number: 'SLIP-204',
    counterparty_name: 'Harbour Cafe',
    subtotal: 40,
    tax_amount: 6,
    total_amount: 46,
    tax_code: 'VAT15',
    tax_rate: 15,
    amount_paid: 46,
    paid_at: '2025-08-03',
    metadata: { recognition_journal_id: 10 },
  },
];

export const FIXTURE_JOURNALS: AssembleJournal[] = [
  { id: 1, entry_date: '2025-06-20', source: 'invoice_recognition', source_id: '1001', metadata: { invoice_id: 1001 } },
  { id: 11, entry_date: '2025-07-15', source: 'invoice_settlement', source_id: '1001', metadata: { invoice_id: 1001 } },
  { id: 4, entry_date: '2025-08-01', source: 'invoice_recognition', source_id: '1004', metadata: { invoice_id: 1004 } },
  { id: 14, entry_date: '2025-08-20', source: 'invoice_settlement', source_id: '1004', metadata: { invoice_id: 1004 } },
  { id: 5, entry_date: '2025-08-08', source: 'invoice_recognition', source_id: '1005', metadata: { invoice_id: 1005 } },
  { id: 15, entry_date: '2025-08-25', source: 'invoice_settlement', source_id: '1005', metadata: { invoice_id: 1005 } },
  { id: 6, entry_date: '2025-07-05', source: 'invoice_recognition', source_id: '200', metadata: { invoice_id: 200 } },
  { id: 7, entry_date: '2025-05-10', source: 'invoice_recognition', source_id: '201', metadata: { invoice_id: 201 } },
  { id: 17, entry_date: '2025-08-12', source: 'invoice_settlement', source_id: '201', metadata: { invoice_id: 201 } },
  { id: 8, entry_date: '2025-07-18', source: 'invoice_recognition', source_id: '202', metadata: { invoice_id: 202 } },
  { id: 18, entry_date: '2025-07-28', source: 'invoice_settlement', source_id: '202', metadata: { invoice_id: 202 } },
  { id: 9, entry_date: '2025-08-02', source: 'invoice_recognition', source_id: '203', metadata: { invoice_id: 203 } },
  { id: 19, entry_date: '2025-08-19', source: 'invoice_settlement', source_id: '203', metadata: { invoice_id: 203 } },
  { id: 10, entry_date: '2025-08-03', source: 'invoice_recognition', source_id: '204', metadata: { invoice_id: 204 } },
  { id: 20, entry_date: '2025-08-03', source: 'invoice_settlement', source_id: '204', metadata: { invoice_id: 204 } },
  { id: 30, entry_date: '2025-08-15', source: 'vat_adjustment', source_id: 'CU-1', metadata: { vat201_field: '16' } },
];

export const FIXTURE_LINES: AssembleLine[] = [
  { journal_entry_id: 1, account_id: 5, debit: 0, credit: 1500 },
  { journal_entry_id: 11, account_id: 1, debit: 11500, credit: 0 },
  { journal_entry_id: 4, account_id: 5, debit: 0, credit: 3000 },
  { journal_entry_id: 14, account_id: 1, debit: 23000, credit: 0 },
  { journal_entry_id: 5, account_id: 5, debit: 0, credit: 300 },
  { journal_entry_id: 15, account_id: 1, debit: 1150, credit: 0 },
  { journal_entry_id: 6, account_id: 4, debit: 600, credit: 0 },
  { journal_entry_id: 7, account_id: 4, debit: 3000, credit: 0 },
  { journal_entry_id: 7, account_id: 8, debit: 20000, credit: 0 },
  { journal_entry_id: 17, account_id: 3, debit: 23000, credit: 0 },
  { journal_entry_id: 8, account_id: 4, debit: 150, credit: 0 },
  { journal_entry_id: 18, account_id: 3, debit: 1150, credit: 0 },
  { journal_entry_id: 9, account_id: 4, debit: 900, credit: 0 },
  { journal_entry_id: 19, account_id: 3, debit: 6900, credit: 0 },
  { journal_entry_id: 10, account_id: 4, debit: 6, credit: 0 },
  { journal_entry_id: 20, account_id: 1, debit: 0, credit: 46 },
  { journal_entry_id: 30, account_id: 4, debit: 75, credit: 0 },
  { journal_entry_id: 30, account_id: 10, debit: 0, credit: 75 },
];

function sumPeriod(from: string, to: string) {
  const live = new Set(
    FIXTURE_JOURNALS.filter((journal) => journal.entry_date >= from && journal.entry_date <= to).map(
      (journal) => journal.id
    )
  );
  const byAccount = new Map<number, { debit: number; credit: number }>();
  for (const line of FIXTURE_LINES) {
    if (!live.has(line.journal_entry_id)) continue;
    const current = byAccount.get(line.account_id) || { debit: 0, credit: 0 };
    current.debit += Number(line.debit || 0);
    current.credit += Number(line.credit || 0);
    byAccount.set(line.account_id, current);
  }
  return [...byAccount.entries()].map(([account_id, value]) => ({
    account_id,
    debit: value.debit,
    credit: value.credit,
  }));
}

export function buildFixtureReport(basis: VatBasis = 'payment', periodEnd = FIXTURE_PERIOD_END): Vat201Report {
  const settings = { ...FIXTURE_SETTINGS, basis };
  const period = vatPeriods(settings, FIXTURE_TODAY).find((item) => item.end === periodEnd);
  if (!period) throw new Error(`Fixture period ${periodEnd} is not on this category.`);
  const documents = assembleVatDocuments({
    company: {
      tradingName: 'Big Five Foods',
      vatNumber: settings.vatNumber,
      address: '1 Sample Road, Durban',
    },
    invoices: FIXTURE_INVOICES,
    journals: FIXTURE_JOURNALS,
    lines: FIXTURE_LINES,
    payments: [],
    accounts: FIXTURE_ACCOUNTS,
  });
  return buildVat201Pack({
    companyName: 'Big Five Foods',
    settings,
    period,
    documents,
    accounts: FIXTURE_ACCOUNTS,
    ledgerRows: sumPeriod(period.start, period.end),
    today: FIXTURE_TODAY,
    status: 'draft',
  });
}

export const FIXTURE_REPORT = buildFixtureReport('payment');
