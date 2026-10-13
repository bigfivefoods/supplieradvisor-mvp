/**
 * Run: npx --yes tsx lib/relationship/profile-dossier.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { crmPreviewBook, crmPreviewCommerce, customerActivity } from '../customers/crm-preview';
import {
  customerDossier,
  customerLedgerLines,
  dossierSection,
  EMPTY_FIELD,
  mailHref,
  supplierDossier,
  supplierLedgerLines,
  telHref,
} from './profile-dossier';
import { srmPreviewBook } from '../suppliers/srm-preview';

const book = crmPreviewBook('2026-10-13');
const harbour = book.customers[0];
assert.ok(harbour);
const pack = crmPreviewCommerce(harbour.id);
const dossier = customerDossier(harbour, {
  lines: customerLedgerLines({
    quotes: pack.quotes,
    orders: pack.orders,
    invoices: pack.invoices,
    customerId: harbour.id,
  }),
  openAr: pack.openAr,
  activity: customerActivity({
    name: harbour.trading_name,
    created_at: harbour.created_at,
    notes: harbour.notes,
    invite_status: harbour.invite_status,
    contact_name: harbour.contact_name,
    city: harbour.city,
  }),
});

assert.deepEqual(
  dossier.sections.map((section) => section.id),
  [
    'identity',
    'contacts',
    'addresses',
    'registration',
    'commercial',
    'credit',
    'ledger',
    'documents',
    'activity',
    'notes',
  ]
);
assert.equal(dossier.fullLabel, 'Open Customer 360');
assert.match(dossier.fullHref, /360\?id=-1/);

const contacts = dossierSection(dossier, 'contacts');
assert.ok(contacts);
assert.equal(contacts.people.length, 2);
assert.equal(mailHref(contacts.people[0]?.email), 'mailto:thandi@harbourandco.example');
assert.equal(telHref(contacts.people[0]?.phone), 'tel:+27215550142');

const registration = dossierSection(dossier, 'registration');
assert.equal(registration?.facts.find((fact) => fact.label === 'B-BBEE level')?.value, 'Level 2');
assert.equal(registration?.facts.find((fact) => fact.label === 'VAT number')?.value, '4900000000');

const credit = dossierSection(dossier, 'credit');
assert.equal(credit?.facts.find((fact) => fact.label === 'Credit hold')?.value, 'No');
assert.ok(credit?.facts.find((fact) => fact.label === 'Open balance')?.value);

const ledger = dossierSection(dossier, 'ledger');
assert.ok(ledger && ledger.lines.length >= 3);
assert.ok(ledger.lines.some((line) => line.number === 'QT-2041'));
assert.ok(ledger.lines.some((line) => line.kind === 'invoice'));

const notes = dossierSection(dossier, 'notes');
assert.match(notes?.note || '', /Super-Cube®/);
assert.ok(notes?.tags.includes('Key account'));

const sparse = book.customers.find((row) => row.id === -2);
assert.ok(sparse);
const sparseDossier = customerDossier(sparse, { lines: [], openAr: 0 });
const sparseReg = dossierSection(sparseDossier, 'registration');
assert.equal(sparseReg?.facts.find((fact) => fact.label === 'VAT number')?.value, null);
assert.equal(dossierSection(sparseDossier, 'ledger')?.lines.length, 0);
assert.equal(dossierSection(sparseDossier, 'ledger')?.empty.includes('No quotes'), true);
assert.equal(sparseDossier.stats.find((stat) => stat.label === 'Credit')?.value, EMPTY_FIELD);

const suppliers = srmPreviewBook('2026-10-13');
const kelpac = suppliers.suppliers[0];
assert.ok(kelpac);
const supplierView = supplierDossier(kelpac, {
  lines: supplierLedgerLines(suppliers.purchaseOrders, kelpac.id),
  scorecard: suppliers.scorecards[0],
  vault: [],
});
assert.ok(supplierView.sections.some((section) => section.id === 'scorecard'));
assert.equal(
  dossierSection(supplierView, 'scorecard')?.facts.find((fact) => fact.label === 'On time')?.value,
  '98%'
);
assert.ok(dossierSection(supplierView, 'ledger')?.lines.some((line) => line.number === 'PO-4410'));
assert.equal(
  supplierLedgerLines(suppliers.purchaseOrders, -12).length,
  0
);
const noord = suppliers.suppliers[1];
assert.ok(noord);
const noordView = supplierDossier(noord);
assert.equal(
  dossierSection(noordView, 'contacts')?.people[0]?.email,
  null
);
assert.equal(dossierSection(noordView, 'scorecard')?.facts.find((fact) => fact.label === 'OTIFEF')?.value, null);

const sheet = readFileSync(resolve('components/relationship/ProfileSheet.tsx'), 'utf8');
assert.match(sheet, /aria-modal="true"/);
assert.match(sheet, /Escape/);
assert.match(sheet, /text-slate-950/);
assert.match(sheet, /#00b4d8/);
assert.doesNotMatch(sheet, /#0099b8/);
assert.doesNotMatch(sheet, /bg-\[#00b4d8\][^"'`]*text-white/);

const network = readFileSync(resolve('app/dashboard/suppliers/network/page.tsx'), 'utf8');
assert.doesNotMatch(network, /otifef\?[^`'"]*persist/);

console.log('relationship/profile-dossier.test.ts ok');
