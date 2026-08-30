/**
 * Run: npx --yes tsx lib/portals/brief24-fulfilment.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  fgLinesMissingLots,
  finishedGoodNeedsLot,
} from './supplier-portal-party';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

assert.equal(finishedGoodNeedsLot('finished_good'), true);
assert.equal(finishedGoodNeedsLot('packaging'), false);
assert.deepEqual(
  fgLinesMissingLots({
    lines: [
      { product_type: 'finished_good', product_id: 2 },
      { product_type: 'finished_good', product_id: 7 },
    ],
    lots: [{ batch_number: 'LOT-A', order_line_index: 0, product_id: 2 }],
  }),
  [1]
);

const guest = src('components/portals/GuestTradeWorkspace.tsx');
assert.match(guest, /Confirmed delivery date/);
assert.match(guest, /Requested delivery/);
assert.match(guest, /Save lots/);
assert.match(guest, /Dispatch \/ actual delivery date/);
assert.match(guest, /Qty this lot/);
assert.match(guest, /order_line_index: i/);
assert.match(guest, /finishedGoodNeedsLot/);
assert.match(guest, /inventoryReceived: Boolean\(order\.inventoryReceived\)/);
assert.doesNotMatch(guest, /window\.prompt/);
assert.doesNotMatch(guest, /sell_price/);

const act = src('app/api/public/portals/trade/act/route.ts');
assert.match(act, /requested_promised_date/);
assert.match(act, /Pick the actual delivery date/);
assert.match(act, /actual_delivery_date = shipDay/);
assert.match(act, /Finished goods need a lot number on the PO before/);
assert.match(act, /order_lots/);
assert.doesNotMatch(
  act,
  /patch\.actual_delivery_date = isoDay\(new Date\(\)\)/
);
assert.doesNotMatch(act, /from\('profiles'\)[\s\S]{0,200}\bphone\b/);
assert.doesNotMatch(act, /supplier_id:\s*12/);

const recv = src('lib/procurement/receive-from-po.ts');
assert.match(recv, /Finished goods need a lot number on the PO before receive/);
assert.match(recv, /finishedGoodNeedsLot/);
assert.match(recv, /batchLineIndex/);
assert.match(recv, /lotNumber: String\(lot\.batch_number/);
assert.match(recv, /copyPoLotsToInventory/);
assert.doesNotMatch(recv, /from\('profiles'\)[\s\S]{0,200}\bphone\b/);

const pdf = src('lib/procurement/po-document-pdf.ts');
assert.match(pdf, /Confirmed:/);
assert.match(pdf, /Traceability/);
assert.match(pdf, /manufactured/);
assert.match(pdf, /expiry/);
assert.doesNotMatch(pdf, /sell_price/);

const parties = src('lib/procurement/po-parties.ts');
assert.match(parties, /loadPoLotsForPdf/);
assert.match(parties, /order_batches/);
assert.match(parties, /requested_promised_date/);
assert.match(parties, /actual_delivery_date/);
assert.doesNotMatch(parties, /from\('profiles'\)[\s\S]{0,200}\bphone\b/);

const desk = src('app/dashboard/suppliers/po/PoDesk.tsx');
assert.match(desk, /poDeliveryLabel/);
assert.match(desk, /poDisplayLots/);
assert.match(desk, /order_lots/);
assert.match(desk, /confirmed /);

const portalPdf = src('app/api/public/portals/trade/po-pdf/route.ts');
assert.match(portalPdf, /no-store/);

const ws = src('lib/portals/trade-portal-workspace.ts');
assert.match(ws, /enrichDocLinesWithProducts/);
assert.match(ws, /requested_due/);
assert.match(ws, /order_line_index/);
assert.match(ws, /best_before/);

console.log('brief24-fulfilment source tests ok');
