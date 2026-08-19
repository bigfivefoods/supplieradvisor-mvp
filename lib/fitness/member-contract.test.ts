/**
 * Run: npx --yes tsx lib/fitness/member-contract.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore } from './fitgraph';
import {
  applyContractSubmissions,
  applyContractToClient,
  dobFromSaId,
  parqYesCount,
  personKey,
} from './member-contract';

assert.equal(dobFromSaId('8608235037084'), '1986-08-23');
assert.equal(dobFromSaId('0203070373089'), '2002-03-07');
assert.equal(personKey({ id_number: '8608235037084' }), 'id:8608235037084');

const now = '2026-08-19T12:00:00.000Z';
let client = {
  id: 'cli_1',
  code: 'A1',
  name: 'Ada',
  created_at: now,
  updated_at: now,
};
client = applyContractToClient(
  client,
  {
    kind: 'private',
    name: 'Ada Lovelace',
    email: 'ada@test.com',
    id_number: '8608235037084',
    phone: '0821110000',
    occupation: 'Engineer',
    parq: {
      taking_medication: true,
      pain_injuries: false,
      chronic_disease: true,
    },
    parq_explanation: 'Blood pressure meds',
    terms_accepted: true,
    parq_accepted: true,
    source: 'onboarding',
    source_id: 'sub1',
  },
  now
);
assert.equal(client.private_client, true);
assert.equal(client.contract_kind, 'private');
assert.equal(client.email, 'ada@test.com');
assert.equal(client.date_of_birth, '1986-08-23');
assert.equal(client.contracts?.length, 1);
assert.equal(parqYesCount(client.contracts?.[0].parq), 2);
assert.match(String(client.health?.injury_notes), /Blood pressure/);

const again = applyContractToClient(
  client,
  {
    kind: 'private',
    name: 'Ada Lovelace',
    email: 'ada@test.com',
    source_id: 'sub1',
    parq: { taking_medication: true, chronic_disease: true },
  },
  now
);
assert.equal(again.contracts?.length, 1);

const store = emptyFitgraphStore();
const applied = applyContractSubmissions(
  store,
  [
    {
      kind: 'group',
      name: 'Serah Shange',
      email: 'hanna.serah@gmail.com',
      id_number: '9906220431083',
      class_option: 'Bootcamp',
      debit_amount_zar: 475,
      parq: { pain_injuries: true },
      source_id: 'g1',
    },
    {
      kind: 'private',
      name: 'Michael Gouweloos',
      email: 'chinny@sai.co.za',
      id_number: '8608235037084',
      parq: { taking_medication: true },
      source_id: 'p1',
    },
  ],
  { now, replaceRoster: true, importVersion: 'test' }
);
assert.equal(applied.added, 2);
assert.equal(store.settings?.vuka_contracts_import, 'test');
const serah = store.clients.find((c) => /shange/i.test(c.name))!;
assert.equal(serah.contract_kind, 'group');
assert.equal(serah.private_client === true, false);
assert.equal(serah.contracts?.[0].kind, 'group');

const withBank = applyContractToClient(
  {
    id: 'cli_bank',
    code: 'B1',
    name: 'Serah Shange',
    created_at: now,
    updated_at: now,
  },
  {
    kind: 'group',
    name: 'Serah Shange',
    account_holder: 'Serah Shange',
    account_type: 'CURRENT/CHEQUE',
    account_number: '18465671637',
    bank_name: 'Discovery',
    debit_amount_zar: 475,
    source_id: 'bank1',
  },
  now
);
assert.equal(withBank.debit_bank?.bank_name, 'Discovery Bank');
assert.equal(withBank.debit_bank?.account_number, '18465671637');
assert.equal(withBank.debit_bank?.branch_code, '679000');
assert.equal(withBank.debit_bank?.account_type, 'cheque');
assert.equal(withBank.contracts?.[0].account_number, '18465671637');
const mike = store.clients.find((c) => /gouweloos/i.test(c.name))!;
assert.equal(mike.private_client, true);

const second = applyContractSubmissions(store, applied ? [
  {
    kind: 'group',
    name: 'Serah Shange',
    email: 'hanna.serah@gmail.com',
    id_number: '9906220431083',
    source_id: 'g1',
    parq: { pain_injuries: true },
  },
  {
    kind: 'private',
    name: 'Michael Gouweloos',
    email: 'chinny@sai.co.za',
    id_number: '8608235037084',
    source_id: 'p1',
    parq: { taking_medication: true },
  },
] : [], { now, replaceRoster: false });
assert.equal(second.added, 0);

console.log('member-contract.test.ts ok');
