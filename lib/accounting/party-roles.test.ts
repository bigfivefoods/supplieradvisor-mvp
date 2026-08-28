/**
 * Run: npx --yes tsx lib/accounting/party-roles.test.ts
 */
import assert from 'node:assert/strict';
import {
  assemblePartyRoles,
  classifyCoaParty,
  coaPartyLabel,
  glCodeFromMeta,
  isCustomerCoaKind,
  isSupplierCoaKind,
} from './party-roles';

assert.equal(glCodeFromMeta({ gl_account_code: '1180-0000009' }), '1180-0000009');
assert.equal(glCodeFromMeta(null), null);

const rows = assemblePartyRoles(
  [
    {
      id: 10,
      trading_name: 'Restore Africa Foundation',
      status: 'active',
      metadata: { gl_account_code: '1180-0000010' },
    },
    { id: 6, trading_name: 'Buze', email: 'buze@example.com', status: 'active' },
  ],
  [
    { id: 8, trading_name: 'Holtz', status: 'preferred' },
    {
      id: 22,
      trading_name: 'Restore Africa Foundation NPC',
      status: 'active',
      metadata: { gl_account_code: '2180-0000022' },
    },
    { id: 7, trading_name: 'Buze', email: 'buze@example.com', status: 'active' },
  ]
);

const restore = rows.find((r) => /restore/i.test(r.name));
assert.ok(restore);
assert.equal(restore?.role, 'both');
assert.equal(restore?.customer_id, 10);
assert.equal(restore?.supplier_id, 22);
assert.equal(restore?.ar_account_code, '1180-0000010');
assert.equal(restore?.ap_account_code, '2180-0000022');

const buze = rows.find((r) => r.name === 'Buze');
assert.equal(buze?.role, 'both');
assert.equal(buze?.customer_id, 6);
assert.equal(buze?.supplier_id, 7);

const holtz = rows.find((r) => r.name === 'Holtz');
assert.equal(holtz?.role, 'supplier');
assert.equal(holtz?.customer_id, null);
assert.equal(holtz?.supplier_id, 8);

assert.equal(
  classifyCoaParty({
    code: '1180-0000010',
    name: 'AR — Restore Africa Foundation',
    account_type: 'asset',
    subtype: 'receivable',
  }),
  'member_ar'
);
assert.equal(
  classifyCoaParty({
    code: '2180-0000008',
    name: 'AP — Holtz',
    account_type: 'liability',
    subtype: 'payable',
  }),
  'supplier_ap'
);
assert.equal(
  classifyCoaParty({
    code: '1181',
    name: 'AR — Buze',
    account_type: 'asset',
    subtype: 'receivable',
  }),
  'customer_ar'
);
assert.equal(classifyCoaParty({ code: '1130', name: 'Accounts receivable' }), 'control_ar');
assert.equal(coaPartyLabel('supplier_ap'), 'Supplier · AP');
assert.equal(isCustomerCoaKind('member_ar'), true);
assert.equal(isSupplierCoaKind('member_ar'), false);

console.log('party-roles tests ok');
