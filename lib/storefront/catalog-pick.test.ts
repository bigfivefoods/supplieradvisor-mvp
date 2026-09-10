/**
 * Run: npx --yes tsx lib/storefront/catalog-pick.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyStorefrontCatalog,
  gymStorefrontItemId,
  parseStorefrontCatalog,
  productMatchesStorefrontPick,
  storefrontCatalogFromProfileMetadata,
} from './catalog-pick';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

const missing = parseStorefrontCatalog(undefined);
assert.equal(missing.mode, 'all');
assert.deepEqual(missing.product_ids, []);

const selected = parseStorefrontCatalog({
  mode: 'selected',
  product_ids: [10, 10, '11', 0, -1, 'x'],
  seed_keys: ['Porridge-Original', 'BFF-POR-ORI', ''],
  gym_item_ids: ['gym-membership-abc'],
});
assert.equal(selected.mode, 'selected');
assert.deepEqual(selected.product_ids, [10, 11]);
assert.deepEqual(selected.seed_keys, ['porridge-original', 'bff-por-ori']);

const fromMeta = storefrontCatalogFromProfileMetadata({
  storefront_catalog: { mode: 'selected', product_ids: [7] },
});
assert.equal(fromMeta.mode, 'selected');
assert.deepEqual(fromMeta.product_ids, [7]);

const rows = [
  { id: 10, sku: 'BFF-POR-ORI', externalRef: 'porridge-original', name: 'Original' },
  { id: 20, sku: 'BFF-SOY-BEF', externalRef: 'soya-beef', name: 'Soya' },
  {
    id: gymStorefrontItemId('membership', 'abc'),
    sku: 'GYM-1',
    externalRef: gymStorefrontItemId('membership', 'abc'),
    name: 'Gym plan',
  },
];

assert.equal(applyStorefrontCatalog(rows, missing).length, 3);
assert.deepEqual(
  applyStorefrontCatalog(rows, selected).map((p) => p.id),
  [10, gymStorefrontItemId('membership', 'abc')]
);
assert.deepEqual(
  applyStorefrontCatalog(rows, {
    mode: 'selected',
    product_ids: [],
    seed_keys: [],
    gym_item_ids: [],
  }),
  []
);
assert.equal(
  productMatchesStorefrontPick(
    { id: 99, sku: 'BFF-POR-ORI', externalRef: null },
    selected
  ),
  true
);

const catalog = src('lib/storefront/catalog.ts');
assert.match(catalog, /applyStorefrontCatalog/);
assert.match(catalog, /hadDbProducts/);
assert.match(catalog, /storefrontCatalogFromProfileMetadata/);

const api = src('app/api/inventory/storefront/route.ts');
assert.match(api, /requireCompanyAccess/);
assert.match(api, /storefront_catalog/);
assert.doesNotMatch(api, /from\('profiles'\)[\s\S]{0,200}\bphone\b/);

const desk = src('app/dashboard/inventory/storefront/page.tsx');
assert.match(desk, /Only selected items/);
assert.match(desk, /Save storefront/);

const nav = src('lib/chrome/module-nav.ts');
assert.match(nav, /\/dashboard\/inventory\/storefront/);

const quotes = src('app/api/storefront/[companySlug]/quotes/route.ts');
assert.doesNotMatch(quotes, /from\('profiles'\)[\s\S]{0,200}\bphone\b/);

console.log('catalog-pick.test.ts ok');
