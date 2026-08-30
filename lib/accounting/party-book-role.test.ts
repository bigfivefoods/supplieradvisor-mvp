/**
 * Run: npx --yes tsx lib/accounting/party-book-role.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

const bookSrc = readFileSync(resolve('lib/accounting/party-book-role.ts'), 'utf8');
const afterStamps =
  bookSrc.split('if (supplierId) {\n    const stamped = await stampBookRole')[1] ||
  '';
assert.doesNotMatch(
  afterStamps,
  /ensureCustomerArLeaf/,
  'no unconditional AR leaf after stamps'
);
assert.doesNotMatch(
  afterStamps,
  /ensureSupplierApLeaf/,
  'no unconditional AP leaf after stamps'
);
assert.match(bookSrc, /bookRoleNeedsAr\(role\) && customerId/);
assert.match(bookSrc, /bookRoleNeedsAp\(role\) && supplierId/);
assert.match(bookSrc, /is_active: opts.active/);

const partiesPost = readFileSync(
  resolve('app/api/accounting/parties/route.ts'),
  'utf8'
);
assert.match(partiesPost, /if \(!result.ok\)/);
assert.match(partiesPost, /status: 400/);

const suppliersGet = readFileSync(resolve('app/api/suppliers/route.ts'), 'utf8');
assert.match(suppliersGet, /rowOnSupplierDesk/);
const customersGet = readFileSync(resolve('app/api/customers/route.ts'), 'utf8');
assert.match(customersGet, /rowOnCustomerDesk/);
assert.match(customersGet, /data = second.data as typeof data/);
assert.match(
  readFileSync(resolve('components/accounting/PartyBookRoleSelect.tsx'), 'utf8'),
  /useEffect\(\(\) => \{\s*setValue\(role\);/s
);

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
