/**
 * Run: npx --yes tsx lib/storefront/customer.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  storefrontCustomerInsertPayload,
  storefrontCustomerPatch,
} from './customer';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

const payload = storefrontCustomerInsertPayload(
  99,
  {
    tradingName: 'Harvest Kitchen',
    contactName: 'Ada',
    contactEmail: 'ada@example.com',
    contactPhone: '0820000000',
    customerType: 'business',
    city: 'Durban',
    country: 'South Africa',
    address: '12 Bay Rd',
    vatNumber: '4123456789',
    storeSlug: 'big-five-foods',
  },
  '2026-09-10T00:00:00.000Z'
);
assert.equal(payload.profile_id, 99);
assert.equal(payload.trading_name, 'Harvest Kitchen');
assert.equal(payload.email, 'ada@example.com');
assert.equal(payload.customer_type, 'business');
assert.equal(payload.city, 'Durban');
assert.equal(payload.shipping_address, '12 Bay Rd');
assert.equal(payload.source, 'storefront');
assert.equal((payload.metadata as { storefront: boolean }).storefront, true);
assert.equal(
  (payload.metadata as { party_book_role: string }).party_book_role,
  'customer'
);

const patch = storefrontCustomerPatch(
  {
    id: 1,
    trading_name: 'Harvest Kitchen',
    city: null,
    country: null,
    shipping_address: null,
    billing_address: null,
    vat_number: null,
    source: null,
    metadata: {},
  },
  {
    tradingName: 'Harvest Kitchen',
    contactName: 'Ada',
    contactEmail: 'ada@example.com',
    city: 'Durban',
    address: '12 Bay Rd',
    storeSlug: 'big-five-foods',
  },
  '2026-09-10T00:00:00.000Z'
);
assert.equal(patch.city, 'Durban');
assert.equal(patch.shipping_address, '12 Bay Rd');
assert.equal(patch.contact_name, 'Ada');
assert.equal((patch.metadata as { storefront: boolean }).storefront, true);

const quotes = src('app/api/storefront/[companySlug]/quotes/route.ts');
assert.match(quotes, /upsertStorefrontCustomer/);
assert.match(quotes, /customer,/);
assert.doesNotMatch(quotes, /from\('profiles'\)[\s\S]{0,220}\bphone\b/);

const cart = src('components/storefront/StoreOrderCart.tsx');
assert.match(cart, /customerType/);
assert.match(cart, /Delivery \/ billing address/);
assert.match(cart, /customer profile/);

const card = src('components/storefront/StoreShell.tsx');
assert.match(card, /StorePrice/);

const priceUi = src('components/storefront/StorePrice.tsx');
assert.match(priceUi, /excl\. VAT/);
assert.match(priceUi, /Price on request/);

console.log('customer.test.ts ok');
