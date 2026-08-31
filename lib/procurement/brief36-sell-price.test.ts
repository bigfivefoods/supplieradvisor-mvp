/**
 * Brief 36 gun 1 — never seed sell_price from cost.
 * Run: npx --yes tsx lib/procurement/brief36-sell-price.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const receive = readFileSync(resolve('lib/procurement/receive-from-po.ts'), 'utf8');
assert.doesNotMatch(receive, /sell_price\s*=\s*unitCost/);
assert.doesNotMatch(receive, /insertRow\.sell_price/);
assert.match(receive, /insertRow\.cost_price\s*=\s*unitCost/);

const imp = readFileSync(
  resolve('app/api/inventory/products/import-from-network/route.ts'),
  'utf8'
);
assert.doesNotMatch(imp, /1\.25/);
assert.doesNotMatch(imp, /cost\s*\*\s*1\.25/);
assert.match(imp, /body\.sell_price/);
assert.match(imp, /suggestedResale/);
assert.doesNotMatch(imp, /sell_price:\s*cost/);
assert.doesNotMatch(imp, /sell_price\s*=\s*cost/);

console.log('brief36-sell-price.test.ts ok');
