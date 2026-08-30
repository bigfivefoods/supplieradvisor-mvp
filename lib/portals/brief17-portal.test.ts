/**
 * Run: npx --yes tsx lib/portals/brief17-portal.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

const act = src('app/api/public/portals/trade/act/route.ts');
assert.match(act, /poBelongsToSupplierViewer/);
assert.match(act, /assertSupplierPortalParty/);
assert.match(act, /production_status/);
assert.match(act, /shipped/);
assert.doesNotMatch(act, /from\('profiles'\)[\s\S]{0,200}\bphone\b/);
assert.match(act, /purchase_order_id/);
assert.match(act, /stripMissingMessageColumn/);

const people = src('lib/portals/trade-portal-people.ts');
assert.match(people, /assertSupplierPortalParty/);

const ws = src('lib/portals/trade-portal-workspace.ts');
assert.match(ws, /poBelongsToSupplierViewer/);

const raise = src('app/api/suppliers/purchase-orders/route.ts');
assert.match(raise, /supplier_id: srmId \|\| supplierProfileId/);
assert.match(raise, /assertSupplierPortalParty/);

const recv = src('lib/procurement/receive-from-po.ts');
assert.match(recv, /inventory_lots/);
assert.match(recv, /lots_received_at/);
assert.match(recv, /copyPoLotsToInventory/);

const desk = src('components/portals/TradePortalDesk.tsx');
assert.match(desk, /supplierBookPartyGate/);
assert.match(desk, /supplierBookDisabledReason/);
assert.match(src('lib/portals/supplier-portal-party.ts'), /Customer only/);

const guest = src('components/portals/GuestTradeWorkspace.tsx');
assert.match(guest, /supplierPortalCardAction/);
assert.match(guest, /production_update/);
assert.match(guest, /min-h-\[44px\]/);
assert.doesNotMatch(guest, /window\.prompt/);
assert.match(src('lib/orders/chain-path.ts'), /Accept PO/);
assert.match(src('lib/orders/chain-path.ts'), /Mark ready/);
assert.match(src('lib/orders/chain-path.ts'), /Mark shipped/);

const poDesk = src('app/dashboard/suppliers/po/PoDesk.tsx');
assert.match(poDesk, /PoSupplierChain/);
assert.match(poDesk, /PoPortalThread/);
assert.doesNotMatch(poDesk, /window\.prompt/);

console.log('brief17-portal source tests ok');
