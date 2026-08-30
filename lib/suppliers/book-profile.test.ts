/**
 * Run: npx --yes tsx lib/suppliers/book-profile.test.ts
 */
import assert from 'node:assert/strict';
import {
  srmBookProfileGaps,
  srmPortalDocuments,
  srmRecordToBookProfile,
} from './book-profile';

assert.deepEqual(srmBookProfileGaps(null), [
  'Trading name',
  'Contact name',
  'Email',
  'Phone',
  'City',
  'Country',
]);

const row = {
  id: 9,
  trading_name: 'Kelpac',
  legal_name: 'Kelpac Pty',
  contact_name: 'Sam',
  job_title: 'Plant lead',
  email: 'sam@kelpac.test',
  phone: '021',
  website: 'https://kelpac.test',
  continent: 'Africa',
  province: 'Western Cape',
  city: 'Cape Town',
  country: 'South Africa',
  industry: 'Packaging & Materials',
  address: '12 Pack St',
  metadata: {
    book_profile: {
      vat_number: 'VAT123',
      registration_number: 'REG9',
      payment_terms: 'Net 30',
    },
    required_documents: {
      vat_certificate_url: 'https://files.test/vat.pdf',
    },
  },
};

const profile = srmRecordToBookProfile(row);
assert.equal(profile.trading_name, 'Kelpac');
assert.equal(profile.vat_number, 'VAT123');
assert.equal(profile.registration_number, 'REG9');
assert.equal(profile.payment_terms, 'Net 30');
assert.equal(profile.job_title, 'Plant lead');
assert.equal(profile.continent, 'Africa');
assert.equal(profile.province, 'Western Cape');
assert.deepEqual(srmBookProfileGaps(profile), []);

const columnWins = srmRecordToBookProfile({
  id: 12,
  trading_name: 'Kelpack',
  job_title: null,
  website: '',
  metadata: { book_profile: { job_title: 'stale', website: 'https://stale' } },
});
assert.equal(columnWins.job_title, '');
assert.equal(columnWins.website, '');

const docs = srmPortalDocuments(row);
assert.equal(
  docs.find((d) => d.field === 'vat_certificate_url')?.url,
  'https://files.test/vat.pdf'
);
assert.equal(
  docs.find((d) => d.field === 'bank_confirmation_url')?.url,
  null
);

console.log('book-profile.test.ts ok');
