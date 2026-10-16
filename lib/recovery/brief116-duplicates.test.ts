/**
 * Run: npx --yes tsx lib/recovery/brief116-duplicates.test.ts
 */
import assert from 'node:assert/strict';
import { findAccountDuplicates, findDebtorDuplicates, pairsFromDebtors } from './duplicates';

const debtors = [
  { id: 'b', display_name: 'Elsa Botha', id_hash: 'same', phones: ['+27100000002'], emails: [] },
  { id: 'a', display_name: 'Elsa Botha', id_hash: null, phones: ['0820000001'], emails: ['ada@demo.example'] },
  { id: 'c', display_name: 'Elsa Botha', id_hash: null, phones: ['+27100000009'], emails: [] },
];

const hits = findDebtorDuplicates(debtors, {
  id: 'new',
  display_name: 'Élsa  Botha',
  id_hash: 'same',
  phones: ['010 000 0001'],
  emails: ['Ada@demo.example'],
});
assert.deepEqual(
  hits.map((hit) => `${hit.kind}:${hit.id}`),
  ['same_id:b', 'possible:a']
);
assert.deepEqual(
  findDebtorDuplicates(debtors, {
    id: 'new',
    display_name: 'Elsa Botha',
    id_hash: null,
    phones: [],
    emails: [],
  }),
  []
);
assert.deepEqual(
  findAccountDuplicates(
    [
      { id: '2', creditor_id: 'c', creditor_account_ref: 'ACC-1' },
      { id: '1', creditor_id: 'c', creditor_account_ref: 'acc-1' },
    ],
    { creditor_id: 'c', creditor_account_ref: 'ACC-1' }
  ).map((row) => row.id),
  ['1', '2']
);

const sameName = [
  { id: '1', display_name: 'Thandi Nkosi', id_hash: null, phones: ['0820000001'], emails: [] },
  { id: '2', display_name: 'Thandi Nkosi', id_hash: null, phones: ['0830000002'], emails: [] },
];
assert.equal(pairsFromDebtors(sameName).length, 0);
const samePhone = pairsFromDebtors([
  { id: '1', display_name: 'Thandi Nkosi', id_hash: null, phones: ['0820000001'], emails: [] },
  { id: '2', display_name: 'Thandi Nkosi', id_hash: null, phones: ['+27820000001'], emails: [] },
]);
assert.equal(samePhone.length, 1);
assert.equal(samePhone[0].match, 'contact');

console.log('brief116-duplicates.test.ts ok');
