/**
 * Run: npx --yes tsx lib/accounting/party-gl-accounts.test.ts
 */
import assert from 'node:assert/strict';
import {
  groupCoaForAllocation,
  isAdvisorParty,
  isCustomerAllocAccount,
  isSupplierAllocAccount,
  isTradeParty,
  normalizePartyKey,
  nextFreeCode,
  partyDisplayName,
  pickRecognitionControlAccount,
  pickSettlementControlAccount,
  planPartyGlAccounts,
  suggestPartyGlForDescription,
} from './party-gl-accounts';
import type { CoaAccount } from './types';

assert.equal(normalizePartyKey('Restore Africa Foundation NPC'), 'restore africa foundation');
assert.equal(normalizePartyKey('Restore Africa Foundation'), 'restore africa foundation');
assert.equal(normalizePartyKey('Holtz Group'), 'holtz');
assert.equal(normalizePartyKey('Holtz'), 'holtz');
assert.equal(normalizePartyKey('Shakiles Packaging Pty Ltd'), 'shakiles packaging');
assert.equal(nextFreeCode(new Set(['1181', '1182']), 1181), '1183');
assert.equal(partyDisplayName({ name: 'First trade customer' }), 'First trade customer');
assert.equal(
  partyDisplayName({ trading_name: 'Buze', name: 'ignored' }),
  'Buze'
);
assert.equal(
  isTradeParty({ id: 1, trading_name: 'Boxer', status: 'active' }),
  true
);
assert.equal(
  isTradeParty({
    id: 2,
    trading_name: 'Jarryd',
    customer_type: 'consumer',
    source: 'sa_member_wallet',
    status: 'active',
  }),
  false
);
assert.equal(
  isAdvisorParty({
    id: 200,
    trading_name: 'Walk-in member',
    customer_type: 'consumer',
    source: 'advisor_member',
    status: 'active',
  }),
  true
);
assert.equal(
  isAdvisorParty({
    id: 201,
    trading_name: 'Pat Patient',
    customer_type: 'patient',
    notes: 'advisor_ref:physio:pat_1',
    status: 'active',
  }),
  true
);
assert.equal(
  isAdvisorParty({
    id: 2,
    trading_name: 'Jarryd',
    customer_type: 'consumer',
    source: 'sa_member_wallet',
    status: 'active',
  }),
  false
);
assert.equal(
  isAdvisorParty({
    id: 202,
    trading_name: 'Hire Co',
    customer_type: 'hirer',
    source: 'advisor_member',
    status: 'active',
  }),
  true
);
assert.equal(pickRecognitionControlAccount(161, 5), 161);
assert.equal(pickRecognitionControlAccount(null, 5), 5);
assert.equal(pickSettlementControlAccount(161, 5), 161);
assert.equal(pickSettlementControlAccount(null, 5), 5);

const plan = planPartyGlAccounts({
  customers: [
    { id: 10, trading_name: 'Restore Africa Foundation', status: 'prospect' },
    { id: 14, trading_name: 'Restore Africa Foundation', legal_name: 'Restore Africa Foundation Npc', status: 'prospect' },
    { id: 6, trading_name: 'Buze', status: 'active' },
    { id: 99, trading_name: 'Gone Co', status: 'inactive' },
    {
      id: 200,
      trading_name: 'Walk-in member',
      customer_type: 'consumer',
      source: 'advisor_member',
      status: 'active',
    },
  ],
  suppliers: [
    { id: 8, trading_name: 'Holtz', status: 'prospect' },
    { id: 9, trading_name: 'Holtz Group', status: 'prospect' },
    { id: 12, trading_name: 'Kelpack Manufacturing (Pty) Ltd', status: 'prospect' },
  ],
  coa: [
    { id: 5, code: '1130', name: 'Accounts receivable', subtype: 'receivable', account_type: 'asset' },
    { id: 15, code: '2110', name: 'Accounts payable', subtype: 'payable', account_type: 'liability' },
    { id: 6, code: '1135', name: 'Allowance for expected credit losses', subtype: 'contra_asset', account_type: 'asset' },
    { id: 40, code: '1181', name: 'AR — Buze', subtype: 'receivable', account_type: 'asset' },
  ],
});

assert.equal(plan.create.filter((c) => c.account_type === 'asset').length, 2);
assert.equal(plan.create[0].name, 'AR — Restore Africa Foundation');
assert.equal(plan.create[0].code, '1182');
assert.ok(plan.create.some((c) => c.name === 'AR — Walk-in member'));
assert.ok(plan.create.some((c) => c.name === 'AP — Holtz Group'));
assert.ok(plan.create.some((c) => c.name === 'AP — Kelpack Manufacturing (Pty) Ltd'));
assert.equal(plan.create.filter((c) => c.name.startsWith('AP — Holtz')).length, 1);
assert.ok(!plan.create.some((c) => /Gone/.test(c.name)));
assert.ok(!plan.create.some((c) => c.code === '1130' || c.name === 'Accounts receivable'));

const buzeLinks = plan.links.filter((l) => l.id === 6 && l.kind === 'ar');
assert.equal(buzeLinks.length, 1);
assert.equal(buzeLinks[0].code, '1181');
assert.equal(buzeLinks[0].accountId, 40);

const restoreLinks = plan.links.filter((l) => l.kind === 'ar' && l.key === 'restore africa foundation');
assert.equal(restoreLinks.length, 2);
assert.equal(restoreLinks[0].code, restoreLinks[1].code);

assert.equal(
  isCustomerAllocAccount({
    id: 5,
    code: '1130',
    name: 'Accounts receivable',
    subtype: 'receivable',
  }),
  true
);
assert.equal(
  isCustomerAllocAccount({
    id: 6,
    code: '1135',
    name: 'Allowance for expected credit losses',
    subtype: 'contra_asset',
  }),
  false
);
assert.equal(
  isSupplierAllocAccount({
    id: 15,
    code: '2110',
    name: 'Accounts payable',
    subtype: 'payable',
  }),
  true
);

const grouped = groupCoaForAllocation([
  { id: 5, code: '1130', name: 'Accounts receivable', account_type: 'asset', subtype: 'receivable' },
  { id: 40, code: '1181', name: 'AR — Buze', account_type: 'asset', subtype: 'receivable' },
  { id: 15, code: '2110', name: 'Accounts payable', account_type: 'liability', subtype: 'payable' },
  { id: 50, code: '2181', name: 'AP — Holtz Group', account_type: 'liability', subtype: 'payable' },
  { id: 20, code: '4100', name: 'Sales revenue', account_type: 'revenue', subtype: 'sales' },
  { id: 1, code: '1000', name: 'Assets', account_type: 'asset', is_header: true },
  { id: 3, code: '1110', name: 'Bank — operating', account_type: 'asset', subtype: 'bank' },
] as CoaAccount[]);
assert.deepEqual(grouped.customers.map((a) => a.code), ['1130', '1181']);
assert.deepEqual(grouped.suppliers.map((a) => a.code), ['2110', '2181']);
assert.deepEqual(grouped.incomeExpense.map((a) => a.code), ['4100']);
assert.deepEqual(grouped.other.map((a) => a.code), ['1110']);

const hit = suggestPartyGlForDescription(
  'FNB APP PAYMENT FROM RESTORE AFRICA FOUNDATION',
  6785,
  [
    ...grouped.customers,
    {
      id: 41,
      code: '1182',
      name: 'AR — Restore Africa Foundation',
      account_type: 'asset',
      subtype: 'receivable',
    } as CoaAccount,
  ]
);
assert.equal(hit?.id, 41);

const miss = suggestPartyGlForDescription('FNB APP PAYMENT FROM SOMEONE ELSE', 100, grouped.customers);
assert.equal(miss, null);

console.log('party-gl-accounts tests ok');
