/**
 * Run: npx --yes tsx lib/fx/types.test.ts
 */
import assert from 'node:assert/strict';
import { formatZarPair, rateToZar } from './types';

const usdRates = { USD: 1, ZAR: 18.5, EUR: 0.92, GBP: 0.79 };

assert.equal(rateToZar('USD', usdRates), 18.5);
assert.ok(Math.abs((rateToZar('EUR', usdRates) ?? 0) - 18.5 / 0.92) < 1e-10);
assert.ok(Math.abs((rateToZar('GBP', usdRates) ?? 0) - 18.5 / 0.79) < 1e-10);
assert.equal(rateToZar('KES', usdRates), null);
assert.equal(rateToZar('USD', {}), null);

assert.equal(formatZarPair('USD', 18.5), 'USD:ZAR (1:18.5000)');
assert.equal(formatZarPair('GBP', null), 'GBP:ZAR (1:—)');

console.log('fx types ok');
