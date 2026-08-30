/**
 * Run: npx --yes tsx lib/suppliers/book-persist.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  emptyToNull,
  KELPACK_PINNED_PRODUCT_IDS,
  stripMissingUpdateColumn,
  supplierPatchUpdates,
} from './book-persist';
import { srmRecordToBookProfile } from './book-profile';
import { SUPPLIER_BOOK_COLUMNS, SUPPLIER_LIST_COLUMNS } from '../http/tenant-list';

assert.equal(emptyToNull(''), null);
assert.equal(emptyToNull('Plant lead'), 'Plant lead');

const prev = {
  party_book_role: 'supplier',
  required_documents: { vat_certificate_url: 'https://h/vat.pdf' },
  book_profile: { vat_number: 'OLD' },
};
const updates = supplierPatchUpdates(
  {
    job_title: 'Buyer liaison',
    website: 'https://kelpack.example',
    address: '1 Film Rd',
    payment_terms: 'Net 14',
    vat_number: '4190251605',
    province: 'KwaZulu-Natal',
    continent: 'Africa',
    city: 'Durban',
  },
  prev
);
assert.equal(updates.job_title, 'Buyer liaison');
assert.equal(updates.website, 'https://kelpack.example');
assert.equal(updates.address, '1 Film Rd');
assert.equal(updates.payment_terms, 'Net 14');
assert.equal(updates.vat_number, '4190251605');
assert.equal(updates.province, 'KwaZulu-Natal');
assert.equal(updates.region, 'KwaZulu-Natal');
assert.equal(updates.continent, 'Africa');
const meta = updates.metadata as Record<string, unknown>;
assert.equal(meta.party_book_role, 'supplier');
assert.equal(
  (meta.required_documents as { vat_certificate_url: string }).vat_certificate_url,
  'https://h/vat.pdf'
);
assert.equal((meta.book_profile as { vat_number: string }).vat_number, '4190251605');

const cleared = supplierPatchUpdates({ job_title: '', website: '' }, prev);
assert.equal(cleared.job_title, null);
assert.equal(cleared.website, null);

const stripped = stripMissingUpdateColumn(
  { job_title: 'x', vat_number: '419', website: 'https://a' },
  'column srm_suppliers.not_a_col does not exist'
);
assert.equal(stripped, null, 'do not drop vat/website when another column is missing');
const strippedVat = stripMissingUpdateColumn(
  { job_title: 'x', vat_number: '419' },
  'column vat_number does not exist'
);
assert.equal(strippedVat && 'vat_number' in strippedVat, false);
assert.equal(strippedVat?.job_title, 'x');

assert.match(SUPPLIER_BOOK_COLUMNS, /job_title/);
assert.match(SUPPLIER_BOOK_COLUMNS, /website/);
assert.match(SUPPLIER_BOOK_COLUMNS, /address/);
assert.match(SUPPLIER_BOOK_COLUMNS, /payment_terms/);
assert.match(SUPPLIER_BOOK_COLUMNS, /vat_number/);
assert.match(SUPPLIER_BOOK_COLUMNS, /continent/);
assert.match(SUPPLIER_BOOK_COLUMNS, /province/);
assert.doesNotMatch(SUPPLIER_LIST_COLUMNS, /job_title/);

const getSrc = readFileSync(resolve('app/api/suppliers/route.ts'), 'utf8');
assert.match(getSrc, /byId \? SUPPLIER_BOOK_COLUMNS : SUPPLIER_LIST_COLUMNS/);
assert.match(getSrc, /supplierPatchUpdates/);
assert.match(getSrc, /stripMissingUpdateColumn/);
assert.doesNotMatch(getSrc.split('export async function POST')[0], /select\('\*'\)/);
assert.doesNotMatch(
  getSrc,
  /delete soft\.(vat_number|registration_number|payment_terms)/
);

const saved = srmRecordToBookProfile({
  id: 12,
  trading_name: 'Kelpack Manufacturing (Pty) Ltd',
  job_title: 'Buyer liaison',
  website: 'https://kelpack.example',
  address: '1 Film Rd',
  payment_terms: 'Net 14',
  vat_number: '4190251605',
  province: 'KwaZulu-Natal',
  continent: 'Africa',
  city: 'Durban',
  country: 'South Africa',
  metadata: { book_profile: { vat_number: 'IGNORE', job_title: 'stale' } },
});
assert.equal(saved.job_title, 'Buyer liaison');
assert.equal(saved.website, 'https://kelpack.example');
assert.equal(saved.address, '1 Film Rd');
assert.equal(saved.payment_terms, 'Net 14');
assert.equal(saved.vat_number, '4190251605');
assert.equal(saved.province, 'KwaZulu-Natal');
assert.equal(saved.continent, 'Africa');

const clearedRow = srmRecordToBookProfile({
  id: 12,
  trading_name: 'Kelpack',
  job_title: null,
  website: null,
  metadata: { book_profile: { job_title: 'stale', website: 'https://stale' } },
});
assert.equal(clearedRow.job_title, '', 'column null wins over book_profile');
assert.equal(clearedRow.website, '');

assert.deepEqual(
  [...KELPACK_PINNED_PRODUCT_IDS],
  [2, 3, 4, 5, 6, 7, 8, 9, 42, 44, 45, 46]
);

const profile = readFileSync(
  resolve('components/suppliers/SupplierBookProfile.tsx'),
  'utf8'
);
assert.doesNotMatch(profile, /onSaved\(\{[\s\S]{0,200}\.\.\.form/);
assert.match(profile, /onSaved\(saved && saved\.id \? saved : supplier\)/);

console.log('book-persist.test.ts ok');
