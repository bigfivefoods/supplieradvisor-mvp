/**
 * Run: npx --yes tsx lib/b2c/wallet-household.test.ts
 */
import assert from 'node:assert/strict';
import {
  applySnapshotToPerson,
  familyFingerprint,
  isPlaceholderName,
  mergeFamilyLists,
  type WalletHouseholdSnapshot,
} from './wallet-household';
import type { FamilyMember } from '@/lib/services/family-members';

const fam = (
  id: string,
  name: string,
  extras: Partial<FamilyMember> = {}
): FamilyMember => ({
  id,
  name,
  relationship: extras.relationship || 'child',
  date_of_birth: extras.date_of_birth ?? '2018-05-01',
  id_number: extras.id_number,
  phone: extras.phone,
  email: extras.email,
  notes: extras.notes,
  is_minor: extras.is_minor ?? true,
  active: extras.active !== false,
  created_at: extras.created_at || '2026-01-01T00:00:00.000Z',
  updated_at: extras.updated_at || '2026-01-01T00:00:00.000Z',
});

assert.equal(isPlaceholderName(''), true);
assert.equal(isPlaceholderName('Member'), true);
assert.equal(isPlaceholderName('craig@bigfivefoods.com'), true);
assert.equal(isPlaceholderName('Craig Richardson'), false);

const vuka = [fam('fam_1', 'Alex', { relationship: 'child' })];
const empty: FamilyMember[] = [];
const merged = mergeFamilyLists(empty, vuka);
assert.equal(merged.length, 1);
assert.equal(merged[0].name, 'Alex');
assert.equal(merged[0].id, 'fam_1');

const richer = mergeFamilyLists(vuka, [
  fam('fam_1', 'Alex', { id_number: '123', phone: '082' }),
]);
assert.equal(richer[0].id_number, '123');
assert.equal(richer[0].phone, '082');

const samePersonNewId = mergeFamilyLists(vuka, [
  fam('fam_other', 'Alex', { relationship: 'child' }),
]);
assert.equal(samePersonNewId.length, 1);
assert.equal(samePersonNewId[0].id, 'fam_1');

const spouse = mergeFamilyLists(vuka, [
  fam('fam_2', 'Sam', { relationship: 'spouse', is_minor: false }),
]);
assert.equal(spouse.length, 2);

const snap: WalletHouseholdSnapshot = {
  full_name: 'Craig Richardson',
  email: 'craig@bigfivefoods.com',
  phone: '0820000000',
  photo_url: 'https://cdn.example/craig.jpg',
  city: 'Johannesburg',
  id_number: '8001015009087',
  family: vuka,
  passport: { city: 'Johannesburg', country: 'South Africa' },
};

const stamped = applySnapshotToPerson(
  {
    id: 'pat_new',
    name: 'Member',
    email: 'craig@bigfivefoods.com',
    family: [],
  },
  snap,
  { preferWallet: true }
);
assert.equal(stamped.changed, true);
assert.equal(stamped.person.name, 'Craig Richardson');
assert.equal(stamped.person.phone, '0820000000');
assert.equal(stamped.person.photo_url, 'https://cdn.example/craig.jpg');
assert.equal(stamped.person.id_number, '8001015009087');
assert.equal(stamped.person.family?.length, 1);
assert.equal(stamped.person.family?.[0].name, 'Alex');

const already = applySnapshotToPerson(stamped.person, snap, {
  preferWallet: true,
});
assert.equal(already.changed, false);

const dropped = applySnapshotToPerson(
  {
    id: 'pat_old',
    name: 'Craig Richardson',
    family: [
      fam('fam_1', 'Alex'),
      fam('fam_gone', 'Old entry', { relationship: 'other' }),
    ],
  },
  { ...snap, family: vuka },
  { preferWallet: true }
);
assert.equal(dropped.person.family?.length, 1);
assert.equal(dropped.person.family?.[0].id, 'fam_1');
assert.equal(
  familyFingerprint(already.person.family),
  familyFingerprint(snap.family)
);

const medical = applySnapshotToPerson(
  {
    id: 'pat_med',
    name: 'Craig',
    medical: { allergies: 'none' },
  },
  snap,
  { preferWallet: true }
);
assert.equal(medical.person.medical?.id_number, '8001015009087');

console.log('wallet-household tests ok');
