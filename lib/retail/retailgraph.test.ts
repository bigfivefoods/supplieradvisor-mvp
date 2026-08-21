/**
 * Run: npx --yes tsx lib/retail/retailgraph.test.ts
 */
import assert from 'node:assert/strict';
import {
  emptyRetailgraphStore,
  findRetailCustomerByPortalToken,
  issueRetailCustomerPortal,
  issueRetailCustomerPortalToken,
  parseCompanyIdFromRetailCustomerToken,
  parseCompanyIdFromRetailPublicToken,
  retailCustomerPortalPath,
  writeRetailgraphToMetadata,
} from './retailgraph';

assert.equal(parseCompanyIdFromRetailPublicToken('rtl_120_abc'), 120);
assert.equal(parseCompanyIdFromRetailPublicToken('rtl_cus_120_abc'), null);
assert.equal(parseCompanyIdFromRetailCustomerToken('rtl_cus_120_abc'), 120);
assert.equal(parseCompanyIdFromRetailCustomerToken('rtl_120_abc'), null);

const token = issueRetailCustomerPortalToken(42);
assert.match(token, /^rtl_cus_42_/);
assert.equal(parseCompanyIdFromRetailCustomerToken(token), 42);
assert.equal(
  retailCustomerPortalPath('rtl_cus_1_x'),
  '/member/retailgraph/rtl_cus_1_x'
);
assert.ok(!retailCustomerPortalPath('tok').includes('/embed/'));

let store = emptyRetailgraphStore();
store = {
  ...store,
  customers: [{ id: 'cus_1', name: 'Ada', email: 'ada@example.com' }],
};
const issued = issueRetailCustomerPortal(store, 'cus_1', { companyId: 9 });
assert.equal(issued.customer.name, 'Ada');
assert.match(String(issued.customer.portal_token), /^rtl_cus_9_/);
assert.equal(
  findRetailCustomerByPortalToken(issued.store, issued.customer.portal_token || '')
    ?.id,
  'cus_1'
);
const again = issueRetailCustomerPortal(issued.store, 'cus_1', { companyId: 9 });
assert.equal(again.customer.portal_token, issued.customer.portal_token);

const meta = writeRetailgraphToMetadata({}, issued.store);
assert.equal(
  (meta.retailgraph_customer_tokens as Record<string, string>)[
    String(issued.customer.portal_token)
  ],
  'cus_1'
);

console.log('retailgraph.test.ts ok');
