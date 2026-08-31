/**
 * Brief 36 gun 2 — padded 4400 income + 2180 coach AP.
 * Run: npx --yes tsx lib/accounting/brief36-vuka-coa.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isLeftoverMemberRevenueLeaf,
  memberArAccountCode,
  memberRevAccountCode,
  planIntegerMemberRevenueRecode,
  supplierApAccountCode,
} from './party-gl-accounts';

assert.equal(memberRevAccountCode(1), '4400-0000001');
assert.equal(memberRevAccountCode(17), '4400-0000017');
assert.notEqual(memberRevAccountCode(1), '4401');
assert.equal(memberArAccountCode(17), '1180-0000017');
assert.equal(supplierApAccountCode(8), '2180-0000008');

assert.equal(
  isLeftoverMemberRevenueLeaf({
    id: 4500,
    code: '4500',
    name: 'Member — Ada',
    subtype: 'service',
    is_header: false,
    is_active: true,
  }),
  true
);
assert.equal(
  isLeftoverMemberRevenueLeaf({
    id: 4670,
    code: '4670',
    name: 'Member — Zed',
    is_header: false,
    is_active: true,
  }),
  true
);
assert.equal(
  isLeftoverMemberRevenueLeaf({
    id: 5,
    code: '4400',
    name: 'Membership & care revenue',
    is_header: true,
    is_active: true,
  }),
  false
);
assert.equal(
  isLeftoverMemberRevenueLeaf({
    id: 17,
    code: '1180-0000017',
    name: 'AR — Ada',
    is_header: false,
    is_active: true,
  }),
  false
);

const adaPlan = planIntegerMemberRevenueRecode({
  leaf: {
    id: 4503,
    code: '4503',
    name: 'Member — Ada',
    is_header: false,
    is_active: true,
    subtype: 'service',
  },
  customers: [{ id: 17, trading_name: 'Ada', status: 'active' }],
  byCode: new Map([['4503', 4503]]),
  journalCount: 0,
});
assert.equal(adaPlan.action, 'recode');
assert.equal(adaPlan.want, '4400-0000017');
assert.equal(adaPlan.partyId, 17);

const collide = planIntegerMemberRevenueRecode({
  leaf: {
    id: 4503,
    code: '4503',
    name: 'Member — Ada',
    is_header: false,
    is_active: true,
  },
  customers: [{ id: 17, trading_name: 'Ada', status: 'active' }],
  byCode: new Map([
    ['4503', 4503],
    ['4400-0000017', 99],
  ]),
  journalCount: 0,
});
assert.equal(collide.action, 'stamp-existing');
assert.equal(collide.existingId, 99);
assert.equal(collide.want, '4400-0000017');

const src = readFileSync(resolve('lib/accounting/party-gl-accounts.ts'), 'utf8');
assert.doesNotMatch(src, /nextFreeCode\([^)]*4401/);
assert.match(src, /memberRevAccountCode/);
assert.match(src, /recodeMemberRevenueToPadded/);
assert.match(src, /ensureMemberRevLeaf/);

const invoices = readFileSync(resolve('lib/b2c/member-account-ar.ts'), 'utf8');
assert.match(invoices, /memberRevAccountCode/);
assert.match(invoices, /ensureMemberRevLeaf/);

const glTwin = readFileSync(resolve('lib/accounting/invoice-gl.ts'), 'utf8');
assert.match(glTwin, /memberRevAccountCode/);

const receive = readFileSync(resolve('lib/procurement/receive-from-po.ts'), 'utf8');
assert.doesNotMatch(receive, /sell_price\s*=\s*unitCost/);
assert.doesNotMatch(receive, /insertRow\.sell_price/);

const ap = readFileSync(resolve('lib/b2c/advisor-ap-sync.ts'), 'utf8');
assert.match(ap, /ensureAdvisorContractorSupplier/);
assert.match(ap, /ilike\('trading_name'/);

const sql = readFileSync(resolve('RUN_THIS_FOR_BRIEF36.sql'), 'utf8');
assert.match(sql, /sa_brief36_recode_member_rev\(110\)/);
assert.doesNotMatch(sql, /SELECT public\.sa_brief36_recode_member_rev\(102\)/);
assert.match(sql, /4400-/);

console.log('brief36-vuka-coa.test.ts ok');
