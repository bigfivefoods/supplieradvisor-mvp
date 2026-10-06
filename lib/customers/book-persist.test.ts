/**
 * Run: npx --yes tsx lib/customers/book-persist.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  customerPatchUpdates,
  emptyToNull,
  numericOrNull,
  savedPartyCommercial,
} from './book-persist';
import { CUSTOMER_BOOK_COLUMNS, CUSTOMER_LIST_COLUMNS } from '../http/tenant-list';

assert.equal(emptyToNull(''), null);
assert.equal(emptyToNull('Net 14'), 'Net 14');
assert.equal(numericOrNull(''), null);
assert.equal(numericOrNull('1500'), 1500);
assert.equal(numericOrNull(0), 0);
assert.equal(numericOrNull('nope'), null);

const updates = customerPatchUpdates({
  trading_name: 'Palm Footwear',
  payment_terms: 'Net 14',
  currency: 'ZAR',
  billing_address: '12 Main Rd',
  credit_limit: '20000',
  province: 'Gauteng',
  vat_number: '',
  email: '',
});
assert.equal(updates.trading_name, 'Palm Footwear');
assert.equal(updates.payment_terms, 'Net 14');
assert.equal(updates.currency, 'ZAR');
assert.equal(updates.billing_address, '12 Main Rd');
assert.equal(updates.credit_limit, 20000);
assert.equal(updates.province, 'Gauteng');
assert.equal(updates.region, 'Gauteng');
assert.equal(updates.vat_number, null);
assert.equal(updates.email, null);
assert.equal(updates.status, undefined);
assert.equal('action' in updates, false);

const cleared = customerPatchUpdates({ credit_limit: '', rating: '' });
assert.equal(cleared.credit_limit, null);
assert.equal(cleared.rating, null);

assert.deepEqual(savedPartyCommercial({ payment_terms: ' Net 14 ', currency: 'zar' }), {
  paymentTerms: 'Net 14',
  currency: 'ZAR',
});
assert.deepEqual(savedPartyCommercial({ payment_terms: '', currency: null }), {
  paymentTerms: null,
  currency: null,
});

assert.match(CUSTOMER_LIST_COLUMNS, /payment_terms/);
assert.match(CUSTOMER_LIST_COLUMNS, /currency/);
assert.match(CUSTOMER_BOOK_COLUMNS, /billing_address/);
assert.match(CUSTOMER_BOOK_COLUMNS, /vat_number/);
assert.match(CUSTOMER_BOOK_COLUMNS, /payment_terms/);

const route = readFileSync(resolve('app/api/customers/route.ts'), 'utf8');
assert.match(route, /customerPatchUpdates/);
assert.match(route, /CUSTOMER_BOOK_COLUMNS/);
assert.match(route, /byId/);
assert.match(route, /action === 'set_credit_hold'/);
assert.match(route, /action === 'clear_credit_hold'/);
const patch = route.split('export async function PATCH')[1] || '';
assert.doesNotMatch(patch.split("action === 'clear_credit_hold'")[0] || '', /customerPatchUpdates/);

const profiles = readFileSync(resolve('app/dashboard/customers/profiles/page.tsx'), 'utf8');
assert.match(profiles, /Saved to the customer book/);
assert.match(profiles, /customerId=/);

const docs = readFileSync(resolve('components/customers/DocumentWorkspace.tsx'), 'utf8');
assert.match(docs, /savedPartyCommercial/);
assert.match(docs, /searchParams\.get\('customerId'\)/);

console.log('customers/book-persist.test.ts ok');
