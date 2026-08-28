/**
 * Run: npx --yes tsx lib/accounting/po-accept-books.test.ts
 */
import assert from 'node:assert/strict';
import {
  cogsAmountForAcceptedPo,
  overlappingPoCost,
  poAcceptsInventoryBooks,
  poInventoryAmount,
  poInventoryJournalLines,
  poRelatedInvoiceRefs,
  poStatusPostsAcceptBooks,
  parsePoCostLines,
} from './po-accept-books';
import { isPoApAlreadyAllocated } from './invoice-gl';
import { isCogsManuallyReversed } from './inventory-cogs';

const kelpackPo = {
  id: 88,
  status: 'accepted',
  supplier_name: 'Kelpack Manufacturing',
  total_amount: 130000,
  items: [
    {
      product_id: 11,
      sku: 'SLEEVE',
      item_name: 'Sleeve',
      quantity: 1000,
      unit_price: 80,
    },
    {
      product_id: 12,
      sku: 'TRAY',
      item_name: 'Tray',
      quantity: 500,
      unit_price: 100,
    },
  ],
};

assert.equal(poInventoryAmount(kelpackPo), 130000);
assert.equal(parsePoCostLines(kelpackPo.items).length, 2);
assert.equal(poStatusPostsAcceptBooks('accepted'), true);
assert.equal(poStatusPostsAcceptBooks('sent'), false);
assert.equal(poStatusPostsAcceptBooks('draft'), false);
assert.equal(poAcceptsInventoryBooks(kelpackPo), true);
assert.equal(
  poAcceptsInventoryBooks({ ...kelpackPo, order_kind: 'hub' }),
  false
);
assert.equal(
  poAcceptsInventoryBooks({ ...kelpackPo, status: 'cancelled' }),
  false
);

assert.deepEqual(
  poRelatedInvoiceRefs({
    metadata: { related_invoice_number: 'INV-20260828-Q4HD-R2' },
  }),
  { invoiceId: null, invoiceNumber: 'INV-20260828-Q4HD-R2' }
);
assert.equal(
  poRelatedInvoiceRefs({ metadata: { related_invoice_id: 44 } }).invoiceId,
  44
);

assert.equal(
  overlappingPoCost(parsePoCostLines(kelpackPo.items), [
    { product_id: 11, sku: 'SLEEVE', quantity: 1000, unit_price: 200 },
  ]),
  80000
);
assert.equal(
  overlappingPoCost(parsePoCostLines(kelpackPo.items), [
    { product_id: 99, sku: 'OTHER', quantity: 1, unit_price: 10 },
  ]),
  0
);

assert.equal(
  cogsAmountForAcceptedPo({
    poAmount: 130000,
    explicitlyLinked: true,
    overlappingLineAmount: 80000,
  }),
  130000
);
assert.equal(
  cogsAmountForAcceptedPo({
    poAmount: 130000,
    explicitlyLinked: false,
    overlappingLineAmount: 80000,
  }),
  80000
);
assert.equal(
  cogsAmountForAcceptedPo({
    poAmount: 130000,
    explicitlyLinked: false,
    overlappingLineAmount: 0,
  }),
  0
);
assert.equal(
  cogsAmountForAcceptedPo({
    poAmount: 130000,
    explicitlyLinked: true,
    overlappingLineAmount: 0,
  }),
  130000
);

const je = poInventoryJournalLines({
  inventoryAccountId: 1140,
  apAccountId: 2188,
  amount: 130000,
  memo: 'PO #88 inventory · Kelpack',
  counterparty: 'Kelpack Manufacturing',
  purchaseOrderId: 88,
});
assert.equal(je[0].accountId, 1140);
assert.equal(je[0].debit, 130000);
assert.equal(je[1].accountId, 2188);
assert.equal(je[1].credit, 130000);
assert.notEqual(je[0].accountId, 5100);

assert.equal(
  isPoApAlreadyAllocated({
    metadata: { inventory_journal_id: 901, ap_allocated_journal_id: 901 },
  }).allocated,
  true
);

// Manual reverse still blocks catalogue re-post; PO path is a new 130k journal
assert.equal(
  isCogsManuallyReversed({
    cogs_voided: true,
    cogs_skipped: 'manual_reverse',
  }),
  true
);

console.log('po-accept-books IAS 2 tests ok');
