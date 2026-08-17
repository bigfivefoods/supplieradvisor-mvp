/**
 * Run: npx --yes tsx lib/accounting/crm-invoice-gl.test.ts
 */
import assert from 'node:assert/strict';
import {
  crmInvoiceIsIssued,
  crmInvoiceIsVoid,
  financeStatusFromCrm,
} from './crm-invoice-gl';

assert.equal(crmInvoiceIsIssued('sent'), true);
assert.equal(crmInvoiceIsIssued('issued'), true);
assert.equal(crmInvoiceIsIssued('viewed'), true);
assert.equal(crmInvoiceIsIssued('draft'), false);
assert.equal(crmInvoiceIsVoid('void'), true);
assert.equal(crmInvoiceIsVoid('cancelled'), true);
assert.equal(crmInvoiceIsVoid('sent'), false);

assert.equal(financeStatusFromCrm('sent'), 'sent');
assert.equal(financeStatusFromCrm('issued'), 'sent');
assert.equal(financeStatusFromCrm('viewed'), 'sent');
assert.equal(financeStatusFromCrm('unpaid'), 'sent');
assert.equal(financeStatusFromCrm('partial'), 'partial');
assert.equal(financeStatusFromCrm('paid'), 'paid');
assert.equal(financeStatusFromCrm('draft'), 'draft');
assert.equal(financeStatusFromCrm('void'), 'void');

console.log('crm-invoice-gl map ok');
