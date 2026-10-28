/**
 * Delivery notes: numbering, partial quantities, no prices, revocable tokens, WhatsApp links.
 * Run: npx --yes tsx lib/customers/delivery-note.test.ts
 * Does not connect to a database.
 */
import assert from 'node:assert/strict';
import {
  assertNoCommercialFields,
  buildDeliveryNoteRecord,
  deliveryNoteNumber,
  deliveryNoteWhatsAppHref,
  deliveryNoteWhatsAppText,
  draftDeliveryLines,
  lineKey,
  readDeliveryNotes,
  toPublicDeliveryNote,
  writeDeliveryNotes,
  type DeliveryNoteRecord,
} from './delivery-note';
import { renderDeliveryNoteHtml } from './delivery-note-document';
import { buildDeliveryNotePdf } from './delivery-note-pdf';
import {
  buildDeliveryNoteToken,
  deliveryNoteTokenMatches,
  parseDeliveryNoteToken,
} from './delivery-note-token';

process.env.DOC_SHARE_SECRET = 'delivery-note-test-secret';

const items = [
  { name: 'House blend 1kg', sku: 'HB-1', quantity: 10, unit_price: 99.5, uom: 'bag' },
  { name: 'Oat milk 1L', quantity: 4, unit_price: 40, uom: 'case' },
];

assert.equal(deliveryNoteNumber('INV-1042', []), 'DN-INV-1042');
assert.equal(
  deliveryNoteNumber('INV-1042', [{ number: 'DN-INV-1042' }]),
  'DN-INV-1042-2'
);

const first = buildDeliveryNoteRecord({
  invoiceId: 7,
  invoiceNumber: 'INV-1042',
  customerName: 'Harbour Cafe',
  contactName: 'Ada Moyo',
  sellerName: 'Atlantic Roast Co',
  items,
  existing: [],
  input: {
    deliveredBy: 'Sam Nkosi',
    vehicleReg: 'CA 123-456',
    deliveryAddress: 'Warehouse 3, Duncan Road',
    lines: [{ key: lineKey(0, 'HB-1', 'House blend 1kg'), deliveredQty: 6 }],
  },
  id: 'dn_test',
  nonce: 'nonce-one-aaaa',
  now: new Date('2026-10-28T08:00:00.000Z'),
});
assert.equal(first.ok, true);
if (!first.ok) throw new Error('expected note');
assert.equal(first.note.number, 'DN-INV-1042');
assert.equal(first.note.lines.length, 2);
assert.equal(first.note.lines[0].delivered_qty, 6);
assert.equal(first.note.lines[0].invoiced_qty, 10);
assert.equal(first.note.lines[1].delivered_qty, 4);
assert.equal(JSON.stringify(first.note).includes('unit_price'), false);
assert.equal(JSON.stringify(first.note).includes('99.5'), false);
assert.equal(JSON.stringify(first.note).includes('subtotal'), false);

const meta = writeDeliveryNotes(
  { finance_invoice_id: 9, trade_thread: { stage: 'invoiced' } },
  [first.note]
);
assert.equal(meta.finance_invoice_id, 9);
assert.equal((meta.trade_thread as { stage: string }).stage, 'invoiced');
assert.equal(readDeliveryNotes(meta)[0].number, 'DN-INV-1042');

const drafts = draftDeliveryLines(items, [first.note]);
assert.equal(drafts[0].remainingQty, 4);
assert.equal(drafts[0].deliveredQty, 4);
assert.equal(drafts[1].remainingQty, 0);

const second = buildDeliveryNoteRecord({
  invoiceId: 7,
  invoiceNumber: 'INV-1042',
  items,
  existing: [first.note],
  input: {},
  id: 'dn_test_2',
  nonce: 'nonce-two-bbbb',
});
assert.equal(second.ok, true);
if (!second.ok) throw new Error('expected second note');
assert.equal(second.note.number, 'DN-INV-1042-2');
assert.equal(second.note.lines.length, 1);
assert.equal(second.note.lines[0].delivered_qty, 4);

const over = buildDeliveryNoteRecord({
  invoiceId: 7,
  invoiceNumber: 'INV-1042',
  items,
  existing: [first.note],
  input: { lines: [{ key: drafts[0].key, deliveredQty: 5 }] },
});
assert.equal(over.ok, false);

const done = buildDeliveryNoteRecord({
  invoiceId: 7,
  invoiceNumber: 'INV-1042',
  items,
  existing: [first.note, second.note],
  input: {},
});
assert.equal(done.ok, false);

const view = toPublicDeliveryNote(first.note, {
  name: 'Atlantic Roast Co',
  address: '14 Jetty Street',
  phone: '+27 21 555 0100',
  email: 'orders@example.com',
  logoUrl: 'javascript:alert(1)',
});
assert.equal(view.logoUrl, null);
assert.equal(view.partial, true);
assert.equal(view.customerName, 'Harbour Cafe');
assert.equal(view.invoiceNumber, 'INV-1042');
assert.deepEqual(Object.keys(view).sort(), [
  'contactName',
  'contactPhone',
  'customerName',
  'deliveredBy',
  'deliveryAddress',
  'deliveryDate',
  'invoiceNumber',
  'lines',
  'logoUrl',
  'notes',
  'number',
  'partial',
  'receivedByDate',
  'receivedByName',
  'sellerAddress',
  'sellerEmail',
  'sellerName',
  'sellerPhone',
  'vehicleReg',
].sort());
assertNoCommercialFields(view);
assert.equal(JSON.stringify(view).includes('unit_price'), false);

const html = renderDeliveryNoteHtml(view);
assert.match(html, /Delivery note/);
assert.match(html, /DN-INV-1042/);
assert.match(html, /INV-1042/);
assert.match(html, /Sam Nkosi/);
assert.match(html, /CA 123-456/);
assert.match(html, /Signature/);
assert.match(html, /SupplierAdvisor®/);
assert.match(html, /#00b4d8/);
assert.match(html, /not a tax invoice/);
assert.doesNotMatch(html, /unit price|subtotal|total due|bank details|account number|\bVAT\b|\bIBAN\b/i);
assert.equal(html.includes('99.5'), false);

const text = deliveryNoteWhatsAppText({
  customerName: 'Harbour Cafe',
  contactName: 'Ada Moyo',
  number: 'DN-INV-1042',
  invoiceNumber: 'INV-1042',
  viewUrl: 'https://www.supplieradvisor.com/d/abc',
  pdfUrl: 'https://www.supplieradvisor.com/api/public/delivery-note/pdf?token=abc',
});
assert.match(text, /Harbour Cafe/);
assert.match(text, /DN-INV-1042/);
assert.match(text, /Invoice ref: \*INV-1042\*/);
assert.match(text, /https:\/\/www\.supplieradvisor\.com\/d\/abc/);
assert.match(text, /SupplierAdvisor®/);
assert.doesNotMatch(text, /ZAR|VAT|bank|subtotal|unit price|99\.5/i);

const wa = deliveryNoteWhatsAppHref({ text, phone: '0825550142', mode: 'wa.me' });
const app = deliveryNoteWhatsAppHref({ text, phone: '0825550142', mode: 'whatsapp' });
assert.match(wa, /^https:\/\/wa\.me\/27825550142\?text=/);
assert.match(app, /^whatsapp:\/\/send\?phone=27825550142&text=/);
assert.match(decodeURIComponent(wa.split('text=')[1] || ''), /Harbour Cafe/);

const token = buildDeliveryNoteToken({
  companyId: 3,
  invoiceId: 7,
  noteId: first.note.id,
  nonce: first.note.nonce,
});
const parsed = parseDeliveryNoteToken(token);
assert.equal(parsed?.companyId, 3);
assert.equal(parsed?.invoiceId, 7);
assert.equal(deliveryNoteTokenMatches(first.note, parsed), true);
const revoked: DeliveryNoteRecord = {
  ...first.note,
  revoked_at: '2026-10-28T09:00:00.000Z',
  nonce: 'rotated-nonce',
};
assert.equal(deliveryNoteTokenMatches(revoked, parsed), false);
assert.equal(parseDeliveryNoteToken(`${token}x`), null);
assert.equal(
  parseDeliveryNoteToken(
    buildDeliveryNoteToken({
      companyId: 3,
      invoiceId: 7,
      noteId: first.note.id,
      nonce: first.note.nonce,
      ttlSeconds: -30,
    })
  ),
  null
);

async function pdfOk() {
  const pdf = await buildDeliveryNotePdf(view);
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(pdf.length > 800);
}

pdfOk()
  .then(() => {
    console.log('delivery-note.test.ts ok');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
