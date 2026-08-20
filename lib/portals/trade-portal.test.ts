/**
 * Run: npx --yes tsx lib/portals/trade-portal.test.ts
 */
import assert from 'node:assert/strict';
import {
  isTradePortalKind,
  newPortalToken,
  normalizeSections,
  portalPublicPath,
  DEFAULT_PORTAL_SECTIONS,
} from './trade-portal';

assert.equal(isTradePortalKind('customer'), true);
assert.equal(isTradePortalKind('supplier'), true);
assert.equal(isTradePortalKind('gym'), false);

const portalTok = newPortalToken('portal');
const viewerTok = newPortalToken('viewer');
assert.match(portalTok, /^tp_[a-f0-9]{36}$/);
assert.match(viewerTok, /^tv_[a-f0-9]{36}$/);
assert.notEqual(portalTok, newPortalToken('portal'));
assert.equal(portalPublicPath(viewerTok), `/portal/${encodeURIComponent(viewerTok)}`);

const sections = normalizeSections({ quotes: false, leftover: true });
assert.equal(sections.quotes, false);
assert.equal(sections.invoices, DEFAULT_PORTAL_SECTIONS.invoices);
assert.equal((sections as { leftover?: boolean }).leftover, undefined);

console.log('trade-portal.test.ts ok');
