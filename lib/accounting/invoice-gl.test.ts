/**
 * Run: npx --yes tsx lib/accounting/invoice-gl.test.ts
 */
import assert from 'node:assert/strict';
import {
  invoiceKeepsBankAllocation,
  invoiceLinkedPurchaseOrderId,
  invoiceSkipsSettlement,
  isIssuedInvoiceStatus,
  isPoApAlreadyAllocated,
  mapApCostCategoryToCode,
} from './invoice-gl';

assert.equal(isIssuedInvoiceStatus('paid'), true);
assert.equal(isIssuedInvoiceStatus('void'), false);
assert.equal(invoiceKeepsBankAllocation({ skip_recognition: true }), true);
assert.equal(invoiceKeepsBankAllocation({ books_keep_bank_allocation: true }), true);
assert.equal(invoiceKeepsBankAllocation({ cash_allocated_journal_id: 719 }), false);
assert.equal(invoiceKeepsBankAllocation({ recognition_journal_id: 716 }), false);
assert.equal(invoiceSkipsSettlement({ cash_allocated_journal_id: 719 }), true);
assert.equal(invoiceSkipsSettlement({ skip_settlement: true }), true);
assert.equal(invoiceSkipsSettlement({ recognition_journal_id: 716 }), false);

assert.equal(mapApCostCategoryToCode('materials'), '1140');
assert.equal(mapApCostCategoryToCode('inventory'), '1140');
assert.equal(mapApCostCategoryToCode('cogs'), '5100');
assert.equal(mapApCostCategoryToCode('ppe'), '1210');
assert.equal(mapApCostCategoryToCode(null), '1140');
assert.equal(mapApCostCategoryToCode('rent'), '');

assert.equal(
  invoiceLinkedPurchaseOrderId({ metadata: { purchase_order_id: 44 } }),
  44
);
assert.equal(invoiceLinkedPurchaseOrderId({ source_po_id: 9 }), 9);

assert.equal(
  isPoApAlreadyAllocated({ cost_journal_entry_id: 88 }).allocated,
  true
);
assert.equal(isPoApAlreadyAllocated({ cost_journal_entry_id: 88 }).journalId, 88);
assert.equal(isPoApAlreadyAllocated({}).allocated, false);
assert.equal(
  isPoApAlreadyAllocated({
    metadata: { ap_allocated_journal_id: 12 },
  }).journalId,
  12
);
assert.equal(
  isPoApAlreadyAllocated({
    metadata: { inventory_journal_id: 901 },
  }).journalId,
  901
);

console.log('invoice-gl skip flags ok');
