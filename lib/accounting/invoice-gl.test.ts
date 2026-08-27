/**
 * Run: npx --yes tsx lib/accounting/invoice-gl.test.ts
 */
import assert from 'node:assert/strict';
import { invoiceKeepsBankAllocation, isIssuedInvoiceStatus } from './invoice-gl';

assert.equal(isIssuedInvoiceStatus('paid'), true);
assert.equal(isIssuedInvoiceStatus('void'), false);
assert.equal(invoiceKeepsBankAllocation({ skip_recognition: true }), true);
assert.equal(invoiceKeepsBankAllocation({ books_keep_bank_allocation: true }), true);
assert.equal(invoiceKeepsBankAllocation({ cash_allocated_journal_id: 719 }), true);
assert.equal(invoiceKeepsBankAllocation({ recognition_journal_id: 716 }), false);

console.log('invoice-gl skip flags ok');
