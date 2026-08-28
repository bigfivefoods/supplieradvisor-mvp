/**
 * Run: npx --yes tsx lib/procurement/po-email.test.ts
 */
import assert from 'node:assert/strict';
import {
  formatPurchaseOrderNumber,
  isEmailAddress,
  normalizeEmail,
  purchaseOrderCcList,
  purchaseOrderEmailHtml,
  purchaseOrderEmailSubject,
  purchaseOrderPdfFilename,
  srmIdFromPo,
} from './po-email';

assert.equal(isEmailAddress('craig@bigfivefoods.com'), true);
assert.equal(isEmailAddress('not-an-email'), false);
assert.equal(normalizeEmail('  Craig@BigFiveFoods.com '), 'craig@bigfivefoods.com');

assert.equal(formatPurchaseOrderNumber({ id: 12, po_number: 'PO-0041' }), 'PO-0041');
assert.equal(formatPurchaseOrderNumber({ id: 9 }), 'PO-9');

assert.equal(
  purchaseOrderEmailSubject({
    number: 'PO-12',
    buyerName: 'Big Five Foods',
  }),
  'Purchase order PO-12 from Big Five Foods'
);
assert.match(
  purchaseOrderEmailSubject({
    number: 'PO-12',
    buyerName: 'Big Five Foods',
    resend: true,
  }),
  /^Reminder: Purchase order/
);

assert.deepEqual(
  purchaseOrderCcList({
    to: 'kelpack@example.com',
    senderEmail: 'craig@bigfivefoods.com',
  }),
  ['craig@bigfivefoods.com']
);
assert.deepEqual(
  purchaseOrderCcList({
    to: 'craig@bigfivefoods.com',
    senderEmail: 'craig@bigfivefoods.com',
  }),
  []
);
assert.deepEqual(
  purchaseOrderCcList({
    to: 'kelpack@example.com',
    ccMe: false,
    senderEmail: 'craig@bigfivefoods.com',
  }),
  []
);

assert.equal(srmIdFromPo({ metadata: { srm_supplier_id: 44 } }), 44);
assert.equal(srmIdFromPo({ supplier_id: 8 }), 8);

const html = purchaseOrderEmailHtml({
  supplierName: 'Kelpack Manufacturing',
  contactName: 'Thandi',
  buyerName: 'Big Five Foods',
  number: 'PO-12',
  totalLabel: 'ZAR 1,200.00',
  promisedDate: '2026-09-01',
  senderCopied: true,
});
assert.match(html, /purchase order PO-12/);
assert.match(html, /not an invoice/i);
assert.doesNotMatch(html, /tax invoice/i);
assert.match(html, /copied/);
assert.equal(purchaseOrderPdfFilename('PO 12 / A'), 'PO-12-A.pdf');

console.log('po-email.test.ts ok');
