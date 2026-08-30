/**
 * Run: npx --yes tsx lib/commercial/brief23-catalogue.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

const db = src('lib/commercial/db.ts');
assert.match(db, /activeOnly/);
assert.match(db, /shareSupplierSku/);
assert.match(db, /setSupplierCatalogueTicks/);
assert.match(db, /stampPrimarySupplier/);
assert.match(db, /unstampIfOrphan/);
assert.match(db, /status: 'paused'/);
assert.match(db, /srm_supplier_id/);
assert.doesNotMatch(db, /from\('profiles'\)[\s\S]{0,200}\bphone\b/);

const picker = src('components/commercial/PortalCataloguePicker.tsx');
assert.match(picker, /Portal catalogue/);
assert.match(picker, /Share all/);
assert.match(picker, /Share none/);
assert.match(picker, /cost_price/);
assert.match(picker, /primary_image_url/);
assert.doesNotMatch(picker, /sell_price/);

const host = src('components/commercial/CommercialPanel.tsx');
assert.match(host, /PortalCataloguePicker/);
assert.match(host, /No SKUs shared with this portal yet/);

const cat = src('app/api/suppliers/catalogue/route.ts');
assert.match(cat, /supplier_ticks/);
assert.match(cat, /loadPartyLines/);
assert.match(cat, /Tick inventory SKUs/);

const linesApi = src('app/api/commercial/lines/route.ts');
assert.match(linesApi, /shareSupplierSku/);
assert.match(linesApi, /share_all/);
assert.match(linesApi, /share_none/);

const po = src('lib/commercial/po-price.ts');
assert.match(po, /requireTick/);
assert.match(po, /not on this supplier/);

const act = src('app/api/public/portals/trade/act/route.ts');
assert.match(act, /commercial_share/);
assert.doesNotMatch(act, /from\('profiles'\)[\s\S]{0,200}\bphone\b/);

const stock = src('lib/portals/supplier-dc-stock.ts');
assert.doesNotMatch(stock, /loadPartyLines/);
assert.doesNotMatch(stock, /party_catalogue_lines/);

const srm = src('components/suppliers/SupplierBookProfile.tsx');
assert.match(srm, /HostCommercial/);

const desk = src('components/portals/TradePortalDesk.tsx');
assert.match(desk, /HostCommercial/);

assert.match(src('lib/portals/trade-portal-workspace.ts'), /loadPartyLines/);

console.log('brief23-catalogue.test.ts ok');
