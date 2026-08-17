/**
 * Run: npx --yes tsx lib/billing/advisor-payout.test.ts
 */
import assert from 'node:assert/strict';
import {
  ADVISOR_PLATFORM_FEE_PCT,
  ADVISOR_PAYSTACK_BEARER,
  accountLast4,
  advisorPaystackSplitFromMeta,
  advisorSplitMetadata,
  emptyAdvisorPayoutPublic,
  isAdvisorPayoutReady,
  normalizeAccountNumber,
  previewAdvisorPayoutSplit,
  publicAdvisorPayout,
  readAdvisorPayout,
  writeAdvisorPayout,
  type AdvisorPayoutRecord,
} from './advisor-payout';
import { buildPaystackInitializeBody } from './paystack-plans';

assert.equal(ADVISOR_PLATFORM_FEE_PCT, 1);
assert.equal(ADVISOR_PAYSTACK_BEARER, 'subaccount');
assert.equal(normalizeAccountNumber('  12 345 678 9 '), '123456789');
assert.equal(accountLast4('123456789'), '6789');
assert.equal(accountLast4('12 34'), '1234');

const r1000 = previewAdvisorPayoutSplit(1000);
assert.equal(r1000.member_pays_zar, 1000);
assert.equal(r1000.platform_fee_zar, 10);
assert.equal(r1000.advisor_gross_zar, 990);
assert.equal(r1000.platform_fee_pct, 1);
assert.equal(r1000.bearer, 'subaccount');

const r99 = previewAdvisorPayoutSplit(99.99);
assert.equal(r99.member_pays_zar, 99.99);
assert.equal(r99.platform_fee_zar, 1);
assert.equal(r99.advisor_gross_zar, 98.99);

const rZero = previewAdvisorPayoutSplit(0);
assert.equal(rZero.platform_fee_zar, 0);
assert.equal(rZero.advisor_gross_zar, 0);

const sample: AdvisorPayoutRecord = {
  subaccount_code: 'ACCT_testgym1',
  business_name: 'Balance Physio',
  settlement_bank: '632005',
  settlement_bank_name: 'Absa Bank',
  account_last4: '6047',
  account_name: 'BALANCE PHYSIO',
  percentage_charge: 1,
  bearer: 'subaccount',
  active: true,
  connected_at: '2026-08-16T00:00:00.000Z',
  updated_at: '2026-08-16T00:00:00.000Z',
};

assert.equal(isAdvisorPayoutReady(sample), true);
assert.equal(isAdvisorPayoutReady({ ...sample, active: false }), false);
assert.equal(isAdvisorPayoutReady(null), false);

const pub = publicAdvisorPayout(sample);
assert.equal(pub.ready, true);
assert.equal(pub.account_last4, '6047');
assert.equal(emptyAdvisorPayoutPublic().ready, false);

const meta = writeAdvisorPayout({}, sample);
const read = readAdvisorPayout(meta);
assert.equal(read?.subaccount_code, 'ACCT_testgym1');
assert.equal(read?.percentage_charge, 1);

const split = advisorPaystackSplitFromMeta(meta, 'member');
assert.equal(split.ok, true);
if (split.ok) {
  assert.equal(split.subaccount, 'ACCT_testgym1');
  assert.equal(split.bearer, 'subaccount');
}

const blocked = advisorPaystackSplitFromMeta({}, 'desk');
assert.equal(blocked.ok, false);
if (!blocked.ok) {
  assert.match(blocked.error, /Connect a payout bank/);
}

const memberBlocked = advisorPaystackSplitFromMeta(
  writeAdvisorPayout({}, { ...sample, active: false }),
  'member'
);
assert.equal(memberBlocked.ok, false);
if (!memberBlocked.ok) {
  assert.match(memberBlocked.error, /has not connected/);
}

const extra = advisorSplitMetadata(sample);
assert.equal(extra.advisor_split, true);
assert.equal(extra.platform_fee_pct, 1);
assert.equal(extra.subaccount_code, 'ACCT_testgym1');

const saasBody = buildPaystackInitializeBody({
  email: 'owner@example.com',
  amountCents: 29900,
  reference: 'sa-co-sub-1',
});
assert.equal(saasBody.subaccount, undefined);
assert.equal(saasBody.bearer, undefined);
assert.deepEqual(saasBody.channels, [
  'apple_pay',
  'card',
  'bank',
  'ussd',
  'qr',
  'mobile_money',
  'bank_transfer',
  'eft',
]);

const memberBody = buildPaystackInitializeBody({
  email: 'member@example.com',
  amountCents: 100000,
  reference: 'sa-memacc-1',
  subaccount: 'ACCT_testgym1',
  bearer: 'subaccount',
  metadata: { product: 'member_account' },
});
assert.equal(memberBody.subaccount, 'ACCT_testgym1');
assert.equal(memberBody.bearer, 'subaccount');
assert.equal(memberBody.amount, 100000);
assert.equal((memberBody.metadata as { product: string }).product, 'member_account');

console.log('advisor-payout.test.ts ok');
