/**
 * Run: npx --yes tsx lib/hire/wallet-stamp.test.ts
 */
import assert from 'node:assert/strict';
import {
  applyWalletToHirePortal,
  emptyHiregraphStore,
  issueCustomerPortal,
} from './hiregraph';

let store = emptyHiregraphStore();
const issued = issueCustomerPortal(store, 88, {
  companyId: 1,
  invite_email: 'old@example.com',
});
store = issued.store;

const stamped = applyWalletToHirePortal(store, 88, {
  user_id: 'did:privy:abc',
  full_name: 'Craig Member',
  email: 'craig@example.com',
  phone: '0820000000',
  photo_url: 'https://example.com/me.jpg',
  city: 'Sandton',
  id_number: '8001015009087',
  identity: {
    status: 'verified',
    provider: 'verifynow',
    verified_name: 'Craig Member',
  },
});

assert.equal(stamped.changed, true);
assert.equal(stamped.portal.display_name, 'Craig Member');
assert.equal(stamped.portal.preferred_email, 'craig@example.com');
assert.equal(stamped.portal.photo_url, 'https://example.com/me.jpg');
assert.equal(stamped.portal.identity?.status, 'verified');
assert.ok(stamped.store.customer_kyc['88'].includes('id_document'));
assert.ok(stamped.store.customer_kyc['88'].includes('age_18_plus'));

console.log('wallet-stamp.test.ts ok');
