/**
 * Run: npx --yes tsx lib/storefront/money.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatStoreMoney, storeLineTotal } from './money';
import { seedDefsAsStoreProducts } from './big-five-foods-seed';

assert.equal(formatStoreMoney(null), null);
assert.equal(formatStoreMoney(undefined), null);
assert.ok(formatStoreMoney(60, 'ZAR')?.includes('60'));
assert.equal(storeLineTotal(60, 3), 180);
assert.equal(storeLineTotal(null, 3), null);

const porridge = seedDefsAsStoreProducts().find(
  (p) => p.externalRef === 'porridge-original'
);
assert.equal(porridge?.price, 60);
assert.equal(porridge?.priceOnRequest, false);

const nsnp = seedDefsAsStoreProducts().find(
  (p) => p.externalRef === 'nsnp-enriched-porridge-5kg'
);
assert.equal(nsnp?.price, null);
assert.equal(nsnp?.quoteFirst, true);
assert.equal(nsnp?.priceOnRequest, true);

const catalog = readFileSync(resolve('lib/storefront/catalog.ts'), 'utf8');
assert.match(catalog, /const priceOnRequest = price == null/);
assert.match(catalog, /price: p\.price \?\? null/);

console.log('money.test.ts ok');
