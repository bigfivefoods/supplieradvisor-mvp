/**
 * Run: npx --yes tsx lib/accounting/dedupe-invoice-books.test.ts
 */
import assert from 'node:assert/strict';
import {
  bankIncomeMatchesInvoice,
  extraCogsJournalIds,
  extraRecognitionJournalIds,
  isLivePosted,
  soleOpenInvoiceForBankLine,
} from './dedupe-invoice-books';

assert.equal(isLivePosted({ status: 'posted', metadata: {} }), true);
assert.equal(
  isLivePosted({ status: 'posted', metadata: { reversed_by_journal_id: 9 } }),
  false
);

assert.deepEqual(
  extraRecognitionJournalIds({
    invoices: [{ id: 2, metadata: { recognition_journal_id: 466 } }],
    journals: [
      { id: 465, source: 'invoice_recognition', source_id: '2', status: 'posted', metadata: { invoice_id: 2 } },
      { id: 466, source: 'invoice_recognition', source_id: '2', status: 'posted', metadata: { invoice_id: 2 } },
      { id: 496, source: 'reversal', source_id: '465', status: 'posted', metadata: { reverses_journal_id: 465 } },
    ],
  }),
  []
);

const extras = extraRecognitionJournalIds({
  invoices: [
    { id: 2, metadata: { recognition_journal_id: 466 } },
    { id: 3, metadata: { recognition_journal_id: 468 } },
  ],
  journals: [
    { id: 465, source: 'invoice_recognition', source_id: '2', status: 'posted', metadata: { invoice_id: 2 } },
    { id: 466, source: 'invoice_recognition', source_id: '2', status: 'posted', metadata: { invoice_id: 2 } },
    { id: 467, source: 'invoice_recognition', source_id: '3', status: 'posted', metadata: { invoice_id: 3 } },
    { id: 468, source: 'invoice_recognition', source_id: '3', status: 'posted', metadata: { invoice_id: 3 } },
    { id: 464, source: 'invoice_recognition', source_id: '1', status: 'posted', metadata: { invoice_id: 1 } },
  ],
});
assert.deepEqual(extras.sort((a, b) => a - b), [465, 467]);

const cogsExtras = extraCogsJournalIds({
  invoices: [{ id: 9, metadata: { cogs_journal_id: 729 } }],
  journals: [
    { id: 729, source: 'invoice_cogs', source_id: '9', status: 'posted', metadata: { invoice_id: 9 } },
    { id: 730, source: 'invoice_cogs', source_id: '9', status: 'posted', metadata: { invoice_id: 9 } },
  ],
});
assert.deepEqual(cogsExtras, [730]);

assert.equal(
  bankIncomeMatchesInvoice({
    memo: 'FNB APP PAYMENT FROM   INV-2026081',
    amount: 2127.5,
    date: '2026-08-18',
    invoice: { invoice_number: 'INV-20260817-HB0L', total_amount: 2127.5, issue_date: '2026-08-17' },
  }),
  true
);
assert.equal(
  bankIncomeMatchesInvoice({
    memo: 'FNB APP PAYMENT FROM  RESTORE AFRICA FOUND',
    amount: 6727.5,
    date: '2026-08-04',
    invoice: { invoice_number: 'INV-20260720-M7V6-R2', total_amount: 6727.5, issue_date: '2026-08-04' },
  }),
  true
);
assert.equal(
  bankIncomeMatchesInvoice({
    memo: 'Unrelated Magtape',
    amount: 100,
    date: '2026-08-04',
    invoice: { invoice_number: 'INV-20260720-M7V6-R2', total_amount: 6727.5, issue_date: '2026-08-04' },
  }),
  false
);

const palm = soleOpenInvoiceForBankLine({
  memo: 'PALM FOOTWEAR MANUFACTURERS PT',
  amount: 129375,
  invoices: [
    {
      id: 12,
      invoice_number: 'INV-20260828-Q4HD-R2',
      total_amount: 258750,
      amount_paid: 129375,
      status: 'partial',
      counterparty_name: 'Palm Footwear Manufacturers Pty Ltd',
    },
    {
      id: 16,
      invoice_number: 'INV-20260918-T991-R2',
      total_amount: 136102.5,
      amount_paid: 0,
      status: 'sent',
      counterparty_name: 'Palm Footwear Manufacturers Pty Ltd',
    },
  ],
});
assert.equal(palm?.id, 12);

const ambiguous = soleOpenInvoiceForBankLine({
  memo: 'FNB PAYMENT',
  amount: 100,
  invoices: [
    { id: 1, total_amount: 100, amount_paid: 0, status: 'sent', counterparty_name: 'Alpha' },
    { id: 2, total_amount: 100, amount_paid: 0, status: 'sent', counterparty_name: 'Beta' },
  ],
});
assert.equal(ambiguous, null);

const paidIgnored = soleOpenInvoiceForBankLine({
  memo: 'PALM FOOTWEAR',
  amount: 136102.5,
  invoices: [
    {
      id: 16,
      invoice_number: 'INV-20260918-T991-R2',
      total_amount: 136102.5,
      amount_paid: 136102.5,
      status: 'paid',
      counterparty_name: 'Palm Footwear',
    },
  ],
});
assert.equal(paidIgnored, null);

console.log('dedupe-invoice-books.test.ts ok');
