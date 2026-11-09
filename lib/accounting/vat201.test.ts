/**
 * Run: npx --yes tsx lib/accounting/vat201.test.ts
 *
 * In-memory books only. Service-role credentials are removed so this file
 * cannot open the production database.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signedStatementAmount } from './statement-figures';
import { loadPostedLedger, totalsFromLedger } from './posted-ledger';
import { ledgerControlRows } from './vat201-load';
import {
  allocateDocument,
  buildVat201Pack,
  buildVatSettlementLines,
  fieldByCode,
  isBusinessDay,
  signedControlMovement,
  vatDueDate,
  vatPeriods,
  type VatDocument,
  type TaxInvoiceFacts,
} from './vat201-model';
import { VAT201_ISV_SUBMIT_ENABLED, vat201IsvSubmit } from './vat201-isv';
import {
  FIXTURE_ACCOUNTS,
  FIXTURE_JOURNALS,
  FIXTURE_LINES,
  FIXTURE_PERIOD_END,
  FIXTURE_SETTINGS,
  FIXTURE_TODAY,
  buildFixtureReport,
} from './vat201-fixture';

delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;

const facts = (over: Partial<TaxInvoiceFacts> = {}): TaxInvoiceFacts => ({
  labelled: true,
  supplierName: true,
  supplierAddress: true,
  supplierVat: true,
  recipientName: true,
  recipientAddress: true,
  recipientVat: true,
  serial: true,
  date: true,
  description: true,
  quantity: true,
  consideration: true,
  vatShown: true,
  customsCode: true,
  ...over,
});

function doc(partial: Partial<VatDocument> & Pick<VatDocument, 'id' | 'side' | 'documentDate' | 'vat'>): VatDocument {
  const vat = partial.vat;
  const exclusive = partial.exclusive ?? Math.round((Math.abs(vat) / 0.15) * 100) / 100;
  const inclusive = partial.inclusive ?? Math.round((exclusive + vat) * 100) / 100;
  return {
    reference: partial.id,
    counterparty: 'Sample',
    exclusive,
    inclusive,
    kind: 'standard',
    cash: [],
    facts: facts(),
    ...partial,
  };
}

const settings = { ...FIXTURE_SETTINGS };
const periods = vatPeriods(settings, FIXTURE_TODAY);
const june = periods.find((period) => period.end === '2025-06-30');
const august = periods.find((period) => period.end === '2025-08-31');
assert.ok(june && august, 'Category B periods exist');
assert.equal(august?.start, '2025-07-01');
assert.equal(june?.start, '2025-05-29');

const unpaid = doc({
  id: 'unpaid-bill',
  side: 'input',
  documentDate: '2025-07-05',
  exclusive: 1000,
  vat: 150,
  inclusive: 1150,
  cash: [],
});
const laterPaid = doc({
  id: 'later-paid',
  side: 'output',
  documentDate: '2025-06-20',
  exclusive: 1000,
  vat: 150,
  inclusive: 1150,
  cash: [{ date: '2025-08-02', amount: 1150 }],
});

function vatIn(basis: 'payment' | 'invoice' | 'hybrid', periodEnd: string, documents: VatDocument[], side: 'input' | 'output') {
  const period = periods.find((item) => item.end === periodEnd)!;
  const report = buildVat201Pack({
    companyName: 'Sample',
    settings: { ...settings, basis },
    period,
    documents,
    accounts: FIXTURE_ACCOUNTS,
    ledgerRows: [],
    today: FIXTURE_TODAY,
  });
  const code = side === 'output' ? '13' : '19';
  return fieldByCode(report, code)?.value || 0;
}

assert.equal(vatIn('payment', '2025-08-31', [unpaid], 'input'), 0, 'unpaid input VAT excluded on payment basis');
assert.equal(vatIn('invoice', '2025-08-31', [unpaid], 'input'), 150, 'unpaid input VAT included on invoice basis');
assert.equal(vatIn('hybrid', '2025-08-31', [unpaid], 'input'), 0, 'hybrid input VAT follows cash');
assert.equal(vatIn('payment', '2025-06-30', [laterPaid], 'output'), 0);
assert.equal(vatIn('payment', '2025-08-31', [laterPaid], 'output'), 150, 'cash in a later period');
assert.equal(vatIn('invoice', '2025-06-30', [laterPaid], 'output'), 150);
assert.equal(vatIn('invoice', '2025-08-31', [laterPaid], 'output'), 0);
assert.equal(vatIn('hybrid', '2025-06-30', [laterPaid], 'output'), 150, 'hybrid output follows the invoice');

const slices = allocateDocument(
  doc({
    id: 'split',
    side: 'output',
    documentDate: '2025-07-01',
    exclusive: 2000,
    vat: 300,
    inclusive: 2300,
    cash: [
      { date: '2025-07-20', amount: 1150 },
      { date: '2025-09-02', amount: 1150 },
    ],
  }),
  'payment'
);
assert.equal(slices.length, 2);
assert.equal(slices[0].vat, 150);
assert.equal(slices[1].vat, 150);
assert.equal(slices[1].date, '2025-09-02');

const payment = buildFixtureReport('payment');
assert.equal(fieldByCode(payment, '1')?.value, 12650);
assert.equal(fieldByCode(payment, '1A')?.value, 23000);
assert.equal(fieldByCode(payment, '2')?.value, 0);
assert.equal(fieldByCode(payment, '2A')?.value, 8000);
assert.equal(fieldByCode(payment, '3')?.value, 2000);
assert.equal(fieldByCode(payment, '4')?.value, 1650);
assert.equal(fieldByCode(payment, '4A')?.value, 3000);
assert.equal(fieldByCode(payment, '13')?.value, 4650);
assert.equal(fieldByCode(payment, '14')?.value, 3000);
assert.equal(fieldByCode(payment, '15')?.value, 6);
assert.equal(fieldByCode(payment, '16')?.value, 75);
assert.equal(fieldByCode(payment, '17')?.value, 0);
assert.equal(fieldByCode(payment, '19')?.value, 3081);
assert.equal(fieldByCode(payment, '20')?.value, 1569);
assert.equal(fieldByCode(payment, '38')?.value, 1569);
assert.ok(payment.outputListing.some((row) => row.reference === 'INV-1001' && row.cashDate === '2025-07-15'));
assert.ok(payment.inputListing.some((row) => row.reference === 'BILL-200' && row.claimed === false));
assert.ok(payment.missingTaxInvoices.some((row) => row.reference === 'BILL-202' && row.blocksInputClaim));
assert.ok(payment.missingTaxInvoices.some((row) => row.reference === 'BILL-203' && row.threshold === 'full'));
assert.equal(payment.missingTaxInvoices.some((row) => row.reference === 'SLIP-204'), false);

const outputLine = payment.reconciliation.find((line) => line.code === '2120');
const inputLine = payment.reconciliation.find((line) => line.code === '1150');
assert.ok(outputLine && inputLine);
assert.equal(outputLine?.ledgerMovement, 3300);
assert.equal(outputLine?.difference, 1350);
assert.equal(outputLine?.flagged, true);
assert.equal(inputLine?.ledgerMovement, 1731);
assert.equal(inputLine?.difference, 1350);
assert.equal(inputLine?.flagged, true);
assert.equal(payment.reconFlagged, true);
const accrued = payment.reconciliation.find((line) => line.code === '2130');
const deposits = payment.reconciliation.find((line) => line.code === '2140');
assert.equal(accrued?.includedInControl, false);
assert.match(accrued?.note || '', /Accrued expenses/);
assert.equal(deposits?.includedInControl, false);
assert.match(deposits?.note || '', /Customer deposits/);

const control = ledgerControlRows({
  journals: FIXTURE_JOURNALS,
  lines: FIXTURE_LINES,
  accounts: FIXTURE_ACCOUNTS,
  from: '2025-07-01',
  to: '2025-08-31',
});
const outputAccount = FIXTURE_ACCOUNTS.find((account) => account.code === '2120')!;
const outputRow = control.find((row) => row.account_id === outputAccount.id)!;
assert.equal(
  outputRow.signed,
  signedStatementAmount('liability', outputRow.debit, outputRow.credit)
);
assert.equal(outputRow.signed, signedControlMovement('liability', outputRow.debit, outputRow.credit));
assert.equal(outputRow.signed, 3300);

const totals = totalsFromLedger({
  journals: FIXTURE_JOURNALS,
  lines: FIXTURE_LINES,
  from: '2025-07-01',
  to: '2025-08-31',
});
assert.equal(totals.rows.find((row) => row.account_id === 4)?.debit, 1731);

const settlement = buildVatSettlementLines({ outputTax: 4650, inputTax: 3081 });
assert.equal(settlement.ok, true);
if (settlement.ok) {
  const debit = settlement.lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = settlement.lines.reduce((sum, line) => sum + line.credit, 0);
  assert.equal(debit, credit);
  assert.equal(settlement.lines.find((line) => line.accountCode === '2120')?.debit, 4650);
  assert.equal(settlement.lines.find((line) => line.accountCode === '1150')?.credit, 3081);
  assert.equal(settlement.lines.find((line) => line.accountCode === '1110')?.credit, 1569);
  const clearing = settlement.lines.filter((line) => line.accountCode === '2125');
  const clearingNet =
    clearing.reduce((sum, line) => sum + line.debit, 0) -
    clearing.reduce((sum, line) => sum + line.credit, 0);
  assert.equal(Math.round(clearingNet * 100) / 100, 0);
}

assert.equal(vatDueDate('2025-08-31', 'efiling'), '2025-09-30');
assert.equal(vatDueDate('2026-01-31', 'efiling'), '2026-02-27');
assert.equal(vatDueDate('2025-11-30', 'manual'), '2025-12-24');
assert.equal(isBusinessDay('2025-12-25'), false);
assert.equal(fieldByCode(payment, '1')?.copy, '12650.00');
assert.equal(payment.fields.map((field) => field.code).join(','), [
  '1','1A','2','2A','3','4','4A','5','6','7','8','9','10','11','12','13',
  '14','14A','15','15A','16','17','18','19','20',
  '21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38',
].join(','));

assert.equal(VAT201_ISV_SUBMIT_ENABLED, false);
const isv = vat201IsvSubmit();
assert.equal(isv.ok, false);
assert.equal(isv.calledSars, false);
assert.ok(isv.requirements.some((item) => /clsisvapplications@sars.gov.za/.test(item.detail)));
const isvSource = readFileSync(join(process.cwd(), 'lib/accounting/vat201-isv.ts'), 'utf8');
assert.doesNotMatch(isvSource, /fetch\(|axios|https\.request/);

type Row = Record<string, unknown>;
function memoryClient(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      let rows = (tables[table] || []).map((row) => ({ ...row }));
      const orders: Array<{ col: string; asc: boolean }> = [];
      let rangeFrom = 0;
      let rangeTo = 10_000;
      const query = {
        select() {
          return query;
        },
        eq(col: string, value: unknown) {
          rows = rows.filter((row) => String(row[col]) === String(value));
          return query;
        },
        gte(col: string, value: unknown) {
          rows = rows.filter((row) => String(row[col]) >= String(value));
          return query;
        },
        lte(col: string, value: unknown) {
          rows = rows.filter((row) => String(row[col]) <= String(value));
          return query;
        },
        in(col: string, values: unknown[]) {
          const allowed = new Set(values.map(String));
          rows = rows.filter((row) => allowed.has(String(row[col])));
          return query;
        },
        order(col: string, opts?: { ascending?: boolean }) {
          orders.push({ col, asc: opts?.ascending !== false });
          return query;
        },
        range(from: number, to: number) {
          rangeFrom = from;
          rangeTo = to;
          return query;
        },
        then(onFulfilled?: (value: { data: Row[]; error: null }) => unknown) {
          return Promise.resolve(query.exec()).then(onFulfilled);
        },
        exec() {
          const sorted = [...rows].sort((left, right) => {
            for (const order of orders) {
              const cmp = String(left[order.col]).localeCompare(String(right[order.col]), undefined, {
                numeric: true,
              });
              if (cmp !== 0) return order.asc ? cmp : -cmp;
            }
            return 0;
          });
          return { data: sorted.slice(rangeFrom, rangeTo + 1), error: null as null };
        },
      };
      return query;
    },
  };
}

const invoiceBasis = buildFixtureReport('invoice');
assert.equal(fieldByCode(invoiceBasis, '14')?.value, 0);
assert.equal(fieldByCode(invoiceBasis, '15')?.value, 606);
assert.equal(fieldByCode(invoiceBasis, '1')?.value, 2300);

void loadPostedLedger({
  profileId: 102,
  from: '2025-07-01',
  to: '2025-08-31',
  journalColumns: 'detail',
  lineColumns: 'detail',
  client: memoryClient({
    journal_entries: FIXTURE_JOURNALS.map((journal) => ({
      ...journal,
      profile_id: 102,
      status: 'posted',
    })),
    journal_lines: FIXTURE_LINES,
  }),
}).then((loaded) => {
  assert.ok(loaded.journals.some((journal) => journal.id === 6));
  assert.equal(loaded.journals.some((journal) => journal.id === 1), false);
  assert.ok(loaded.lines.some((line) => line.journal_entry_id === 6 && line.debit === 600));
  console.log('vat201 tests ok');
});
