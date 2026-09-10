/**
 * Run: npx --yes tsx lib/storefront/store-order.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

const quotes = src('app/api/storefront/[companySlug]/quotes/route.ts');
assert.match(quotes, /attachStorefrontPortal/);
assert.match(quotes, /issueAccountPortal/);
assert.match(quotes, /portalUrl/);
assert.match(quotes, /upsertStorefrontCustomer/);
assert.doesNotMatch(quotes, /from\('profiles'\)[\s\S]{0,200}\bphone\b/);

const cart = src('components/storefront/StoreOrderCart.tsx');
assert.match(cart, /Order from the catalogue/);
assert.match(cart, /Open your customer portal/);
assert.match(cart, /asBusiness/);
assert.match(cart, /customerType/);
assert.match(src('components/storefront/StoreProductAdd.tsx'), /Add to order/);
assert.match(src('components/storefront/StorePrice.tsx'), /excl\. VAT/);

const store = src('app/store/[companySlug]/page.tsx');
assert.match(store, /StoreOrderProvider/);
assert.match(store, /storeEmbedPath/);

const embed = src('app/embed/store/[companySlug]/page.tsx');
assert.match(embed, /StoreOrderProvider/);
assert.match(embed, /website-embed/);

const profile = src('app/c/[id]/page.tsx');
assert.match(profile, /Order from catalogue/);
assert.match(profile, /publicStorePath/);

assert.match(src('lib/storefront/catalog.ts'), /applyStorefrontCatalog/);
assert.match(
  src('app/dashboard/inventory/storefront/page.tsx'),
  /Only selected items/
);

console.log('store-order.test.ts ok');
