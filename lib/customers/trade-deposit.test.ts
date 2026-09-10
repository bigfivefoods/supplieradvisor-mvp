/**
 * Run: npx --yes tsx lib/customers/trade-deposit.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  depositPoNumberFromMeta,
  invoiceLooksLikeDeposit,
  isDepositInvoiceNumber,
  scaleItemsForDeposit,
} from './trade-deposit';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

assert.equal(isDepositInvoiceNumber('DEP-20260910-AB12'), true);
assert.equal(isDepositInvoiceNumber('INV-1'), false);
assert.equal(
  invoiceLooksLikeDeposit({ number: 'INV-1', notes: 'Deposit (50%) on official order' }),
  true
);
assert.equal(
  invoiceLooksLikeDeposit({
    number: 'INV-1',
    metadata: { kind: 'crm_po_deposit', po_number: 'PO-88' },
  }),
  true
);
assert.equal(depositPoNumberFromMeta({ po_number: 'PO-88' }), 'PO-88');

const scaled = scaleItemsForDeposit(
  [{ name: 'Meal', quantity: 10, unit_price: 20, line_total: 200 }],
  50
);
assert.equal(scaled[0].unit_price, 10);
assert.equal(scaled[0].line_total, 100);

const act = src('app/api/public/portals/trade/act/route.ts');
assert.match(act, /createTradeDepositInvoice/);
assert.match(act, /attachment_url/);
assert.match(act, /deposit_due: true/);
assert.match(act, /return_tab/);
assert.doesNotMatch(act, /from\('profiles'\)[\s\S]{0,200}\bphone\b/);

const poUi = src('components/portals/PortalPurchaseOrder.tsx');
assert.match(poUi, /Your PO number \(from your system\)/);
assert.match(poUi, /Attach the PO from your system/);
assert.match(poUi, /Send PO & pay/);
assert.match(poUi, /Deposit due now/);

const official = src('components/portals/PortalOfficialOrder.tsx');
assert.match(official, /Attach the PO from your system/);
assert.match(official, /pay_deposit/);
assert.match(official, /return_tab: 'newpo'/);

const guest = src('components/portals/GuestTradeWorkspace.tsx');
assert.match(guest, /PortalOfficialOrderQueue/);
assert.match(guest, /confirm_deposit/);

const statement = src('components/portals/GuestTradeWorkspace.tsx');
assert.match(statement, /r\.deposit/);
assert.match(statement, /posts a DEP invoice/);

const inbound = src('app/dashboard/customers/orders/page.tsx');
assert.match(inbound, /customer_po_number/);
assert.match(inbound, /Customer PO file/);
assert.match(inbound, /Deposit paid/);

const apply = src('lib/customers/trade-thread-apply.ts');
assert.match(apply, /inbound_po_id/);
assert.match(apply, /deposit_paid_at/);

console.log('trade-deposit.test.ts ok');
