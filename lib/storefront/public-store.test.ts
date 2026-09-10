/**
 * Run: npx --yes tsx lib/storefront/public-store.test.ts
 */
import assert from 'node:assert/strict';
import { publicStorePath, publicStoreSlug, storeEmbedPath } from './public-store';

assert.equal(
  publicStoreSlug({ tradingName: 'Big Five Foods' }),
  'big-five-foods'
);
assert.equal(
  publicStoreSlug({
    tradingName: 'Other Co',
    metadata: { store_slug: 'big-five-foods' },
  }),
  'big-five-foods'
);
assert.equal(
  publicStorePath({ tradingName: 'Big Five Foods' }),
  '/store/big-five-foods'
);
assert.equal(storeEmbedPath('big-five-foods'), '/embed/store/big-five-foods');

console.log('public-store.test.ts ok');
