/**
 * Run: npx --yes tsx lib/accounting/party-ledger-settings.test.ts
 */
import assert from 'node:assert/strict';
import type { CoaAccount } from './types';
import {
  DEFAULT_PARTY_LEDGER,
  eligibleApParent,
  eligibleArParent,
  parsePartyLedgerStored,
  partyLedgerValidationError,
  resolvePartyLedgerParents,
  storedFromPatch,
} from './party-ledger-settings';

assert.deepEqual(parsePartyLedgerStored(null).ar_parent_code, '1180');
assert.equal(parsePartyLedgerStored(null).member_ar_parent_code, null);
assert.equal(parsePartyLedgerStored({ party_ledger: { ar_parent_code: '1190' } }).ar_parent_code, '1190');

const coa = [
  { id: 1, code: '1180', name: 'Customers', account_type: 'asset', is_header: true, subtype: 'receivable' },
  { id: 2, code: '2180', name: 'Suppliers', account_type: 'liability', is_header: true, subtype: 'payable' },
  { id: 3, code: '1130', name: 'Accounts receivable', account_type: 'asset', subtype: 'receivable' },
  { id: 4, code: '4400', name: 'Membership & care revenue', account_type: 'revenue', subtype: 'service' },
  { id: 5, code: '1110', name: 'Bank — operating', account_type: 'asset', subtype: 'bank' },
  { id: 6, code: '2110', name: 'Accounts payable', account_type: 'liability', subtype: 'payable' },
] as CoaAccount[];

assert.equal(eligibleArParent(coa[0]), true);
assert.equal(eligibleArParent(coa[2]), true);
assert.equal(eligibleArParent(coa[3]), false);
assert.equal(eligibleArParent(coa[4]), false);
assert.equal(eligibleApParent(coa[1]), true);
assert.equal(eligibleApParent(coa[5]), true);
assert.equal(eligibleApParent(coa[3]), false);

const resolved = resolvePartyLedgerParents(DEFAULT_PARTY_LEDGER, coa);
assert.equal(resolved.ar.code, '1180');
assert.equal(resolved.ar.id, 1);
assert.equal(resolved.members.code, '1180');
assert.equal(resolved.ap.code, '2180');
assert.equal(resolved.contractors.code, '2180');

const split = resolvePartyLedgerParents(
  {
    ...DEFAULT_PARTY_LEDGER,
    ar_parent_code: '1130',
    ar_parent_account_id: 3,
    member_ar_parent_code: '1180',
    ap_parent_code: '2110',
    contractor_ap_parent_code: '2180',
  },
  coa
);
assert.equal(split.ar.code, '1130');
assert.equal(split.members.code, '1180');
assert.equal(split.ap.code, '2110');
assert.equal(split.contractors.code, '2180');

assert.equal(
  partyLedgerValidationError(
    { ...DEFAULT_PARTY_LEDGER, ar_parent_code: '4400' },
    coa
  )?.includes('not an asset'),
  true
);
assert.equal(partyLedgerValidationError(DEFAULT_PARTY_LEDGER, coa), null);

const patched = storedFromPatch(
  { ar_parent_code: '1130', ar_parent_account_id: 3, ap_parent_code: '2180' },
  coa
);
assert.equal(patched.ar_parent_code, '1130');
assert.equal(patched.ar_parent_account_id, 3);
assert.equal(patched.member_ar_parent_code, null);

console.log('party-ledger-settings tests ok');
