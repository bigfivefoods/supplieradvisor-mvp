/**
 * Run: npx --yes tsx lib/customers/trade-thread.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  canAcceptQuote,
  canIssueQuote,
  canPayDeposit,
  canStartProcessing,
  depositAmountFromTotal,
  isPortalEnquiryDoc,
  newStorefrontEnquiryThread,
  parseTradeThread,
  statusForStage,
  writeTradeThread,
} from './trade-thread';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

const enquiry = newStorefrontEnquiryThread({
  enquiryNumber: 'ENQ-1',
  now: '2026-09-10T00:00:00.000Z',
});
assert.equal(enquiry.stage, 'enquiry');
assert.equal(enquiry.source, 'storefront');
assert.equal(isPortalEnquiryDoc({ status: 'enquiry' }), true);
assert.equal(isPortalEnquiryDoc({ thread_stage: 'enquiry', status: 'sent' }), true);
assert.equal(isPortalEnquiryDoc({ status: 'sent', thread_stage: 'quoted' }), false);
assert.equal(canIssueQuote(enquiry, 'enquiry'), true);
assert.equal(canAcceptQuote(enquiry, 'enquiry'), false);
assert.equal(statusForStage('quoted'), 'sent');

const quoted = parseTradeThread(
  writeTradeThread({}, { ...enquiry, stage: 'quoted', quoted_at: enquiry.enquiry_at }),
  'sent'
);
assert.equal(quoted.stage, 'quoted');
assert.equal(canAcceptQuote(quoted, 'sent'), true);
assert.equal(canPayDeposit(quoted), false);

const accepted = { ...quoted, stage: 'accepted' as const, po_number: 'PO-88' };
assert.equal(canPayDeposit(accepted), true);
assert.equal(canStartProcessing(accepted, 'accepted'), false);

const paid = {
  ...accepted,
  stage: 'processing' as const,
  deposit_paid_at: '2026-09-10T01:00:00.000Z',
};
assert.equal(canStartProcessing(paid, 'deposit_paid'), true);
assert.equal(depositAmountFromTotal(1150, 50), 575);

const storefront = src('app/api/storefront/[companySlug]/quotes/route.ts');
assert.match(storefront, /status: 'enquiry'/);
assert.match(storefront, /docNumber\('ENQ'\)/);
assert.doesNotMatch(storefront, /from\('profiles'\)[\s\S]{0,220}\bphone\b/);

const docs = src('app/api/customers/docs/route.ts');
assert.match(docs, /issue_quote/);
assert.match(docs, /canStartProcessing/);

const act = src('app/api/public/portals/trade/act/route.ts');
assert.match(act, /accept_quote/);
assert.match(act, /pay_deposit/);
assert.match(act, /createTradeDepositInvoice/);
assert.doesNotMatch(act, /from\('profiles'\)[\s\S]{0,200}\bphone\b/);

const portal = src('components/portals/GuestTradeWorkspace.tsx');
assert.match(portal, /PortalOfficialOrderCard/);
assert.match(portal, /PO number/);
assert.match(src('components/portals/PortalOfficialOrder.tsx'), /Your PO number/);

const desk = src('components/customers/DocumentWorkspace.tsx');
assert.match(desk, /Issue quote/);
assert.match(desk, /Enquiries/);

console.log('trade-thread.test.ts ok');
