/**
 * Delivery note flow starts collapsed.
 * Run: npx --yes tsx lib/customers/delivery-note-ui.test.tsx
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DeliveryNoteFlow from '../../components/customers/DeliveryNoteFlow';
import DeliveryNotePublicView from '../../components/customers/DeliveryNotePublicView';
import { SAMPLE_DELIVERY_NOTE } from './delivery-note-sample';

const flow = renderToStaticMarkup(createElement(DeliveryNoteFlow));
assert.match(flow, /aria-expanded="false"/);
assert.equal(flow.includes('aria-expanded="true"'), false);
assert.match(flow, /aria-controls="delivery-note-flow"/);
assert.match(flow, /id="delivery-note-flow"/);
assert.match(flow, /hidden/);
assert.match(flow, /Delivery note flow/);
assert.match(flow, /Share the public link on WhatsApp/);

const page = renderToStaticMarkup(
  createElement(DeliveryNotePublicView, {
    note: SAMPLE_DELIVERY_NOTE,
    pdfHref: '/api/public/delivery-note/pdf?token=sample',
  })
);
assert.match(page, /DN-INV-1042/);
assert.match(page, /Harbour Cafe/);
assert.match(page, /INV-1042/);
assert.match(page, /SupplierAdvisor®/);
assert.match(page, /Download PDF/);
assert.match(page, /Received by/);
assert.match(page, /Signature/);
assert.doesNotMatch(page, /unit price|subtotal|total due|bank|VAT|ZAR/i);
assert.equal(page.includes('99'), false);

console.log('delivery-note-ui.test.tsx ok');
