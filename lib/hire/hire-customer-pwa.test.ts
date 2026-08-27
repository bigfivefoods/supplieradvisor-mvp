/**
 * Run: npx --yes tsx lib/hire/hire-customer-pwa.test.ts
 */
import assert from 'node:assert/strict';
import {
  coordsForHireArea,
  filterHireSuppliers,
  groupHireSuppliers,
  hireSupplierKey,
  hireTrackViewFromTab,
  isHireYouTab,
  normalizeHireCustomerTab,
  HIRE_CUSTOMER_PWA_DOCK,
} from './hire-customer-pwa';
import {
  buildHireCustomerPortalPayload,
  emptyHiregraphStore,
  type HireCustomerPortal,
  type HireItem,
} from './hiregraph';

assert.equal(HIRE_CUSTOMER_PWA_DOCK[2], 'you');
assert.deepEqual([...HIRE_CUSTOMER_PWA_DOCK], [
  'search',
  'hire',
  'you',
  'track',
  'nearby',
]);

assert.equal(normalizeHireCustomerTab('shop'), 'hire');
assert.equal(normalizeHireCustomerTab('browse'), 'hire');
assert.equal(normalizeHireCustomerTab('coming'), 'track');
assert.equal(normalizeHireCustomerTab('history'), 'track');
assert.equal(normalizeHireCustomerTab('account'), 'you');
assert.equal(normalizeHireCustomerTab('suppliers'), 'search');
assert.equal(normalizeHireCustomerTab(null), 'search');
assert.equal(hireTrackViewFromTab('history'), 'history');
assert.equal(hireTrackViewFromTab('coming'), 'coming');
assert.equal(isHireYouTab('calendar'), true);
assert.equal(isHireYouTab('hire'), false);

assert.equal(hireSupplierKey({ srm_supplier_id: 44 }), 'srm:44');
assert.equal(hireSupplierKey({ supplier_name: 'Acme Plant' }), 'name:acme plant');
assert.equal(hireSupplierKey({}), 'desk');

const grouped = groupHireSuppliers(
  [
    {
      id: 'a',
      title: 'Mini excavator',
      srm_supplier_id: 10,
      supplier_name: 'Acme Plant',
      location: 'Sandton',
      category_short: 'Plant',
      rate_zar: 1800,
      photo_url: 'https://cdn.example/a.jpg',
    },
    {
      id: 'b',
      title: 'Dumper',
      srm_supplier_id: 10,
      supplier_name: 'Acme Plant',
      location: 'Sandton',
      category_short: 'Plant',
      rate_zar: 950,
    },
    {
      id: 'c',
      title: 'Jumping castle',
      supplier_name: 'Party Hire SA',
      location: 'Randburg',
      category_short: 'Kids',
      rate_zar: 850,
    },
    {
      id: 'd',
      title: 'Desk ladder',
      location: 'Midrand',
      category_short: 'Tools',
      rate_zar: 80,
    },
  ],
  'Big Five Hire'
);

assert.equal(grouped.length, 3);
const acme = grouped.find((s) => s.key === 'srm:10');
assert.ok(acme);
assert.equal(acme?.item_count, 2);
assert.equal(acme?.min_rate_zar, 950);
assert.equal(acme?.location, 'Sandton');
assert.equal(acme?.photo_url, 'https://cdn.example/a.jpg');
const desk = grouped.find((s) => s.key === 'desk');
assert.equal(desk?.name, 'Big Five Hire');
assert.equal(
  filterHireSuppliers(grouped, 'party', '').map((s) => s.name).join(),
  'Party Hire SA'
);
assert.equal(filterHireSuppliers(grouped, '', 'sandton').length, 1);
assert.deepEqual(coordsForHireArea('Sandton'), [-26.1076, 28.0567]);
assert.deepEqual(
  coordsForHireArea('Depot', { lat: -26.2, lng: 28.0, label: 'Depot' }),
  [-26.2, 28.0]
);

const store = emptyHiregraphStore();
const now = '2026-08-01T00:00:00.000Z';
store.settings = { ...store.settings, brand_name: 'Big Five Hire' };
store.items = [
  {
    id: 'itm_1',
    code: 'EX-1',
    title: 'Mini excavator',
    category_id: 'plant_machinery',
    srm_supplier_id: 10,
    supplier_name: 'Acme Plant',
    location: 'Sandton',
    rate_zar: 1800,
    status: 'listed',
    created_at: now,
    updated_at: now,
  } as HireItem,
];
const portal: HireCustomerPortal = {
  crm_customer_id: 7,
  portal_token: 'hire_cust_1_x',
  issued_at: now,
  display_name: 'Alex',
};
store.customer_portals = { '7': portal };

const payload = buildHireCustomerPortalPayload(store, portal, {
  id: 7,
  name: 'Alex',
  email: 'alex@example.com',
});
assert.equal(payload.catalogue[0]?.srm_supplier_id, 10);
assert.equal(payload.suppliers.length, 1);
assert.equal(payload.suppliers[0]?.name, 'Acme Plant');
assert.equal(payload.suppliers[0]?.item_count, 1);
assert.equal(payload.brand, 'HireAdvisor®');
assert.equal(payload.app_name, 'HireAdvisor®');
assert.equal(payload.desk_name, 'Big Five Hire');
assert.equal(payload.logo_url, null);
assert.doesNotMatch(String(payload.brand), /VUKA|Acme Hire|Big Five/i);

console.log('hire-customer-pwa.test.ts ok');
