/**
 * Run: npx --yes tsx lib/portals/book-profile.test.ts
 */
import assert from 'node:assert/strict';
import { bookProfileGaps, type BookProfile } from './trade-portal-workspace';

assert.deepEqual(bookProfileGaps(null), [
  'Trading name',
  'Contact name',
  'Email',
  'Phone',
  'City',
  'Country',
]);

const full: BookProfile = {
  trading_name: 'Acme',
  legal_name: 'Acme Pty',
  contact_name: 'Pat',
  job_title: 'Buyer',
  email: 'pat@acme.test',
  phone: '011',
  website: '',
  vat_number: '',
  registration_number: '',
  address: '',
  city: 'Johannesburg',
  country: 'ZA',
  payment_terms: '',
  industry: '',
};
assert.deepEqual(bookProfileGaps(full), []);

assert.deepEqual(bookProfileGaps({ ...full, email: '  ', phone: '' }), [
  'Email',
  'Phone',
]);

console.log('book-profile.test.ts ok');
