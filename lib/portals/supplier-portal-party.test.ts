/**
 * Run: npx --yes tsx lib/portals/supplier-portal-party.test.ts
 */
import assert from 'node:assert/strict';
import {
  customerBookPartyGate,
  defaultCreateBookRole,
  filterCustomerDeskRows,
  filterSupplierDeskRows,
  inventoryLotPayloadFromBatch,
  mergePortalDocRows,
  messageMatchesPo,
  poBelongsToSupplierViewer,
  poHostedByBuyer,
  rowOnCustomerDesk,
  rowOnSupplierDesk,
  stripMissingMessageColumn,
  supplierBookPartyGate,
  supplierPortalPoPdfHref,
  tradePortalMessageInsertRow,
  validateLotDates,
  finishedGoodNeedsLot,
  fgLinesMissingLots,
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
assert.equal(
  customerBookPartyGate({ status: 'active', metadata: { party_book_role: 'supplier' } }).ok,
  false
);
assert.equal(
  customerBookPartyGate({ status: 'active', metadata: { party_book_role: 'customer' } }).ok,
  true
);
assert.equal(
  customerBookPartyGate({ status: 'active', metadata: {} }).ok,
  true,
  'legacy CRM row with no role is a customer'
);
assert.equal(
  rowOnSupplierDesk({ status: 'active', metadata: { party_book_role: 'customer' } }),
  false
);
assert.equal(
  rowOnCustomerDesk({ status: 'active', metadata: { party_book_role: 'supplier' } }),
  false
);
assert.equal(
  rowOnSupplierDesk({ status: 'active', metadata: { party_book_role: 'both' } }),
  true
);
assert.equal(
  rowOnCustomerDesk({ status: 'active', metadata: { party_book_role: 'both' } }),
  true
);
assert.equal(
  rowOnSupplierDesk({ status: 'active', metadata: {} }, { exists: true }),
  false,
  'unstamped twin is fail-closed on SRM desk'
);
assert.equal(
  rowOnCustomerDesk({ status: 'active', metadata: {} }, { exists: true }),
  false,
  'unstamped twin is fail-closed on CRM desk'
);
assert.equal(
  rowOnSupplierDesk(
    { status: 'active', metadata: { party_book_role: 'supplier' } },
    { exists: true, role: 'supplier' }
  ),
  true
);
assert.equal(
  rowOnCustomerDesk(
    { status: 'active', metadata: { party_book_role: 'customer' } },
    { exists: true, role: 'customer' }
  ),
  true
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
  poBelongsToSupplierViewer(
    { supplier_id: null, metadata: { srm_supplier_id: 12 } },
    { supplierId: 12, linkedProfileId: null }
  ),
  true,
  'book-only SRM PO matches metadata.srm_supplier_id'
);
assert.equal(
  poBelongsToSupplierViewer({ supplier_id: 1, supplier_profile_id: 2 }, viewer),
  false
);
assert.equal(
  poHostedByBuyer({ buyer_profile_id: 12 }, 12),
  true
);
assert.equal(
  poHostedByBuyer({ buyer_profile_id: null, profile_id: 12 }, 12),
  true,
  'null buyer_profile_id still matches host profile_id'
);
assert.equal(
  poHostedByBuyer({ buyer_profile_id: null, company_id: 12 }, 12),
  true
);
assert.equal(
  poHostedByBuyer({ buyer_profile_id: 99, profile_id: 12 }, 12),
  false
);

const livePos = [
  { id: 7, kind: 'purchase_order', number: 'PO-7' },
];
assert.equal(
  mergePortalDocRows([], livePos).length,
  1,
  'empty workspace must not hide live POs'
);
assert.equal(mergePortalDocRows(undefined, livePos)[0].id, 7);
assert.equal(
  mergePortalDocRows(
    [{ id: 7, kind: 'purchase_order' }],
    [{ id: 7, kind: 'purchase_order' }, { id: 8, kind: 'purchase_order' }]
  ).length,
  2
);

assert.equal(defaultCreateBookRole('supplier'), 'supplier');
assert.equal(defaultCreateBookRole('supplier', 'both'), 'both');
assert.equal(defaultCreateBookRole('customer'), 'customer');

const mixedCrm = [
  {
    trading_name: 'Kelpack',
    email: 'k@x.com',
    status: 'active',
    metadata: { party_book_role: 'customer' },
  },
  { trading_name: 'OnlyCust', status: 'active', metadata: {} },
];
const mixedSrm = [
  {
    trading_name: 'Kelpack',
    email: 'k@x.com',
    status: 'active',
    metadata: { party_book_role: 'customer' },
  },
  { trading_name: 'OnlySup', status: 'active', metadata: {} },
];
assert.equal(
  filterSupplierDeskRows(mixedSrm, mixedCrm).map((r) => r.trading_name).join(','),
  'OnlySup'
);
assert.equal(
  filterCustomerDeskRows(mixedCrm, mixedSrm).map((r) => r.trading_name).join(','),
  'Kelpack,OnlyCust'
);
const bothTwin = [
  {
    trading_name: 'TwinCo',
    email: 't@x.com',
    status: 'active',
    metadata: { party_book_role: 'both' },
  },
];
assert.equal(filterSupplierDeskRows(bothTwin, bothTwin).length, 1);
assert.equal(filterCustomerDeskRows(bothTwin, bothTwin).length, 1);
const unstampedTwin = [
  {
    trading_name: 'Acme',
    email: 'acme@x.com',
    status: 'active',
    metadata: {},
  },
];
assert.equal(
  filterSupplierDeskRows(unstampedTwin, unstampedTwin).length,
  0,
  'unstamped CRM↔SRM twin is on neither desk'
);
assert.equal(filterCustomerDeskRows(unstampedTwin, unstampedTwin).length, 0);
assert.match(
  supplierPortalPoPdfHref({ token: 'abc', poId: 9 }),
  /\/api\/public\/portals\/trade\/po-pdf\?token=abc&id=9/
);

assert.equal(validateLotDates('2026-01-10', '2026-01-09'), 'Expiry must be on or after the manufacture date');
assert.equal(validateLotDates('2026-01-10', '2026-06-01'), null);
assert.equal(finishedGoodNeedsLot('finished_good'), true);
assert.equal(finishedGoodNeedsLot('packaging'), false);
assert.equal(finishedGoodNeedsLot('raw_material'), false);
assert.equal(finishedGoodNeedsLot(''), true);
assert.deepEqual(
  fgLinesMissingLots({
    lines: [
      { product_type: 'finished_good', product_id: 2 },
      { product_type: 'finished_good', product_id: 3 },
    ],
    lots: [{ batch_number: 'LOT-CH-001', order_line_index: 0, product_id: 2 }],
  }),
  [1],
  'line 0 lot does not cover line 1'
);
assert.deepEqual(
  fgLinesMissingLots({
    lines: [{ product_type: 'packaging', product_id: 51 }],
    lots: [],
  }),
  []
);

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
