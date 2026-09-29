/**
 * Run: npx --yes tsx lib/portals/trade-portal.test.ts
 */
import assert from 'node:assert/strict';
import {
  isTradePortalKind,
  newPortalToken,
  normalizeSections,
  portalPublicPath,
  customerPortalDocPdfHref,
  customerPortalInvoicePdfHref,
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
assert.equal(
  customerPortalInvoicePdfHref('tv_abc', 12),
  '/api/public/portals/trade/invoice-pdf?token=tv_abc&id=12'
);
assert.equal(
  customerPortalDocPdfHref('tv_abc', 9, 'quote'),
  '/api/public/portals/trade/doc-pdf?token=tv_abc&id=9&type=quote'
);
assert.equal(
  customerPortalDocPdfHref('tv_abc', 4, 'order'),
  '/api/public/portals/trade/doc-pdf?token=tv_abc&id=4&type=order'
);

const sections = normalizeSections({ quotes: false, leftover: true });
assert.equal(sections.quotes, false);
assert.equal(sections.invoices, DEFAULT_PORTAL_SECTIONS.invoices);
assert.equal(DEFAULT_PORTAL_SECTIONS.projects, true);
assert.equal((sections as { leftover?: boolean }).leftover, undefined);

console.log('trade-portal.test.ts ok');
