/**
 * Run: npx --yes tsx lib/accounting/party-book-role.test.ts
 */
import assert from 'node:assert/strict';
import {
  bookRoleFromMeta,
  bookRoleNeedsAp,
  bookRoleNeedsAr,
  parsePartyBookRole,
} from './party-book-role';
import { classifyCoaParty } from './party-roles';

assert.equal(parsePartyBookRole('customer'), 'customer');
assert.equal(parsePartyBookRole('supplier'), 'supplier');
assert.equal(parsePartyBookRole('both'), 'both');
assert.equal(parsePartyBookRole('nope'), null);

assert.equal(bookRoleNeedsAr('customer'), true);
assert.equal(bookRoleNeedsAr('supplier'), false);
assert.equal(bookRoleNeedsAr('both'), true);
assert.equal(bookRoleNeedsAp('customer'), false);
assert.equal(bookRoleNeedsAp('supplier'), true);
assert.equal(bookRoleNeedsAp('both'), true);

assert.equal(bookRoleFromMeta({ party_book_role: 'both' }), 'both');
assert.equal(bookRoleFromMeta({}), null);

assert.equal(
  classifyCoaParty({
    code: '1180',
    name: 'Customers',
    is_header: true,
    account_type: 'asset',
  }),
  'customer_ar'
);
assert.equal(
  classifyCoaParty({
    code: '2180',
    name: 'Suppliers',
    is_header: true,
    account_type: 'liability',
  }),
  'supplier_ap'
);

console.log('party-book-role tests ok');
