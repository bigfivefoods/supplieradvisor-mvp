/**
 * Brief 35 — leftover 1190 AR + 4401 Member income. Fixture matches live VUKA 110.
 * Run: npx --yes tsx lib/accounting/brief35-coa-recode.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { filterOperatingCoa } from './coa-list';
import {
  clampCustomerArParent,
  isCanonical1180ArCode,
  isForbiddenCustomerArStamp,
  isLeftoverIntegerArLeaf,
  isLeftoverMemberRevenueLeaf,
  memberArAccountCode,
  planLeftoverIntegerLeaf,
  planMemberRevenueLeaf,
  planPartyGlAccounts,
  type CoaLeafForRecode,
  type PartyBookRow,
  type PartyCoaRow,
} from './party-gl-accounts';

function buildLiveVuka110(): {
  coa: CoaLeafForRecode[];
  customers: PartyBookRow[];
} {
  const coa: CoaLeafForRecode[] = [
    {
      id: 1,
      code: '1100',
      name: 'Current assets',
      is_header: true,
      is_active: true,
      account_type: 'asset',
    },
    {
      id: 2,
      code: '1130',
      name: 'Accounts receivable',
      is_header: false,
      is_active: true,
      account_type: 'asset',
      subtype: 'receivable',
    },
    {
      id: 3,
      code: '1180',
      name: 'Customers',
      is_header: true,
      is_active: true,
      account_type: 'asset',
      parent_id: 1,
    },
    {
      id: 4,
      code: '4000',
      name: 'Revenue',
      is_header: true,
      is_active: true,
      account_type: 'revenue',
    },
    {
      id: 5,
      code: '4400',
      name: 'Members & patients',
      is_header: true,
      is_active: true,
      account_type: 'revenue',
      subtype: 'service',
      parent_id: 4,
    },
  ];
  const customers: PartyBookRow[] = [];
  for (let i = 1; i <= 99; i += 1) {
    const name = i === 12 ? 'Geeta' : `Member ${i}`;
    const code = memberArAccountCode(i);
    customers.push({
      id: i,
      trading_name: name,
      status: 'active',
      customer_type: 'member',
      source: 'advisor_member',
      metadata: { gl_account_code: code, gl_account_id: 1000 + i, ar_account_number: code },
    });
    coa.push({
      id: 1000 + i,
      code,
      name: `AR — ${name}`,
      is_header: false,
      is_active: true,
      account_type: 'asset',
      subtype: 'receivable',
      parent_id: 3,
    });
    coa.push({
      id: 4400 + i,
      code: String(4400 + i),
      name: `Member — ${name}`,
      is_header: false,
      is_active: true,
      account_type: 'revenue',
      subtype: 'service',
      parent_id: 5,
    });
  }
  let leftoverN = 0;
  for (let n = 1190; leftoverN < 100; n += 1) {
    if (n === 1200) continue;
    const who = leftoverN === 0 ? 'Geeta' : `AR leftover ${n}`;
    coa.push({
      id: n,
      code: String(n),
      name: `AR — ${who}`,
      is_header: false,
      is_active: true,
      account_type: 'asset',
      subtype: 'receivable',
      parent_id: 2,
    });
    leftoverN += 1;
  }
  for (let i = 100; i <= 273; i += 1) {
    const stamp = String(4400 + ((i - 100) % 99) + 1);
    customers.push({
      id: i,
      trading_name: `Stamped ${i}`,
      status: 'active',
      customer_type: 'member',
      source: 'advisor_member',
      metadata: { gl_account_code: stamp, ar_account_number: stamp },
    });
  }
  for (let i = 274; i <= 276; i += 1) {
    customers.push({
      id: i,
      trading_name: `Unstamped ${i}`,
      status: 'active',
      customer_type: 'member',
      source: 'advisor_member',
      metadata: {},
    });
  }
  return { coa, customers };
}

const { coa, customers } = buildLiveVuka110();
assert.equal(customers.length, 276);
assert.equal(customers.filter((c) => isCanonical1180ArCode(String(c.metadata?.gl_account_code || ''))).length, 99);
assert.equal(
  customers.filter((c) => /^44[0-9]{2}$/.test(String(c.metadata?.gl_account_code || ''))).length,
  174
);
assert.equal(
  customers.filter((c) => !String(c.metadata?.gl_account_code || '').trim()).length,
  3
);

const revenueHeaderId = 5;
const memberIncome = coa.filter((r) => isLeftoverMemberRevenueLeaf(r, revenueHeaderId));
assert.equal(memberIncome.length, 99);
assert.ok(memberIncome.every((r) => planMemberRevenueLeaf(0) === 'deactivate'));
assert.ok(memberIncome.every((r) => r.code !== '1180-0000012'));

const leftoverAr = coa.filter((r) => isLeftoverIntegerArLeaf(r));
assert.ok(leftoverAr.length >= 100);
const geeta = leftoverAr.find((r) => r.code === '1190')!;
const byCode = new Map(coa.map((r) => [String(r.code), Number(r.id)]));
const geetaPlan = planLeftoverIntegerLeaf({
  leaf: geeta,
  customers,
  suppliers: [],
  byCode,
  journalCount: 0,
});
assert.equal(geetaPlan.action, 'stamp-existing');
assert.equal(geetaPlan.want, '1180-0000012');
assert.equal(geetaPlan.existingId, 1012);

const recodedCoa: PartyCoaRow[] = coa.map((r) => {
  if (isLeftoverMemberRevenueLeaf(r, revenueHeaderId)) {
    return { ...r, is_active: false };
  }
  if (r.id === geeta.id) {
    return { ...r, is_active: false, parent_id: 3 };
  }
  return r;
});

const planned = planPartyGlAccounts({
  customers,
  suppliers: [],
  coa: recodedCoa,
});
assert.equal(
  planned.links.length,
  276
);
assert.ok(planned.links.every((l) => /^1180-\d{7}$/.test(l.code)));
assert.equal(
  planned.links.some((l) => /^44[0-9]{2}$/.test(l.code)),
  false
);
assert.ok(planned.create.some((c) => c.code === '1180-0000276'));

const paint = filterOperatingCoa(
  recodedCoa.map((r) => ({
    code: r.code,
    name: r.name,
    account_type: r.account_type,
    is_header: r.is_header,
    is_active: r.is_active,
  })),
  {}
);
assert.ok(paint.some((a) => a.code === '1180'));
assert.ok(paint.some((a) => a.code === '4400'));
assert.ok(!paint.some((a) => a.code === '1190'));
assert.ok(!paint.some((a) => String(a.code).startsWith('1180-')));
assert.ok(!paint.some((a) => a.code === '4401'));
assert.ok(!paint.some((a) => /^44[0-9]{2}$/.test(String(a.code)) && a.code !== '4400'));

const src = readFileSync(resolve('lib/accounting/party-gl-accounts.ts'), 'utf8');
assert.match(src, /retireLegacyMemberRevenueLeaves\(profileId\)/);
assert.match(src, /recodeLegacyIntegerPartyLeaves\(profileId\)/);
assert.match(
  src.split('export async function ensurePartyGlAccounts')[1] || '',
  /retireLegacyMemberRevenueLeaves/
);
const coaGet = readFileSync(
  resolve('app/api/accounting/chart-of-accounts/route.ts'),
  'utf8'
).split('export async function POST')[0];
assert.doesNotMatch(coaGet, /ensurePartyGlAccounts/);
assert.doesNotMatch(coaGet, /backfillPartyGlAccounts/);
assert.doesNotMatch(coaGet, /retireLegacyMemberRevenueLeaves/);

assert.equal(isForbiddenCustomerArStamp('4402'), true);
assert.equal(clampCustomerArParent('4400'), '1180');
assert.equal(clampCustomerArParent('4402'), '1180');

console.log('brief35-coa-recode.test.ts ok');
