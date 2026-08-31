/**
 * Brief 37 — padded party COA for every Advisor.
 * Run: npx --yes tsx lib/accounting/brief37-advisor-padded-coa.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isAdvisorFeeKind,
  isAdvisorFeeParty,
  isAdvisorParty,
  isLeftoverMemberRevenueLeaf,
  isTradeParty,
  memberArAccountCode,
  memberRevAccountCode,
  planIntegerMemberRevenueRecode,
  planPartyGlAccounts,
  supplierApAccountCode,
} from './party-gl-accounts';

assert.equal(memberRevAccountCode(1), '4400-0000001');
assert.equal(memberArAccountCode(17), '1180-0000017');
assert.equal(supplierApAccountCode(8), '2180-0000008');
assert.notEqual(memberRevAccountCode(1), '4401');
assert.notEqual(memberArAccountCode(17), '1181');
assert.notEqual(supplierApAccountCode(8), '2181');

assert.equal(isAdvisorFeeKind('gym'), true);
assert.equal(isAdvisorFeeKind('fitgraph'), true);
assert.equal(isAdvisorFeeKind('physio'), true);
assert.equal(isAdvisorFeeKind('hire'), true);
assert.equal(isAdvisorFeeKind('retail'), false);
assert.equal(isAdvisorFeeKind('retailgraph'), false);

const gym = {
  id: 17,
  trading_name: 'Ada',
  status: 'active',
  source: 'advisor_member',
  notes: 'advisor_ref:gym:cli_1',
};
const clinic = {
  id: 18,
  trading_name: 'Pat Patient',
  status: 'active',
  customer_type: 'patient',
  notes: 'advisor_ref:physiograph:pat_1',
};
const hirer = {
  id: 19,
  trading_name: 'Hire Co',
  status: 'active',
  customer_type: 'hirer',
  notes: 'advisor_ref:hire:usr_1',
};
const retail = {
  id: 20,
  trading_name: 'Shopper Sam',
  status: 'active',
  source: 'advisor_member',
  notes: 'advisor_ref:retail:cus_1',
};
const trade = {
  id: 10,
  trading_name: 'Boxer',
  status: 'active',
};

assert.equal(isAdvisorParty(gym), true);
assert.equal(isAdvisorFeeParty(gym), true);
assert.equal(isAdvisorParty(clinic), true);
assert.equal(isAdvisorFeeParty(clinic), true);
assert.equal(isAdvisorParty(hirer), true);
assert.equal(isAdvisorFeeParty(hirer), true);
assert.equal(isAdvisorParty(retail), true);
assert.equal(isAdvisorFeeParty(retail), false);
assert.equal(isTradeParty(trade), true);
assert.equal(isAdvisorParty(trade), false);
assert.equal(isAdvisorFeeParty(trade), false);

const adaPlan = planIntegerMemberRevenueRecode({
  leaf: {
    id: 4503,
    code: '4503',
    name: 'Member — Ada',
    is_header: false,
    is_active: true,
    subtype: 'service',
  },
  customers: [gym],
  byCode: new Map([['4503', 4503]]),
  journalCount: 0,
});
assert.equal(adaPlan.action, 'recode');
assert.equal(adaPlan.want, '4400-0000017');
assert.equal(adaPlan.partyId, 17);

assert.equal(
  isLeftoverMemberRevenueLeaf({
    id: 4500,
    code: '4500',
    name: 'Member — Ada',
    is_header: false,
    is_active: true,
  }),
  true
);

const headers = [
  { id: 2, code: '1100', name: 'Current assets', is_header: true, account_type: 'asset' },
  { id: 3, code: '2100', name: 'Current liabilities', is_header: true, account_type: 'liability' },
  { id: 4, code: '4000', name: 'Revenue', is_header: true, account_type: 'revenue' },
  { id: 5, code: '1130', name: 'Accounts receivable', subtype: 'receivable', account_type: 'asset' },
  { id: 15, code: '2110', name: 'Accounts payable', subtype: 'payable', account_type: 'liability' },
];

const advisorPlan = planPartyGlAccounts({
  customers: [gym, clinic, hirer],
  suppliers: [],
  coa: headers,
});
assert.ok(advisorPlan.create.some((c) => c.code === '1180-0000017'));
assert.ok(advisorPlan.create.some((c) => c.code === '4400-0000017'));
assert.ok(advisorPlan.create.some((c) => c.code === '1180-0000018' && c.account_type === 'asset'));
assert.ok(advisorPlan.create.some((c) => c.code === '4400-0000018' && c.account_type === 'revenue'));
assert.ok(advisorPlan.create.some((c) => c.code === '4400-0000019'));
assert.ok(advisorPlan.create.some((c) => c.code === '4400' && c.is_header === true));

const tradePlan = planPartyGlAccounts({
  customers: [trade],
  suppliers: [],
  coa: headers,
});
assert.ok(tradePlan.create.some((c) => c.code === '1180-0000010'));
assert.ok(!tradePlan.create.some((c) => String(c.code).startsWith('4400-')));
assert.ok(!tradePlan.create.some((c) => c.code === '4400'));

const retailPlan = planPartyGlAccounts({
  customers: [retail],
  suppliers: [],
  coa: headers,
});
assert.ok(retailPlan.create.some((c) => c.code === '1180-0000020'));
assert.ok(!retailPlan.create.some((c) => String(c.code).startsWith('4400-')));

const src = readFileSync(resolve('lib/accounting/party-gl-accounts.ts'), 'utf8');
assert.doesNotMatch(src, /nextFreeCode\([^)]*4401/);
assert.doesNotMatch(src, /paddedPartyCode\(\s*['"]4100['"]/);
assert.match(src, /memberRevAccountCode/);
assert.match(src, /ensureMemberRevLeaf/);
assert.match(src, /recodeMemberRevenueToPadded/);
assert.match(src, /isAdvisorFeeParty/);

const attach = readFileSync(resolve('lib/b2c/member-account-ar.ts'), 'utf8');
assert.match(attach, /isAdvisorFeeKind/);
assert.match(attach, /ensureMemberRevLeaf/);

const gymFit = readFileSync(resolve('app/api/fitness/fitgraph/route.ts'), 'utf8');
assert.match(gymFit, /action === 'allocate_member'/);
assert.match(gymFit.split("action === 'allocate_member'")[1] || '', /attachCrmToAdvisorPerson/);
assert.match(gymFit, /attachApToAdvisorContractor/);

const customersApi = readFileSync(resolve('app/api/customers/route.ts'), 'utf8');
assert.match(customersApi, /ensureMemberRevLeaf/);
assert.match(customersApi, /isAdvisorFeeParty/);

const hireJoin = readFileSync(resolve('lib/b2c/join-brand.ts'), 'utf8');
assert.match(hireJoin, /kind: 'hire'/);
assert.match(hireJoin, /ensureAdvisorCrmCustomer/);

const fieldApi = readFileSync(resolve('app/api/agri/fieldgraph/route.ts'), 'utf8');
assert.match(fieldApi, /attachApToAdvisorContractor/);
const quarryApi = readFileSync(resolve('app/api/quarry/quarrygraph/route.ts'), 'utf8');
assert.match(quarryApi, /attachApToAdvisorContractor/);

const sql = readFileSync(resolve('RUN_THIS_FOR_BRIEF37.sql'), 'utf8');
assert.match(sql, /sa_brief37_recode_member_rev\(110\)/);
assert.doesNotMatch(sql, /sa_brief37_recode_member_rev\(102\)/);
assert.match(sql, /Do not run on 102/);

console.log('brief37-advisor-padded-coa.test.ts ok');
