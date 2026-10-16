/**
 * Run: npx --yes tsx lib/recovery/brief116-roles.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { allowedBookOps, capabilitiesFor, resolveRecoverRole } from './roles';
import { maskDebtor, serialiseAccount, serialiseCreditor, serialiseMandate } from './scope';

const staff = (role: string) => ({ role, status: 'active' });
assert.equal(resolveRecoverRole('owner', null), 'owner');
assert.equal(resolveRecoverRole('admin', staff('manager')), 'manager');
assert.equal(resolveRecoverRole('member', staff('collector')), 'agent');
assert.equal(resolveRecoverRole('finance', null), 'finance');
assert.equal(resolveRecoverRole('finance', staff('compliance')), 'compliance');
assert.equal(resolveRecoverRole('viewer', null), 'viewer');

const table = {
  owner: { books: true, contacts: true, rows: true, note: true, mutate: true, reveal: true, imp: true, clear: true, detail: true },
  manager: { books: true, contacts: true, rows: true, note: true, mutate: true, reveal: true, imp: true, clear: false, detail: true },
  agent: { books: false, contacts: true, rows: true, note: true, mutate: false, reveal: false, imp: false, clear: false, detail: false },
  finance: { books: false, contacts: false, rows: true, note: false, mutate: false, reveal: false, imp: false, clear: false, detail: true },
  compliance: { books: false, contacts: false, rows: true, note: false, mutate: false, reveal: false, imp: false, clear: false, detail: true },
  viewer: { books: false, contacts: false, rows: false, note: false, mutate: false, reveal: false, imp: false, clear: false, detail: true },
} as const;

for (const [role, expectCaps] of Object.entries(table)) {
  const caps = capabilitiesFor(role as keyof typeof table);
  assert.equal(Boolean(caps.canEditBooks), expectCaps.books, role);
  assert.equal(Boolean(caps.canSeeContacts), expectCaps.contacts, role);
  assert.equal(Boolean(caps.canSeeAccountRows), expectCaps.rows, role);
  assert.equal(Boolean(caps.canAddNote), expectCaps.note, role);
  assert.equal(Boolean(caps.canMutateAccounts), expectCaps.mutate, role);
  assert.equal(Boolean(caps.canRevealId), expectCaps.reveal, role);
  assert.equal(Boolean(caps.canImport), expectCaps.imp, role);
  assert.equal(Boolean(caps.canClearDemo), expectCaps.clear, role);
  assert.equal(Boolean(caps.canSeeCreditorDetail), expectCaps.detail, role);
}

assert.equal(allowedBookOps('agent').has('account.add_note'), true);
assert.equal(allowedBookOps('agent').has('import.commit'), false);
assert.equal(allowedBookOps('manager').has('import.clear_demo'), false);
assert.equal(allowedBookOps('owner').has('import.clear_demo'), true);
assert.equal(allowedBookOps('viewer').size, 0);

const debtor = {
  id: 'd',
  display_name: 'Demo',
  id_last4: '5083',
  id_number_enc: 'SECRET-ENC',
  id_hash: 'SECRET-HASH',
  id_number: 'SECRET-ID',
  contacts: [{ value: 'SECRET-PHONE' }],
};
for (const role of ['finance', 'compliance', 'viewer'] as const) {
  const masked = maskDebtor(debtor, capabilitiesFor(role));
  const json = JSON.stringify(masked);
  assert.equal(json.includes('SECRET-ENC'), false, role);
  assert.equal(json.includes('SECRET-HASH'), false, role);
  assert.equal(json.includes('SECRET-PHONE'), false, role);
}
const agentAccount = serialiseAccount(
  { id: 'a', ref: 'RC-1', creditor_name: 'Only Name', mandate_id: 'SECRET-MANDATE', commission_model: { kind: 'pct_of_recovered' }, id_number_enc: 'SECRET-ENC', contacts: [{ value: 'phone' }], id_last4: '5083' },
  'agent',
  capabilitiesFor('agent')
);
const agentJson = JSON.stringify(agentAccount);
assert.equal(agentJson.includes('SECRET-MANDATE'), false);
assert.equal(agentJson.includes('SECRET-ENC'), false);
assert.equal(agentJson.includes('pct_of_recovered'), false);
assert.equal(agentJson.includes('Only Name'), true);
assert.equal(serialiseAccount({ id: 'a', ref: 'RC-1' }, 'viewer', capabilitiesFor('viewer')), null);
const creditor = serialiseCreditor({ id: 'c', name: 'Only Name', reg_no: 'SECRET-REG', vat_no: 'SECRET-VAT' }, 'agent', capabilitiesFor('agent'));
assert.deepEqual(creditor, { id: 'c', name: 'Only Name' });
assert.equal(serialiseMandate({ id: 'm', commission_model: { bps: 1 } }, 'agent'), null);

const agentRead = readFileSync(resolve('lib/recovery/agent-read.ts'), 'utf8');
assert.equal(agentRead.includes(".from('recover_accounts')"), false);
assert.match(agentRead, /recover_accounts_for_agent/);
const accountsRoute = readFileSync(resolve('app/api/recovery/recovergraph/accounts/route.ts'), 'utf8');
assert.match(accountsRoute, /loadAccountsForAgent/);
assert.equal(accountsRoute.includes(".from('recover_accounts')"), false);

console.log('brief116-roles.test.ts ok');
