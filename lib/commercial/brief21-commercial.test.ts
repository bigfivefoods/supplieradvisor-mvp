/**
 * Run: npx --yes tsx lib/commercial/brief21-commercial.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyAcceptedUnitPrices, billedUnitPrice, kelpackSeedPrice } from './engine';
import { KELPACK_SEED_PRICES, KENYA_CUSTOMER_ID } from './types';
import { guestPortalTabs } from '../portals/guest-portal-tabs';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

const supplierTabs = guestPortalTabs({ kind: 'supplier' }).map((t) => t.id);
const customerTabs = guestPortalTabs({ kind: 'customer' }).map((t) => t.id);
assert.ok(supplierTabs.includes('commercial'));
assert.equal(supplierTabs.indexOf('commercial'), supplierTabs.indexOf('orders') + 1);
assert.ok(supplierTabs.indexOf('commercial') < supplierTabs.indexOf('stock'));
assert.ok(customerTabs.includes('commercial'));
assert.ok(customerTabs.indexOf('commercial') > customerTabs.indexOf('orders'));

assert.equal(kelpackSeedPrice(2), 28);
assert.equal(kelpackSeedPrice(7), 35);
assert.equal(kelpackSeedPrice(42), 99);
assert.equal(kelpackSeedPrice(45), 685.75);
assert.equal(kelpackSeedPrice(49), 1.35);
assert.equal(
  KELPACK_SEED_PRICES.some((r) => r.product_id === 54 || r.product_id === 10),
  false
);
assert.equal(KENYA_CUSTOMER_ID, 3);

assert.equal(billedUnitPrice({ accepted_price: 28, pending_price: 30 }), 28);
const po = applyAcceptedUnitPrices(
  [{ product_id: 2, quantity: 2, unit_price: 99 }],
  { 2: 28 }
);
assert.equal(po.items[0].unit_price, 28);
assert.equal(po.total, 56);

const sql = src('RUN_THIS_FOR_BRIEF21_COMMERCIAL.sql');
assert.match(sql, /party_catalogue_lines/);
assert.match(sql, /party_price_revisions/);
assert.match(sql, /supplier_id = 12/);
assert.match(sql, /\(2, 28/);
assert.match(sql, /685\.75/);
assert.match(sql, /pricing_agreement_lines/);
assert.doesNotMatch(sql, /linked_profile_id\s*=\s*12/);

const act = src('app/api/public/portals/trade/act/route.ts');
assert.match(act, /commercial_propose/);
assert.match(act, /commercial_accept/);
assert.match(src('lib/commercial/db.ts'), /The other side must Accept/);
assert.doesNotMatch(act, /from\('profiles'\)[\s\S]{0,200}\bphone\b/);

const poPost = src('app/api/suppliers/purchase-orders/route.ts');
assert.match(poPost, /lookupAcceptedMap/);
assert.match(poPost, /applyAcceptedUnitPrices/);
assert.doesNotMatch(poPost, /supplier_id: srmId \|\| supplierProfileId/);

const lookup = src('lib/pricing/access.ts');
assert.match(lookup, /lookupAcceptedMap/);
assert.match(lookup, /partyKind: 'customer'/);

const cat = src('app/api/suppliers/catalogue/route.ts');
assert.match(cat, /lookupAcceptedMap/);

const ws = src('lib/portals/trade-portal-workspace.ts');
assert.match(ws, /commercial/);
assert.match(ws, /lookupAcceptedMap/);

const guest = src('components/portals/GuestTradeWorkspace.tsx');
assert.match(guest, /CommercialPanel/);
assert.match(guest, /tab === 'commercial'/);

const desk = src('components/portals/TradePortalDesk.tsx');
assert.match(desk, /HostCommercial/);

const srm = src('components/suppliers/SupplierBookProfile.tsx');
assert.match(srm, /HostCommercial/);

const net = src('app/dashboard/suppliers/network/page.tsx');
assert.doesNotMatch(
  net,
  /const hit = rows\.find[\s\S]{0,80}setSelectedHold\(hit\)/
);
assert.match(net, /id: String\(selectedId\)/);

const inv = src('app/api/inventory/products/route.ts');
assert.match(inv, /proposeFromProductMaster/);
assert.match(inv, /heldCost/);

const agr = src('app/api/pricing/agreements/route.ts');
assert.match(agr, /syncAgreementIntoCatalogue/);

console.log('brief21-commercial.test.ts ok');
