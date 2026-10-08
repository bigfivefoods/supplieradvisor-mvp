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

assert.equal(dobFromSaId('0001015009086'), '2000-01-01');
assert.equal(dobFromSaId('0203070000000'), '2002-03-07');
assert.equal(personKey({ id_number: '0001015009086' }), 'id:0001015009086');

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
    id_number: '0001015009086',
    phone: '0000000001',
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
assert.equal(client.date_of_birth, '2000-01-01');
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
      name: 'Riley Fixture',
      email: 'riley.fixture@example.test',
      id_number: '0001015009086',
      class_option: 'Bootcamp',
      debit_amount_zar: 475,
      parq: { pain_injuries: true },
      source_id: 'g1',
    },
    {
      kind: 'private',
      name: 'Eden Private',
      email: 'eden.private@example.test',
      id_number: '0001035009088',
      parq: { taking_medication: true },
      source_id: 'p1',
    },
  ],
  { now, replaceRoster: true, importVersion: 'test' }
);
assert.equal(applied.added, 2);
assert.equal(store.settings?.vuka_contracts_import, 'test');
const serah = store.clients.find((c) => /riley fixture/i.test(c.name))!;
assert.equal(serah.contract_kind, 'group');
assert.equal(serah.private_client === true, false);
assert.equal(serah.contracts?.[0].kind, 'group');

const withBank = applyContractToClient(
  {
    id: 'cli_bank',
    code: 'B1',
    name: 'Riley Fixture',
    created_at: now,
    updated_at: now,
  },
  {
    kind: 'group',
    name: 'Riley Fixture',
    account_holder: 'Riley Fixture',
    account_type: 'CURRENT/CHEQUE',
    account_number: '0001112223',
    bank_name: 'Discovery',
    debit_amount_zar: 475,
    source_id: 'bank1',
  },
  now
);
assert.equal(withBank.debit_bank?.bank_name, 'Discovery Bank');
assert.equal(withBank.debit_bank?.account_number, '0001112223');
assert.equal(withBank.debit_bank?.branch_code, '679000');
assert.equal(withBank.debit_bank?.account_type, 'cheque');
assert.equal(withBank.contracts?.[0].account_number, '0001112223');
const mike = store.clients.find((c) => /eden private/i.test(c.name))!;
assert.equal(mike.private_client, true);

const second = applyContractSubmissions(store, applied ? [
  {
    kind: 'group',
    name: 'Riley Fixture',
    email: 'riley.fixture@example.test',
    id_number: '0001015009086',
    source_id: 'g1',
    parq: { pain_injuries: true },
  },
  {
    kind: 'private',
    name: 'Eden Private',
    email: 'eden.private@example.test',
    id_number: '0001035009088',
    source_id: 'p1',
    parq: { taking_medication: true },
  },
] : [], { now, replaceRoster: false });
assert.equal(second.added, 0);

serah.active = false;
serah.membership_status = 'cancelled';
serah.membership_plan_id = 'vuka_pln_boot_1730';
const parkedKeep = applyContractSubmissions(
  store,
  [
    {
      kind: 'group',
      name: 'Riley Fixture',
      email: 'riley.fixture@example.test',
      id_number: '0001015009086',
      class_option: 'Bootcamp',
      debit_amount_zar: 475,
      source_id: 'g1',
    },
  ],
  { now, replaceRoster: false }
);
assert.equal(parkedKeep.added, 0);
const serahParked = store.clients.find((c) => /riley fixture/i.test(c.name))!;
assert.equal(serahParked.active, false);
assert.equal(serahParked.membership_status, 'cancelled');
assert.equal(serahParked.membership_plan_id, null);

console.log('member-contract.test.ts ok');
