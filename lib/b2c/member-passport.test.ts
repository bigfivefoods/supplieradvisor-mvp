/**
 * Run: npx --yes tsx lib/b2c/member-passport.test.ts
 */
import assert from 'node:assert/strict';
import {
  formatAddress,
  formatEmergencyContact,
  parseMemberPassport,
  passportCompleteness,
} from './member-passport';

const empty = parseMemberPassport(null);
assert.equal(empty.country, 'South Africa');
assert.equal(empty.share_health_with_advisors, true);
assert.equal(passportCompleteness(empty).score, 0);

const filled = parseMemberPassport({
  date_of_birth: '1990-02-01T00:00:00.000Z',
  address_line1: '12 Main Rd',
  city: 'Cape Town',
  emergency_name: 'Sam',
  emergency_phone: '0820000000',
  emergency_relationship: 'spouse',
  allergies: 'None',
});
assert.equal(filled.date_of_birth, '1990-02-01');
assert.equal(passportCompleteness(filled).score, 4);
assert.equal(
  formatEmergencyContact(filled),
  'Sam (spouse) · 0820000000'
);
assert.ok(formatAddress(filled)?.includes('12 Main Rd'));

console.log('member-passport.test.ts ok');
