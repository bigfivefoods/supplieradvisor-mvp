/**
 * Run: npx --yes tsx lib/accounting/party-gl-accounts.test.ts
 */
import assert from 'node:assert/strict';
import {
  groupCoaForAllocation,
  isAdvisorParty,
  isCustomerAllocAccount,
  isMemberArAccountCode,
  memberArAccountCode,
  legacyMemberArAccountCode,
  parseMemberArCustomerId,
  isSupplierAllocAccount,
  isSupplierApAccountCode,
  supplierApAccountCode,
  parseSupplierApSupplierId,
  isTradeParty,
  normalizePartyKey,
  nextFreeCode,
  isLegacyIntegerArCode,
  isLegacyIntegerApCode,
  partyDisplayName,
  pickRecognitionControlAccount,
  pickSettlementControlAccount,
  planPartyGlAccounts,
  statementParentForPartyLeaf,
  suggestPartyGlForDescription,
} from './party-gl-accounts';
import type { CoaAccount } from './types';

assert.equal(normalizePartyKey('Restore Africa Foundation NPC'), 'restore africa foundation');
assert.equal(normalizePartyKey('Restore Africa Foundation'), 'restore africa foundation');
assert.equal(normalizePartyKey('Holtz Group'), 'holtz');
assert.equal(normalizePartyKey('Holtz'), 'holtz');
assert.equal(normalizePartyKey('Shakiles Packaging Pty Ltd'), 'shakiles packaging');
assert.equal(nextFreeCode(new Set(['1181', '1182']), 1181), '1183');
assert.equal(isLegacyIntegerArCode('1181'), true);
assert.equal(isLegacyIntegerArCode('1180-0000012'), false);
assert.equal(isLegacyIntegerApCode('2181'), true);
assert.equal(isLegacyIntegerApCode('2180-0000008'), false);
assert.equal(memberArAccountCode(1), '1180-0000001');
assert.equal(memberArAccountCode(200), '1180-0000200');
assert.equal(memberArAccountCode(0), '');
assert.equal(legacyMemberArAccountCode(9), '4400-0000009');
assert.equal(parseMemberArCustomerId('1180-0000009'), 9);
assert.equal(parseMemberArCustomerId('4400-0000009'), 9);
assert.equal(isMemberArAccountCode('1180-0000123'), true);
assert.equal(isMemberArAccountCode('4400-0000123'), true);
assert.equal(isMemberArAccountCode('4100'), false);
assert.equal(supplierApAccountCode(8), '2180-0000008');
assert.equal(parseSupplierApSupplierId('2180-0000012'), 12);
assert.equal(isSupplierApAccountCode('2180-0000008'), true);
assert.equal(isSupplierApAccountCode('2181'), false);
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
    {
      id: 22,
      trading_name: 'Coach Alex',
      status: 'active',
      notes: 'advisor_ap:fitgraph_coach:coh_1',
    },
  ],
  coa: [
    { id: 2, code: '1100', name: 'Current assets', is_header: true, account_type: 'asset' },
    { id: 3, code: '2100', name: 'Current liabilities', is_header: true, account_type: 'liability' },
    { id: 4, code: '4000', name: 'Revenue', is_header: true, account_type: 'revenue' },
    { id: 5, code: '1130', name: 'Accounts receivable', subtype: 'receivable', account_type: 'asset' },
    { id: 15, code: '2110', name: 'Accounts payable', subtype: 'payable', account_type: 'liability' },
    { id: 6, code: '1135', name: 'Allowance for expected credit losses', subtype: 'contra_asset', account_type: 'asset' },
    { id: 40, code: '1181', name: 'AR — Buze', subtype: 'receivable', account_type: 'asset' },
  ],
});

assert.equal(plan.create.filter((c) => c.account_type === 'asset' && !c.is_header).length, 3);
assert.ok(plan.create.some((c) => c.code === '1180-0000010' && c.name === 'AR — Restore Africa Foundation'));
assert.ok(plan.create.some((c) => c.code === '1180-0000014'));
assert.ok(!plan.create.some((c) => c.code === '1182'));
const memberHeader = plan.create.find((c) => c.code === '1180');
assert.ok(memberHeader);
assert.equal(memberHeader?.is_header, true);
assert.equal(memberHeader?.account_type, 'asset');
assert.equal(memberHeader?.parent_code, '1100');
assert.equal(memberHeader?.name, 'Customers');
const memberLeaf = plan.create.find((c) => c.name === 'AR — Walk-in member');
assert.ok(memberLeaf);
assert.equal(memberLeaf?.account_type, 'asset');
assert.equal(memberLeaf?.subtype, 'receivable');
assert.equal(memberLeaf?.parent_code, '1180');
assert.equal(memberLeaf?.code, '1180-0000200');
assert.equal(
  plan.create.find((c) => c.code === '1180-0000010')?.parent_code,
  '1180'
);
assert.equal(statementParentForPartyLeaf('1181'), '1130');
assert.equal(statementParentForPartyLeaf('1180-0000200'), '1180');
assert.equal(statementParentForPartyLeaf('2180-0000008'), '2180');
assert.equal(statementParentForPartyLeaf('2181'), '2180');
assert.equal(statementParentForPartyLeaf('4400-0000009'), '1180');
assert.notEqual(statementParentForPartyLeaf('1180-0000001'), '4400');
const apHeader = plan.create.find((c) => c.code === '2180');
assert.ok(apHeader);
assert.equal(apHeader?.is_header, true);
assert.equal(apHeader?.account_type, 'liability');
assert.equal(apHeader?.parent_code, '2100');
assert.equal(apHeader?.name, 'Suppliers');
assert.equal(
  plan.create.filter((c) => String(c.code).startsWith('2180-')).map((c) => c.code).sort().join(','),
  '2180-0000008,2180-0000009,2180-0000012,2180-0000022'
);
assert.ok(plan.create.some((c) => c.code === '2180-0000008' && c.name === 'AP — Holtz'));
assert.ok(plan.create.some((c) => c.code === '2180-0000009' && c.name === 'AP — Holtz Group'));
assert.ok(plan.create.some((c) => c.code === '2180-0000022' && c.name === 'AP — Coach Alex'));
assert.ok(!plan.create.some((c) => /Gone/.test(c.name)));
assert.ok(!plan.create.some((c) => c.code === '1130' || c.name === 'Accounts receivable'));

const memberLinks = plan.links.filter((l) => l.id === 200);
assert.equal(memberLinks.length, 1);
assert.equal(memberLinks[0].kind, 'ar');
assert.equal(memberLinks[0].code, '1180-0000200');

const holtzLinks = plan.links.filter((l) => l.id === 8 && l.kind === 'ap');
assert.equal(holtzLinks.length, 1);
assert.equal(holtzLinks[0].code, '2180-0000008');
const holtzGroupLinks = plan.links.filter((l) => l.id === 9 && l.kind === 'ap');
assert.equal(holtzGroupLinks[0].code, '2180-0000009');

const buzeLinks = plan.links.filter((l) => l.id === 6 && l.kind === 'ar');
assert.equal(buzeLinks.length, 1);
assert.equal(buzeLinks[0].code, '1181');
assert.equal(buzeLinks[0].accountId, 40);

const restoreLinks = plan.links.filter((l) => l.kind === 'ar' && (l.id === 10 || l.id === 14));
assert.equal(restoreLinks.length, 2);
assert.notEqual(restoreLinks[0].code, restoreLinks[1].code);

const mapped = planPartyGlAccounts({
  customers: [
    {
      id: 200,
      trading_name: 'Walk-in member',
      customer_type: 'consumer',
      source: 'advisor_member',
      status: 'active',
    },
    { id: 10, trading_name: 'Restore Africa Foundation', status: 'active' },
  ],
  suppliers: [{ id: 8, trading_name: 'Holtz', status: 'active' }],
  coa: [
    { id: 2, code: '1100', name: 'Current assets', is_header: true, account_type: 'asset' },
    { id: 3, code: '2100', name: 'Current liabilities', is_header: true, account_type: 'liability' },
    { id: 5, code: '1130', name: 'Accounts receivable', subtype: 'receivable', account_type: 'asset' },
    { id: 15, code: '2110', name: 'Accounts payable', subtype: 'payable', account_type: 'liability' },
  ],
  mapping: {
    arCode: '1130',
    memberCode: '1180',
    apCode: '2110',
    contractorCode: '2180',
  },
});
assert.equal(mapped.create.find((c) => c.name === 'AR — Walk-in member')?.code, '1180-0000200');
assert.equal(mapped.create.find((c) => c.name === 'AR — Walk-in member')?.parent_code, '1180');
assert.equal(mapped.create.find((c) => c.code === '1130-0000010')?.parent_code, '1130');
assert.equal(mapped.create.find((c) => c.code === '2110-0000008')?.parent_code, '2110');

const legacyPlan = planPartyGlAccounts({
  customers: [
    {
      id: 9,
      trading_name: 'Ann Vuka',
      source: 'advisor_member',
      status: 'active',
    },
  ],
  suppliers: [
    {
      id: 8,
      trading_name: 'Holtz',
      status: 'active',
      metadata: { gl_account_id: 50, gl_account_code: '2181' },
    },
  ],
  coa: [
    { id: 2, code: '1100', name: 'Current assets', is_header: true, account_type: 'asset' },
    { id: 15, code: '2110', name: 'Accounts payable', subtype: 'payable', account_type: 'liability' },
    {
      id: 77,
      code: '4400-0000009',
      name: 'Ann Vuka',
      subtype: 'receivable',
      account_type: 'asset',
    },
    { id: 50, code: '2181', name: 'AP — Holtz Group', subtype: 'payable', account_type: 'liability' },
  ],
});
assert.ok(!legacyPlan.create.some((c) => c.code === '1180-0000009'));
assert.equal(legacyPlan.links.find((l) => l.id === 9)?.code, '4400-0000009');
assert.ok(!legacyPlan.create.some((c) => c.code === '2180-0000008'));
assert.equal(legacyPlan.links.find((l) => l.id === 8)?.code, '2181');

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
    id: 77,
    code: '1180-0000200',
    name: 'Walk-in member',
    subtype: 'receivable',
    account_type: 'asset',
  }),
  true
);
assert.equal(
  isCustomerAllocAccount({
    id: 78,
    code: '4400-0000200',
    name: 'Walk-in member',
    subtype: 'receivable',
    account_type: 'asset',
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
assert.equal(
  isSupplierAllocAccount({
    id: 88,
    code: '2180-0000008',
    name: 'Holtz',
    subtype: 'payable',
    account_type: 'liability',
  }),
  true
);

const grouped = groupCoaForAllocation([
  { id: 5, code: '1130', name: 'Accounts receivable', account_type: 'asset', subtype: 'receivable' },
  { id: 40, code: '1181', name: 'AR — Buze', account_type: 'asset', subtype: 'receivable' },
  { id: 15, code: '2110', name: 'Accounts payable', account_type: 'liability', subtype: 'payable' },
  { id: 50, code: '2181', name: 'AP — Holtz Group', account_type: 'liability', subtype: 'payable' },
  { id: 88, code: '2180-0000008', name: 'Holtz', account_type: 'liability', subtype: 'payable' },
  { id: 20, code: '4100', name: 'Sales revenue', account_type: 'revenue', subtype: 'sales' },
  { id: 1, code: '1000', name: 'Assets', account_type: 'asset', is_header: true },
  { id: 3, code: '1110', name: 'Bank — operating', account_type: 'asset', subtype: 'bank' },
  {
    id: 77,
    code: '1180-0000009',
    name: 'Ann Vuka',
    account_type: 'asset',
    subtype: 'receivable',
  },
  {
    id: 78,
    code: '4400-0000010',
    name: 'Legacy member',
    account_type: 'asset',
    subtype: 'receivable',
  },
] as CoaAccount[]);
assert.deepEqual(grouped.members.map((a) => a.code), ['1180-0000009', '4400-0000010']);
assert.deepEqual(grouped.customers.map((a) => a.code), ['1130', '1181']);
assert.deepEqual(grouped.suppliers.map((a) => a.code), ['2110', '2180-0000008', '2181']);
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

const memberByName = suggestPartyGlForDescription(
  'FNB APP PAYMENT FROM ANN VUKA',
  910,
  grouped.members
);
assert.equal(memberByName?.id, 77);
const memberByCode = suggestPartyGlForDescription(
  'EFT 1180-0000009 gym fees',
  910,
  grouped.members
);
assert.equal(memberByCode?.id, 77);
const memberByLegacyCode = suggestPartyGlForDescription(
  'EFT 4400-0000010 gym fees',
  910,
  grouped.members
);
assert.equal(memberByLegacyCode?.id, 78);
const supplierByCode = suggestPartyGlForDescription(
  'PAY 2180-0000008 holtz',
  -1200,
  grouped.suppliers
);
assert.equal(supplierByCode?.id, 88);

console.log('party-gl-accounts tests ok');
