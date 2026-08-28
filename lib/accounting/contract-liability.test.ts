/**
 * Run: npx --yes tsx lib/accounting/contract-liability.test.ts
 *
 * Brief 5 journals A–E (pure helpers — no live DB).
 */
import assert from 'node:assert/strict';
import {
  amountPaidAfterDepositApply,
  arRevenueCodeForInvoice,
  bankInflowCreditTarget,
  depositApplicationLines,
  depositApplyAmount,
  isReceivableGlAccount,
  isRevenueGlAccount,
  openDepositFromBuckets,
  paymentAlreadyDeposited,
  prepaidReceiptLines,
  voidInvoiceJournalIds,
} from './contract-liability';

const BANK = 1110;
const AR = 1130;
const DEPOSIT = 2140;
const SALES = 4100;
const MEMBERSHIP = 4400;

// A. Cash, no issued invoice → Cr 2140, not 4100
const a = prepaidReceiptLines({ bankId: BANK, depositId: DEPOSIT, amount: 500 });
assert.equal(a.length, 2);
assert.equal(a[0].accountId, BANK);
assert.equal(a[0].debit, 500);
assert.equal(a[1].accountId, DEPOSIT);
assert.equal(a[1].credit, 500);
assert.ok(!a.some((l) => l.accountId === SALES || l.accountId === MEMBERSHIP));

assert.equal(
  bankInflowCreditTarget({
    hasIssuedInvoice: false,
    gl: { code: '1130', accountType: 'asset', subtype: 'receivable' },
  }),
  'deposit'
);
assert.equal(
  bankInflowCreditTarget({
    hasIssuedInvoice: false,
    gl: { code: '1180-0000001', accountType: 'asset', subtype: 'receivable' },
  }),
  'deposit'
);
assert.equal(
  bankInflowCreditTarget({
    hasIssuedInvoice: false,
    gl: { code: '4100', accountType: 'revenue', subtype: 'sales' },
  }),
  'cash_sales'
);

// B+C. Issue after deposit → revenue once; AR net of deposit
assert.equal(depositApplyAmount(500, 800), 500);
assert.equal(depositApplyAmount(900, 800), 800);
assert.equal(depositApplyAmount(0, 800), 0);
const apply = depositApplicationLines({
  depositId: DEPOSIT,
  arId: AR,
  amount: 500,
});
assert.equal(apply[0].accountId, DEPOSIT);
assert.equal(apply[0].debit, 500);
assert.equal(apply[1].accountId, AR);
assert.equal(apply[1].credit, 500);

const paid = amountPaidAfterDepositApply(500, 500);
assert.equal(paid, 500);
assert.equal(amountPaidAfterDepositApply(0, 500), 500);
assert.equal(amountPaidAfterDepositApply(200, 500), 500);
const invoiceTotal = 800;
const openAr = round2(invoiceTotal - depositApplyAmount(500, invoiceTotal));
assert.equal(openAr, 300);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// D. Bank allocation matched to issued invoice → no second 4100
assert.equal(
  bankInflowCreditTarget({
    hasIssuedInvoice: true,
    gl: { code: '4100', accountType: 'revenue', subtype: 'sales' },
  }),
  'ar_settle'
);
assert.equal(
  bankInflowCreditTarget({
    hasIssuedInvoice: true,
    gl: { code: '4400', accountType: 'revenue', subtype: 'service' },
  }),
  'ar_settle'
);
assert.equal(
  bankInflowCreditTarget({
    hasIssuedInvoice: true,
    gl: { code: '2140', accountType: 'liability', subtype: 'current' },
  }),
  'ar_settle'
);

assert.equal(isRevenueGlAccount({ code: '4100', accountType: 'revenue' }), true);
assert.equal(isRevenueGlAccount({ code: '4400', accountType: 'revenue' }), true);
assert.equal(
  isRevenueGlAccount({ code: '4400-0000001', accountType: 'asset' }),
  false
);
assert.equal(
  isReceivableGlAccount({
    code: '1180-0000001',
    accountType: 'asset',
    subtype: 'receivable',
  }),
  true
);

// E. Void reverses 2140 application (not the original deposit cash)
const voidIds = voidInvoiceJournalIds({
  recognitionJournalId: 10,
  settlementJournalIds: [{ payment_id: 1, journal_id: 11 }],
  depositApplicationJournalId: 12,
});
assert.deepEqual(voidIds.sort((a, b) => a - b), [10, 11, 12]);
assert.ok(voidIds.includes(12));

assert.equal(
  paymentAlreadyDeposited(
    { deposit_journal_ids: [{ payment_id: 9, journal_id: 70 }] },
    9
  ),
  true
);
assert.equal(paymentAlreadyDeposited({ deposit_journal_ids: [] }, 9), false);

// Membership prepaid → 2140 then 4400, not 4100
assert.equal(
  arRevenueCodeForInvoice({ metadata: { advisor_fee: true } }),
  '4400'
);
assert.equal(
  arRevenueCodeForInvoice({ metadata: { membership: true } }),
  '4400'
);
assert.equal(
  arRevenueCodeForInvoice({
    items: [{ account_code: '4400', amount: 200 }],
  }),
  '4400'
);
assert.equal(arRevenueCodeForInvoice({ metadata: {} }), '4100');

const membershipDeposit = prepaidReceiptLines({
  bankId: BANK,
  depositId: DEPOSIT,
  amount: 200,
});
assert.ok(!membershipDeposit.some((l) => l.accountId === SALES));
assert.ok(!membershipDeposit.some((l) => l.accountId === MEMBERSHIP));
assert.equal(
  arRevenueCodeForInvoice({ metadata: { advisor_fee: true } }) === '4400' &&
    depositApplyAmount(200, 200) === 200,
  true
);

// Open 2140: invoice-specific plus same-customer unallocated; skip other invoices
const open = openDepositFromBuckets({
  customerId: 5,
  invoiceId: 20,
  buckets: [
    { journalId: 1, amount: 100, invoiceId: 20, customerId: 5 },
    { journalId: 2, amount: 50, invoiceId: null, customerId: 5 },
    { journalId: 3, amount: 999, invoiceId: 99, customerId: 5 },
    { journalId: 4, amount: 40, invoiceId: null, customerId: 8 },
    { journalId: 5, amount: -100, invoiceId: 20, customerId: 5 },
  ],
});
assert.equal(open, 50);

console.log('contract-liability IFRS 15 journals A–E ok');
