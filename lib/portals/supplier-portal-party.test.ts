/**
 * Run: npx --yes tsx lib/portals/supplier-portal-party.test.ts
 */
import assert from 'node:assert/strict';
import {
  inventoryLotPayloadFromBatch,
  messageMatchesPo,
  poBelongsToSupplierViewer,
  stripMissingMessageColumn,
  supplierBookPartyGate,
  tradePortalMessageInsertRow,
  validateLotDates,
} from './supplier-portal-party';

assert.equal(supplierBookPartyGate(null).ok, false);
assert.equal(
  supplierBookPartyGate({ status: 'active', metadata: { party_book_role: 'customer' } }).ok,
  false
);
assert.equal(
  supplierBookPartyGate({ status: 'blocked', metadata: { party_book_role: 'supplier' } }).ok,
  false
);
assert.equal(
  supplierBookPartyGate({ status: 'active', metadata: { party_book_role: 'supplier' } }).ok,
  true
);
assert.equal(
  supplierBookPartyGate({ status: 'active', metadata: { party_book_role: 'both' } }).ok,
  true
);
assert.equal(
  supplierBookPartyGate({ status: 'active', metadata: {} }).ok,
  true,
  'legacy SRM row with no role is a supplier'
);

const viewer = { supplierId: 44, linkedProfileId: 900 };
assert.equal(
  poBelongsToSupplierViewer({ supplier_id: 44, supplier_profile_id: 1 }, viewer),
  true
);
assert.equal(
  poBelongsToSupplierViewer(
    { supplier_id: 900, supplier_profile_id: 2 },
    viewer
  ),
  true,
  'supplier_id stored as profile id still matches'
);
assert.equal(
  poBelongsToSupplierViewer(
    { supplier_id: 7, supplier_profile_id: 900 },
    viewer
  ),
  true
);
assert.equal(
  poBelongsToSupplierViewer(
    { supplier_id: 7, metadata: { srm_supplier_id: 44 } },
    viewer
  ),
  true
);
assert.equal(
  poBelongsToSupplierViewer({ supplier_id: 1, supplier_profile_id: 2 }, viewer),
  false
);

assert.equal(validateLotDates('2026-01-10', '2026-01-09'), 'Expiry must be on or after the manufacture date');
assert.equal(validateLotDates('2026-01-10', '2026-06-01'), null);

const lot = inventoryLotPayloadFromBatch({
  companyId: 1,
  productId: 9,
  batchNumber: 'LOT-1',
  qty: 10,
  manufacturedDate: '2026-01-10',
  expiryDate: '2026-06-01',
  supplierRef: 'PO-41',
});
assert.equal(lot.lot_number, 'LOT-1');
assert.equal(lot.manufactured_date, '2026-01-10');
assert.equal(lot.expiry_date, '2026-06-01');
assert.equal(lot.supplier_ref, 'PO-41');

const msg = tradePortalMessageInsertRow({
  portalId: 1,
  viewerId: 2,
  profileId: 3,
  author: 'guest',
  body: 'hello',
  purchaseOrderId: 88,
});
assert.equal(msg.purchase_order_id, 88);
assert.deepEqual(msg.metadata, { po_id: 88 });
const stripped = stripMissingMessageColumn(msg, 'purchase_order_id');
assert.equal('purchase_order_id' in stripped, false);
assert.ok(messageMatchesPo({ metadata: { po_id: 88 } }, 88));
assert.ok(messageMatchesPo({ purchase_order_id: 88 }, 88));
assert.equal(messageMatchesPo({ purchase_order_id: 1 }, 88), false);

console.log('supplier-portal-party Brief 17 tests ok');
