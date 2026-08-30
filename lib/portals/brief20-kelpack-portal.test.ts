/**
 * Run: npx --yes tsx lib/portals/brief20-kelpack-portal.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { poBelongsToSupplierViewer } from './supplier-portal-party';
import { warehouseMatchesSupplier as dcMatch } from './supplier-dc-stock';
import { PO_SOFT, PO_WIDE } from './host-purchase-orders';
import { warehouseAtLabel } from '../inventory/types';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

assert.equal(PO_WIDE.includes('order_number'), false);
assert.equal(PO_SOFT.includes('order_number'), false);
assert.match(PO_WIDE, /po_number/);
assert.match(src('lib/portals/host-purchase-orders.ts'), /stripSelectColumn/);
assert.doesNotMatch(
  src('lib/portals/trade-portal-workspace.ts').split('sales_orders')[0] || '',
  /from\('purchase_orders'\)[\s\S]{0,200}order_number/
);

assert.equal(
  poBelongsToSupplierViewer(
    { supplier_id: null, metadata: { srm_supplier_id: 12 } },
    { supplierId: 12, linkedProfileId: null }
  ),
  true
);

assert.equal(
  dcMatch(
    {
      warehouse_type: 'supplier_dc',
      name: 'Kelpack',
      metadata: { srm_supplier_id: 12 },
    },
    { supplierId: 12, tradingName: 'Kelpack Manufacturing (Pty) Ltd' }
  ),
  true
);
assert.equal(
  dcMatch(
    {
      warehouse_type: 'supplier_dc',
      name: 'Kelpack',
      partner_name: 'Kelpack Manufacturing',
      metadata: {},
    },
    { supplierId: 12, tradingName: 'Kelpack Manufacturing (Pty) Ltd' }
  ),
  true
);
assert.equal(
  dcMatch(
    { warehouse_type: 'warehouse', name: 'Craig Home', metadata: {} },
    { supplierId: 12, tradingName: 'Kelpack' }
  ),
  false
);

assert.equal(
  warehouseAtLabel({
    owner_type: 'supplier',
    name: 'Kelpack',
    partner_name: 'Kelpack',
  }),
  'at Kelpack'
);
assert.match(warehouseAtLabel({ owner_type: 'own', name: 'Craig Home' }), /at us/);

const createPo = src('app/api/suppliers/purchase-orders/route.ts');
assert.match(createPo, /srm_supplier_id: srmId/);
assert.match(createPo, /23503\|foreign key/);
assert.doesNotMatch(createPo, /supplier_id: srmId \|\| supplierProfileId/);

const act = src('app/api/public/portals/trade/act/route.ts');
assert.match(act, /action === 'stock_update'/);
assert.match(act, /applySupplierStockUpdate/);
assert.match(act, /Only the host company can update their documents/);
assert.match(act, /status: 403/);

const ws = src('lib/portals/trade-portal-workspace.ts');
assert.match(ws, /loadSupplierHeldStock/);
assert.match(src('lib/portals/supplier-dc-stock.ts'), /stock_levels/);
assert.match(src('lib/portals/supplier-dc-stock.ts'), /qty_on_hand/);

const guest = src('components/portals/GuestTradeWorkspace.tsx');
assert.match(guest, /Share all on file/);
assert.match(guest, /Share on portal/);
assert.match(guest, /stock_update/);
assert.match(guest, /No stock held at this supplier yet/);
assert.doesNotMatch(guest, /window\.prompt/);

const whApi = src('app/api/inventory/warehouses/route.ts');
assert.match(whApi, /srm_supplier_id/);
assert.match(whApi, /customer_id/);

const whPage = src('app/dashboard/inventory/warehouses/page.tsx');
assert.match(whPage, /Pick supplier on your books/);
assert.match(whPage, /\/api\/suppliers\?companyId=/);

const sql = src('RUN_THIS_FOR_BRIEF20.sql');
assert.match(sql, /company-documents/);
assert.match(sql, /public/);

console.log('brief20-kelpack-portal tests ok');
