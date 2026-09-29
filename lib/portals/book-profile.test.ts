/**
 * Run: npx --yes tsx lib/portals/book-profile.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  bookProfileGaps,
  includeOnPortalPo,
  isPortalFinishedGood,
  portalPoCatalogue,
  portalPoFlags,
  portalPoLineAllowed,
  type BookProfile,
  type PortalCatalogueItem,
} from './trade-portal-workspace';
import { parseStorefrontCatalog } from '../storefront/catalog-pick';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

assert.deepEqual(bookProfileGaps(null), [
  'Trading name',
  'Contact name',
  'Email',
  'Phone',
  'City',
  'Country',
]);

const full: BookProfile = {
  trading_name: 'Acme',
  legal_name: 'Acme Pty',
  contact_name: 'Pat',
  job_title: 'Buyer',
  email: 'pat@acme.test',
  phone: '011',
  website: '',
  vat_number: '',
  registration_number: '',
  address: '',
  continent: 'Africa',
  country: 'ZA',
  province: 'Gauteng',
  city: 'Johannesburg',
  payment_terms: '',
  industry: '',
};
assert.deepEqual(bookProfileGaps(full), []);

assert.deepEqual(bookProfileGaps({ ...full, email: '  ', phone: '' }), [
  'Email',
  'Phone',
]);

assert.equal(isPortalFinishedGood('finished_good'), true);
assert.equal(isPortalFinishedGood(null), true);
assert.equal(isPortalFinishedGood('raw_material'), false);
assert.equal(isPortalFinishedGood('wip'), false);

const cat: PortalCatalogueItem[] = [
  {
    id: 2,
    name: 'Bulk maize',
    sku: 'MZ',
    product_type: 'finished_good',
    uom: 'kg',
    unit_price: 10,
    currency: 'ZAR',
    short_description: null,
    primary_image_url: null,
  },
  {
    id: 1,
    name: 'Boxer maize meal',
    sku: 'BX',
    product_type: 'finished_good',
    uom: 'kg',
    unit_price: 12,
    currency: 'ZAR',
    short_description: null,
    primary_image_url: null,
    customer_brand: true,
  },
  {
    id: 3,
    name: 'Yellow maize',
    sku: 'YM',
    product_type: 'raw_material',
    uom: 'kg',
    unit_price: 8,
    currency: 'ZAR',
    short_description: null,
    primary_image_url: null,
  },
];
assert.deepEqual(portalPoCatalogue(cat).map((p) => p.id), [1]);

const chained = portalPoCatalogue([
  { ...cat[0], on_chain: false },
  { ...cat[1], on_chain: true, customer_brand: true },
  {
    id: 4,
    name: 'Chain SKU',
    sku: 'CH',
    product_type: 'finished_good',
    uom: 'kg',
    unit_price: 9,
    currency: 'ZAR',
    short_description: null,
    primary_image_url: null,
    on_chain: true,
  },
]);
assert.deepEqual(
  chained.map((p) => p.id),
  [1, 4]
);

const storefrontOnly = portalPoCatalogue([
  { ...cat[0], on_storefront: true },
  { ...cat[1], on_storefront: true, customer_brand: true },
  { ...cat[2], on_storefront: true },
]);
assert.deepEqual(
  storefrontOnly.map((p) => p.id),
  [1, 2, 3]
);

const mixed = portalPoCatalogue([
  { ...cat[0], on_storefront: true },
  { ...cat[1], on_chain: true, customer_brand: true },
  {
    id: 4,
    name: 'Chain SKU',
    sku: 'CH',
    product_type: 'finished_good',
    uom: 'kg',
    unit_price: 9,
    currency: 'ZAR',
    short_description: null,
    primary_image_url: null,
    on_chain: true,
  },
]);
assert.deepEqual(
  mixed.map((p) => p.id),
  [1, 4, 2]
);

const allPick = parseStorefrontCatalog(undefined);
const selectedPick = parseStorefrontCatalog({
  mode: 'selected',
  product_ids: [2],
});
const emptySelected = parseStorefrontCatalog({
  mode: 'selected',
  product_ids: [],
});

assert.equal(
  includeOnPortalPo({ on_storefront: true, on_chain: false }),
  true
);
assert.equal(includeOnPortalPo({ visible: false, on_storefront: true }), false);

const publicFlags = portalPoFlags({
  productId: 2,
  sku: 'MZ',
  metadata: {},
  customerId: 44,
  chainIds: new Set(),
  pick: allPick,
});
assert.equal(publicFlags.on_storefront, true);
assert.equal(publicFlags.on_chain, false);
assert.equal(includeOnPortalPo(publicFlags), true);

const hidden = portalPoFlags({
  productId: 2,
  sku: 'MZ',
  metadata: { storefront_public: false },
  customerId: 44,
  chainIds: new Set(),
  pick: allPick,
});
assert.equal(hidden.on_storefront, false);
assert.equal(includeOnPortalPo(hidden), false);

const chainNotOnStore = portalPoFlags({
  productId: 9,
  sku: 'PL',
  metadata: { storefront_public: false },
  customerId: 44,
  chainIds: new Set([9]),
  pick: emptySelected,
});
assert.equal(chainNotOnStore.on_storefront, false);
assert.equal(chainNotOnStore.on_chain, true);
assert.equal(includeOnPortalPo(chainNotOnStore), true);

const otherBrand = portalPoFlags({
  productId: 2,
  sku: 'MZ',
  metadata: { customer_brand: true, customer_id: 99 },
  customerId: 44,
  chainIds: new Set(),
  pick: allPick,
});
assert.equal(otherBrand.visible, false);
assert.equal(includeOnPortalPo(otherBrand), false);

assert.equal(
  portalPoLineAllowed({
    productId: 2,
    sku: 'MZ',
    metadata: {},
    customerId: 44,
    chainIds: new Set(),
    pick: allPick,
  }),
  true
);
assert.equal(
  portalPoLineAllowed({
    productId: 2,
    sku: 'MZ',
    metadata: {},
    customerId: 44,
    chainIds: new Set(),
    pick: selectedPick,
  }),
  true
);
assert.equal(
  portalPoLineAllowed({
    productId: 3,
    sku: 'YM',
    metadata: {},
    customerId: 44,
    chainIds: new Set(),
    pick: selectedPick,
  }),
  false
);
assert.equal(
  portalPoLineAllowed({
    productId: 3,
    sku: 'YM',
    metadata: {},
    status: 'archived',
    customerId: 44,
    chainIds: new Set([3]),
    pick: allPick,
  }),
  false
);
assert.equal(
  portalPoLineAllowed({
    productId: 8,
    sku: 'BR',
    metadata: { customer_brand: true, customer_id: 44 },
    customerId: 44,
    chainIds: new Set(),
    pick: emptySelected,
  }),
  true
);

const ws = src('lib/portals/trade-portal-workspace.ts');
assert.match(ws, /storefrontCatalogFromProfileMetadata/);
assert.match(ws, /on_storefront/);
assert.doesNotMatch(ws, /if \(!chainIds\.size\) return \[\]/);
assert.match(ws, /select\('id, metadata'\)/);
assert.doesNotMatch(ws, /from\('profiles'\)[\s\S]{0,200}\bphone\b/);

const poUi = src('components/portals/PortalPurchaseOrder.tsx');
assert.match(poUi, /No catalogue yet/);
assert.match(poUi, /Storefront catalogue/);
assert.doesNotMatch(poUi, /No order chain for this account/);

const act = src('app/api/public/portals/trade/act/route.ts');
assert.match(act, /portalPoLineAllowed/);
assert.match(act, /storefront catalogue or your order chain/);
assert.doesNotMatch(
  act,
  /No order chain is set up for this account/
);

const chainsUi = src('components/orders/OrderChainSetup.tsx');
assert.match(chainsUi, /Optional for large or standing accounts/);
assert.match(chainsUi, /storefront catalogue/);

console.log('book-profile.test.ts ok');
