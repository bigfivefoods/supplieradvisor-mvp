/**
 * Run: npx --yes tsx lib/fitness/member-debit-bank.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore, type FitClient } from './fitgraph';
import {
  applyMemberDebitBank,
  gymCollectsDebitBank,
  gymRequiresDebitBank,
  maskAccountNumber,
  memberDebitBankComplete,
} from './member-debit-bank';

const store = emptyFitgraphStore();
assert.equal(gymCollectsDebitBank(store), false);
assert.equal(gymRequiresDebitBank(store), false);
store.settings!.collect_debit_bank = true;
assert.equal(gymCollectsDebitBank(store), true);
assert.equal(gymRequiresDebitBank(store), false);
store.settings!.require_debit_bank = true;
assert.equal(gymCollectsDebitBank(store), true);
assert.equal(gymRequiresDebitBank(store), true);

const client: FitClient = {
  id: 'cli_1',
  code: 'M1',
  name: 'Ada',
  membership_status: 'active',
  active: true,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
};
assert.equal(memberDebitBankComplete(client), false);

const bad = applyMemberDebitBank(client, {
  account_holder: 'Ada Lovelace',
  bank_name: 'FNB',
  account_number: '123',
  branch_code: '250655',
  account_type: 'cheque',
  debit_order_authorised: true,
});
assert.equal(bad.ok, false);

const noAuth = applyMemberDebitBank(client, {
  account_holder: 'Ada Lovelace',
  bank_name: 'FNB',
  account_number: '62123456789',
  branch_code: '250655',
  account_type: 'cheque',
  debit_order_authorised: false,
});
assert.equal(noAuth.ok, false);

const ok = applyMemberDebitBank(
  client,
  {
    account_holder: 'Ada Lovelace',
    bank_name: 'FNB',
    account_number: '6212 3456 789',
    branch_code: '250655',
    account_type: 'cheque',
    debit_order_authorised: true,
  },
  '2026-08-17T10:00:00.000Z'
);
assert.equal(ok.ok, true);
assert.equal(memberDebitBankComplete(client), true);
assert.equal(client.debit_bank?.account_number, '62123456789');
assert.equal(maskAccountNumber(client.debit_bank!.account_number), '•••• 6789');

console.log('member-debit-bank.test.ts ok');
