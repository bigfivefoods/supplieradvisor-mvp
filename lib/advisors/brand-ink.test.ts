/**
 * Run: npx --yes tsx lib/advisors/brand-ink.test.ts
 */
import assert from 'node:assert/strict';
import { advisorBrandInk, isLightBrand } from './brand-ink';

assert.equal(isLightBrand('#E8E830'), true);
assert.equal(advisorBrandInk('#E8E830'), '#0f172a');
assert.equal(isLightBrand('#0f172a'), false);
assert.equal(advisorBrandInk('#0f172a'), '#ffffff');
console.log('brand-ink tests ok');
