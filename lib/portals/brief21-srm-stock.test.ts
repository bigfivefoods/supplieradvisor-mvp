/**
 * Run: npx --yes tsx lib/portals/brief21-srm-stock.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { KELPACK_PINNED_PRODUCT_IDS } from '../suppliers/book-persist';
import { warehouseMatchesSupplier } from './supplier-dc-stock';
import { PO_SOFT, PO_WIDE } from './host-purchase-orders';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

assert.equal(PO_WIDE.includes('order_number'), false);
assert.equal(PO_SOFT.includes('order_number'), false);

const dc = src('lib/portals/supplier-dc-stock.ts');
assert.match(dc, /srm_supplier_id/);
assert.match(dc, /product_type/);
assert.match(dc, /warehouse_id/);

assert.equal(
  warehouseMatchesSupplier(
    { warehouse_type: 'supplier_dc', metadata: { srm_supplier_id: 12 } },
    { supplierId: 12 }
  ),
  true
);
assert.equal(
  warehouseMatchesSupplier(
    { warehouse_type: 'warehouse', name: 'Craig Home', metadata: {} },
    { supplierId: 12, tradingName: 'Kelpack' }
  ),
  false
);
assert.equal(
  warehouseMatchesSupplier(
    {
      warehouse_type: 'customer_site',
      name: 'SA Harvest',
      metadata: { customer_id: 1 },
    },
    { supplierId: 12, tradingName: 'Kelpack' }
  ),
  false
);

for (const id of [2, 3, 4, 5, 6, 7, 8, 9, 42, 44, 45, 46]) {
  assert.ok(KELPACK_PINNED_PRODUCT_IDS.includes(id as (typeof KELPACK_PINNED_PRODUCT_IDS)[number]));
}
assert.equal((KELPACK_PINNED_PRODUCT_IDS as readonly number[]).includes(54), false);
assert.equal((KELPACK_PINNED_PRODUCT_IDS as readonly number[]).includes(10), false);

const guest = src('components/portals/GuestTradeWorkspace.tsx');
assert.match(guest, /Raw materials/);
assert.match(guest, /Finished goods/);
assert.match(guest, /stock_update/);
assert.doesNotMatch(guest, /window\.prompt/);

const act = src('app/api/public/portals/trade/act/route.ts');
assert.match(act, /stock_update/);
assert.match(act, /supplierPatchUpdates/);
assert.match(act, /status: 403/);

const sql = src('RUN_THIS_FOR_BRIEF21.sql');
assert.match(sql, /srm_supplier_id',\s*12/);
assert.match(sql, /warehouse_id = 1/);
assert.match(sql, /2, 3, 4, 5, 6, 7, 8, 9, 42, 44, 45, 46/);
assert.doesNotMatch(sql, /id = 4/);

const net = src('app/dashboard/suppliers/network/page.tsx');
assert.match(net, /selectedHold && selectedHold.id === selectedId/);
assert.match(net, /\.\.\.selectedHold/);

console.log('brief21-srm-stock tests ok');
