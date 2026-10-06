import assert from 'node:assert/strict';
import { COMPANY_INDUSTRIES } from '../business/industries';
import { DEFAULT_PAYMENT_TERMS_OPTIONS } from '../business/types';
import {
  economicSectorForOsSector,
  governmentWorkspaceSeed,
  registrationProfileFacts,
} from './register-profile';

assert.equal(economicSectorForOsSector('primary'), 'primary');
assert.equal(economicSectorForOsSector('public_sector'), 'quinary');
assert.equal(economicSectorForOsSector('nope'), null);

for (const seed of [
  governmentWorkspaceSeed('national'),
  governmentWorkspaceSeed('provincial'),
  governmentWorkspaceSeed('municipal'),
  governmentWorkspaceSeed('government_education'),
  governmentWorkspaceSeed('government_health'),
]) {
  assert.ok(seed);
  for (const name of seed!.catalogue) {
    assert.ok(COMPANY_INDUSTRIES.includes(name), name);
  }
}
assert.equal(governmentWorkspaceSeed('private'), null);

const facts = registrationProfileFacts({
  catalogueIndustries: [
    'Agriculture — field crops',
    'Not a real industry',
    'Agriculture — field crops',
  ],
  subIndustries: ['Maize', 'Gold', ''],
  fallbackIndustries: ['Agriculture & farming'],
  vatNumber: '  ',
  website: ' https://example.com ',
  shortDescription: ' Mill and pack maize. ',
  country: 'South Africa',
  city: 'Polokwane',
  province: 'Limpopo',
  continent: 'Africa',
  street: '12 Industrial Rd',
  postalCode: '0699',
  currency: 'usd',
  paymentTerms: 'Net 14',
});

assert.deepEqual(facts.industries, ['Agriculture — field crops']);
assert.equal(facts.industry, 'Agriculture — field crops');
assert.deepEqual(facts.sub_industries, ['Maize']);
assert.equal(facts.sub_industry, 'Maize');
assert.equal(facts.vat_number, null);
assert.equal(facts.website, 'https://example.com');
assert.equal(facts.description, 'Mill and pack maize.');
assert.equal(facts.street, '12 Industrial Rd');
assert.equal(facts.address, '12 Industrial Rd');
assert.equal(facts.region, 'Limpopo');
assert.equal(facts.primary_currency, 'USD');
assert.equal(facts.settings.defaultPaymentTerms, 'Net 14');
assert.deepEqual(facts.settings.paymentTermsOptions, [...DEFAULT_PAYMENT_TERMS_OPTIONS]);

const fallback = registrationProfileFacts({
  catalogueIndustries: ['nope'],
  fallbackIndustries: ['Food & beverage manufacturing'],
  currency: 'BTC',
  paymentTerms: 'Whenever',
});
assert.deepEqual(fallback.industries, ['Food & beverage manufacturing']);
assert.equal(fallback.primary_currency, 'ZAR');
assert.equal(fallback.settings.defaultPaymentTerms, 'Net 30');
assert.equal(fallback.sub_industries, null);

console.log('onboarding/register-profile.test.ts ok');
