/**
 * FleetAdvisor® permit details.
 * Run: npx --yes tsx lib/fleet/brief115-permits.test.ts
 */
import assert from 'node:assert/strict';
import { normaliseCountries, permitKinds, validatePermitDetail } from './permits';

assert.deepEqual(normaliseCountries('za, bw, ZA'), ['ZA', 'BW']);
assert.equal(normaliseCountries('Z'), null);
assert.equal(normaliseCountries(''), null);
assert.deepEqual(permitKinds(), ['cross_border_permit', 'abnormal_permit']);

const cross = validatePermitDetail('cross_border_permit', { countries: ['na', 'NA'], permit_class: 'Sample class' });
assert.equal(cross.ok, true);
if (cross.ok) assert.deepEqual(cross.detail.countries, ['NA']);

assert.equal(validatePermitDetail('cross_border_permit', { countries: [] }).ok, false);
assert.equal(validatePermitDetail('cross_border_permit', { countries: ['ZA'], permit_class: 'x'.repeat(41) }).ok, false);

const abnormal = validatePermitDetail('abnormal_permit', {
  province: 'Gauteng',
  route_text: 'Sample corridor',
  conditions: 'Sample conditions',
  escort_required: true,
});
assert.equal(abnormal.ok, true);
assert.equal(validatePermitDetail('abnormal_permit', { province: '', route_text: '', conditions: '', escort_required: false }).ok, false);
assert.equal(validatePermitDetail('abnormal_permit', { province: 'Gauteng', route_text: 'x'.repeat(501), conditions: '', escort_required: false }).ok, false);
assert.equal(validatePermitDetail('abnormal_permit', { province: 'Gauteng', route_text: '', conditions: 'x'.repeat(1001), escort_required: false }).ok, false);
assert.equal(validatePermitDetail('abnormal_permit', { province: 'Gauteng', route_text: '', conditions: '', escort_required: 'yes' }).ok, false);

assert.equal(validatePermitDetail('prdp', { category: 'g' }).ok, true);
assert.equal(validatePermitDetail('prdp', {}).ok, false);
assert.equal(validatePermitDetail('prdp', { category: 'X' }).ok, false);
assert.equal(validatePermitDetail('other', { note: 'free' }).ok, true);

console.log('brief115-permits.test.ts ok');
