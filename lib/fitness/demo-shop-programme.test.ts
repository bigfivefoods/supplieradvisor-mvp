/**
 * Run: npx --yes tsx lib/fitness/demo-shop-programme.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore } from './fitgraph';
import { gymShopCatalog } from './gym-shop';
import {
  DEMO_SHOP_PROGRAMME_ID,
  buildDemoShopProgramme,
  ensureDemoShopProgramme,
} from './demo-shop-programme';

const p = buildDemoShopProgramme('2026-08-20T00:00:00.000Z');
assert.equal(p.id, DEMO_SHOP_PROGRAMME_ID);
assert.equal(p.weeks, 4);
assert.ok((p.blocks || []).length >= 8);
assert.equal(p.public, true);
assert.equal(p.price_zar, 450);
assert.equal(p.billing, 'once');

const store = emptyFitgraphStore();
assert.equal(ensureDemoShopProgramme(store, '2026-08-20T00:00:00.000Z'), true);
assert.equal(ensureDemoShopProgramme(store, '2026-08-20T00:00:00.000Z'), false);
assert.ok(
  gymShopCatalog(store).some(
    (i) => i.kind === 'programme' && i.id === DEMO_SHOP_PROGRAMME_ID
  )
);
store.programmes![0].public = false;
store.programmes![0].price_zar = null;
assert.equal(ensureDemoShopProgramme(store), true);
assert.equal(store.programmes![0].public, true);
assert.equal(Number(store.programmes![0].price_zar), 450);

console.log('demo-shop-programme ok');
