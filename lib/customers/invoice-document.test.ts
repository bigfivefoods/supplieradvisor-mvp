/**
 * Run: npx --yes tsx lib/customers/invoice-document.test.ts
 */
import assert from 'node:assert/strict';
import {
  renderCommercialDocumentHtml,
  resolveCustomerVatNumber,
  type DocRenderInput,
} from './invoice-document';

assert.equal(
  resolveCustomerVatNumber({ vat_number: '4123456789' }),
  '4123456789'
);
assert.equal(
  resolveCustomerVatNumber({ vat_number: '  ' }, {}, { vat_number: '4987654321' }),
  '4987654321'
);
assert.equal(
  resolveCustomerVatNumber(null, { customer_vat_number: '4111222333' }),
  '4111222333'
);
assert.equal(resolveCustomerVatNumber({ trading_name: 'Acme' }), null);

const base: DocRenderInput = {
  kind: 'invoice',
  number: 'INV-1',
  customerName: 'Acme Foods',
  contactName: 'Ada',
  items: [],
  subtotal: 100,
  taxRate: 15,
  taxAmount: 15,
  totalAmount: 115,
  seller: { trading_name: 'Seller Co', vat_number: '4000000000' },
};

const withBuyerVat = renderCommercialDocumentHtml({
  ...base,
  customerVatNumber: '4123456789',
});
assert.match(withBuyerVat, /Bill to/);
assert.match(withBuyerVat, /VAT<\/strong> 4123456789/);

const withoutBuyerVat = renderCommercialDocumentHtml(base);
assert.doesNotMatch(withoutBuyerVat, /Bill to[\s\S]*VAT<\/strong>/);

console.log('invoice-document.test.ts ok');
