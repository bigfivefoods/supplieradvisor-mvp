/**
 * Run: npx --yes tsx lib/accounting/ecl-types.test.ts
 */
import assert from 'node:assert/strict';
import { agingBucket, normalizeEclRates } from './ecl-types';

assert.equal(agingBucket(-5), 'current');
assert.equal(agingBucket(0), 'current');
assert.equal(agingBucket(1), 'd1_30');
assert.equal(agingBucket(30), 'd1_30');
assert.equal(agingBucket(31), 'd31_60');
assert.equal(agingBucket(90), 'd61_90');
assert.equal(agingBucket(91), 'd90_plus');

const rates = normalizeEclRates({ current: 2, d90_plus: 40, d1_30: -1 as unknown as number });
assert.equal(rates.current, 2);
assert.equal(rates.d90_plus, 40);
assert.equal(rates.d1_30, 2);

console.log('ecl-types ok');
