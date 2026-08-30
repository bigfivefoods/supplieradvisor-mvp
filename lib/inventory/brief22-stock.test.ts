/**
 * Run: npx --yes tsx lib/inventory/brief22-stock.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { warehouseMatchesCustomer } from '../portals/customer-site-stock';
import { warehouseMatchesSupplier } from '../portals/supplier-dc-stock';
import { guestPortalTabs } from '../portals/guest-portal-tabs';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

assert.equal(
  warehouseMatchesSupplier(
    { warehouse_type: 'supplier_dc', metadata: { srm_supplier_id: 12 } },
    { supplierId: 12 }
  ),
  true
);
assert.equal(
  warehouseMatchesCustomer(
    { warehouse_type: 'customer_site', metadata: { customer_id: 15 } },
    { customerId: 15 }
  ),
  true
);
assert.equal(
  warehouseMatchesCustomer(
    { warehouse_type: 'supplier_dc', metadata: { srm_supplier_id: 12 } },
    { customerId: 15, tradingName: 'Harvest' }
  ),
  false
);

const customerTabs = guestPortalTabs({ kind: 'customer' }).map((t) => t.id);
assert.ok(customerTabs.includes('stock'));
assert.ok(guestPortalTabs({ kind: 'supplier' }).map((t) => t.id).includes('commercial'));

const stockLine = src('lib/portals/trade-portal.ts');
assert.match(stockLine, /primary_image_url/);
assert.match(stockLine, /lot_number/);

const poster = src('lib/inventory/post-stock.ts');
assert.match(poster, /stock_movements/);
assert.match(poster, /stock_levels/);
assert.match(poster, /inventory_lots/);
assert.match(poster, /syncProductOnHand/);

const receive = src('lib/procurement/receive-from-po.ts');
assert.match(receive, /postStock/);
assert.match(receive, /movementType: 'receive'/);

const produce = src('app/api/manufacturing/production-orders/route.ts');
assert.match(produce, /postProductionStock/);
assert.match(produce, /movementType: 'consume'/);
assert.match(produce, /movementType: 'produce'/);

const act = src('app/api/public/portals/trade/act/route.ts');
assert.match(act, /applyCustomerStockUpdate/);
assert.match(act, /applySupplierStockUpdate/);
assert.doesNotMatch(act, /from\('profiles'\)[\s\S]{0,200}\bphone\b/);

const guest = src('components/portals/GuestTradeWorkspace.tsx');
assert.match(guest, /primary_image_url/);
assert.match(guest, /tab === 'stock'/);
assert.doesNotMatch(guest, /tab === 'stock' && isSupplier/);

const hub = src('app/dashboard/inventory/page.tsx');
assert.match(hub, /Live stock/);
assert.doesNotMatch(hub, /GS1 & EDI/);
assert.doesNotMatch(hub, /Live transfer tracking/);

const sql = src('RUN_THIS_FOR_BRIEF22.sql');
assert.match(sql, /srm_supplier_id',\s*12/);
assert.match(sql, /customer_id',\s*15/);
assert.match(sql, /BOM-ONEPOT-CHICKEN/);
assert.match(sql, /lead_time_days/);
assert.doesNotMatch(sql, /supplier_id\s*=\s*12/);

const sla = src('lib/commercial/db.ts');
assert.match(sla, /saveSlaFields/);
assert.match(sla, /lead_time_days/);
assert.match(sla, /primary_image_url/);
assert.match(sla, /applyHostCostToCatalogue/);
assert.match(sla, /heldCost: false/);

const productsRoute = src('app/api/inventory/products/route.ts');
assert.match(productsRoute, /hostCostLines/);
assert.doesNotMatch(productsRoute, /delete updates\.cost_price/);

const dc = src('lib/portals/supplier-dc-stock.ts');
assert.match(dc, /stock_levels/);
assert.doesNotMatch(dc, /qty_on_hand:\s*0/);
assert.doesNotMatch(dc, /stamped === opts\.supplierId/);

assert.match(sql, /warehouse_id = NULL/);
assert.doesNotMatch(sql, /SET warehouse_id = 1/);
assert.match(sql, /49, 50, 51, 52/);

assert.match(act, /document_share/);
assert.match(act, /applyHostDocShareTick/);
assert.match(act, /Only the host company can choose which files/);

const tradeGet = src('app/api/public/portals/trade/route.ts');
assert.match(tradeGet, /Cache-Control/);
assert.match(tradeGet, /no-store, no-cache, must-revalidate/);

const portalPage = src('app/portal/[token]/page.tsx');
assert.match(portalPage, /cache: 'no-store'/);
assert.match(portalPage, /Refresh/);
assert.match(portalPage, /load\(\{ silent: true \}\)/);

assert.match(guest, /document_share/);
assert.match(guest, /Share none/);
assert.match(guest, /hostDocIsShared/);

const actor = src('lib/portals/portal-actor.ts');
assert.match(actor, /guestVisibleHostDocs/);

const panel = src('components/commercial/CommercialPanel.tsx');
assert.match(panel, /ProductPhoto/);
assert.match(panel, /lead_time_days/);
assert.match(panel, /MOQ/);

console.log('brief22-stock.test.ts ok');
