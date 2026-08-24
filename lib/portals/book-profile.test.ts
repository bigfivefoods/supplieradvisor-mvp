/**
 * Run: npx --yes tsx lib/portals/book-profile.test.ts
 */
import assert from 'node:assert/strict';
import {
  bookProfileGaps,
  isPortalFinishedGood,
  portalPoCatalogue,
  type BookProfile,
  type PortalCatalogueItem,
} from './trade-portal-workspace';

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
assert.deepEqual(portalPoCatalogue(cat).map((p) => p.id), []);

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

console.log('book-profile.test.ts ok');
