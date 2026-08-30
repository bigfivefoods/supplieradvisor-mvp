/**
 * Run: npx --yes tsx lib/procurement/po-document-pdf.test.ts
 */
import assert from 'node:assert/strict';
import { buildPurchaseOrderPdf, partyDetailLines } from './po-document-pdf';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const lines = partyDetailLines({
  name: 'Big Five Foods',
  legal_name: 'Big Five Foods (Pty) Ltd',
  vat_number: '4123456789',
  address: '12 Packer Road',
  city: 'Johannesburg',
  country: 'South Africa',
  website: 'https://bigfivefoods.com',
});
assert.ok(lines.some((l) => l.includes('Big Five Foods (Pty) Ltd')));
assert.ok(lines.some((l) => l.includes('VAT 4123456789')));
assert.ok(lines.some((l) => l.includes('12 Packer Road')));

function pdfVisibleText(buf: Buffer): string {
  const raw = buf.toString('latin1');
  const parts: string[] = [];
  const hex = /<([0-9a-fA-F]+)>/g;
  let m: RegExpExecArray | null;
  while ((m = hex.exec(raw))) {
    if (m[1].length < 2 || m[1].length % 2 !== 0) continue;
    parts.push(Buffer.from(m[1], 'hex').toString('latin1'));
  }
  return parts.join('');
}

async function main() {
const buf = await buildPurchaseOrderPdf({
  number: 'PO-41',
  issuedAt: '2026-08-29',
  promisedDate: '2026-09-05',
  paymentTerms: 'Net 30',
  currency: 'ZAR',
  items: [
    {
      item_name: 'Sleeves',
      sku: 'SLV-1',
      quantity: 10,
      unit_price: 13000,
      uom: 'ea',
    },
  ],
  totalAmount: 130000,
  buyer: {
    name: 'Big Five Foods',
    legal_name: 'Big Five Foods (Pty) Ltd',
    vat_number: '4123456789',
    address: '12 Packer Road',
    city: 'Johannesburg',
    country: 'ZA',
    email: 'craig@bigfivefoods.com',
    phone: '011 000 0000',
  },
  supplier: {
    name: 'Kelpack Manufacturing',
    contact_name: 'Thandi',
    city: 'Cape Town',
    country: 'ZA',
    email: 'kelpack@example.com',
    legal_name: 'Kelpack Manufacturing (Pty) Ltd',
    vat_number: '4987654321',
  },
});
const text = pdfVisibleText(buf);
assert.match(text, /PURCHASE ORDER/);
assert.match(text, /not a tax invoice/i);
assert.doesNotMatch(text, /Tax Invoice/);
assert.match(text, /Big Five Foods/);
assert.match(text, /4123456789/);
assert.match(text, /12 Packer Road/);
assert.match(text, /Kelpack/);
assert.match(text, /Cape Town/);
assert.match(text, /Thandi/);
assert.match(text, /Powered by SupplierAdvisor/);
assert.match(text, /www\.supplieradvisor\.com/);
assert.ok(buf.length > 800);

const noLogo = await buildPurchaseOrderPdf({
  number: 'PO-42',
  items: [],
  totalAmount: 0,
  buyer: { name: 'Buyer Co' },
  supplier: { name: 'Supplier Co' },
});
assert.ok(noLogo.length > 400);
assert.match(pdfVisibleText(noLogo), /Powered by SupplierAdvisor/);
}

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}
const send = src('app/api/suppliers/purchase-orders/send/route.ts');
assert.doesNotMatch(send, /from\('profiles'\)[\s\S]{0,400}phone,/);
assert.match(send, /assemblePurchaseOrderPdfInput/);
assert.doesNotMatch(send, /\.select\([^)]*phone/);
assert.doesNotMatch(src('lib/procurement/po-parties.ts'), /SAFE_PROFILE_COLUMNS[\s\S]{0,200}\bphone\b/);
assert.match(src('lib/procurement/po-parties.ts'), /contact_phone/);
assert.match(src('lib/procurement/po-parties.ts'), /legal_name/);
assert.match(src('lib/procurement/po-parties.ts'), /vat_number/);

const desk = src('app/dashboard/suppliers/po/PoDesk.tsx');
assert.match(desk, /Email PO/);
assert.match(desk, /Mark accepted/);
assert.match(desk, /Receive into stock/);
assert.doesNotMatch(desk, /window\.prompt/);
assert.match(desk, /Save & email/);
assert.match(desk, /Books on accept/);
assert.match(desk, /accounts-payable\?fromPo=/);
assert.match(desk, /Received/);
assert.match(desk, /Advanced/);
assert.match(desk, /Download PDF/);
assert.match(desk, /Stock received/);
assert.match(desk, /Create supplier invoice/);
assert.doesNotMatch(desk, /customers\/invoices\?fromPo=/);

const parties = src('lib/procurement/po-parties.ts');
assert.match(parties, /legal_name/);
assert.match(parties, /vat_number/);
assert.match(parties, /srmPartyIdForAp/);
assert.doesNotMatch(parties, /from\('profiles'\)[\s\S]{0,200}\bphone\b/);

const pdfRoute = src('app/api/suppliers/purchase-orders/pdf/route.ts');
assert.match(pdfRoute, /assemblePurchaseOrderPdfInput/);
assert.match(pdfRoute, /buildPurchaseOrderPdf/);

const portal = src('app/api/public/portals/trade/act/route.ts');
assert.match(portal, /buyer_profile_id: buyerProfileId/);

const apPage = src('app/dashboard/accounting/accounts-payable/page.tsx');
assert.match(apPage, /fromPoId/);

main()
  .then(() => {
    console.log('po-document-pdf Brief 16 tests ok');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
