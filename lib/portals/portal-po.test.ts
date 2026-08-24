/**
 * Run: npx --yes tsx lib/portals/portal-po.test.ts
 */
import assert from 'node:assert/strict';
import {
  portalPoTaxRate,
  suggestPortalPoNumber,
} from './portal-po';

assert.match(suggestPortalPoNumber('Boxer Superstores'), /^BOXERS-/);
assert.match(suggestPortalPoNumber(''), /^PO-/);
assert.equal(portalPoTaxRate('South Africa'), 15);
assert.equal(portalPoTaxRate('ZA'), 15);
assert.equal(portalPoTaxRate('Namibia'), 0);

console.log('portal-po.test.ts ok');
