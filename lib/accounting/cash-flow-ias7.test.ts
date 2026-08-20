/**
 * Run: npx --yes tsx lib/accounting/cash-flow-ias7.test.ts
 */
import assert from 'node:assert/strict';
import {
  classifyGlForCashFlow,
  isCashAccount,
  isNonCashPnlAccount,
  isWorkingCapitalAccount,
  monthsInRange,
  workingCapitalCashEffect,
} from './cash-flow-ias7';

assert.equal(isCashAccount({ subtype: 'bank', code: '1110' }), true);
assert.equal(isCashAccount({ subtype: 'receivable', code: '1130' }), false);
assert.equal(
  classifyGlForCashFlow({ account_type: 'asset', subtype: 'fixed', code: '1210' }),
  'investing'
);
assert.equal(
  classifyGlForCashFlow({
    account_type: 'expense',
    subtype: 'other',
    source: 'fixed_asset_disposal',
  }),
  'investing'
);
assert.equal(
  classifyGlForCashFlow({ account_type: 'equity', subtype: 'drawings', code: '3300' }),
  'financing'
);
assert.equal(
  classifyGlForCashFlow({ account_type: 'liability', subtype: 'long_term', code: '2210' }),
  'financing'
);
assert.equal(
  classifyGlForCashFlow({ account_type: 'expense', subtype: 'payroll', code: '6100' }),
  'operating'
);
assert.equal(
  classifyGlForCashFlow({ account_type: 'revenue', subtype: 'sales', code: '4100' }),
  'operating'
);

assert.equal(
  isNonCashPnlAccount({ account_type: 'expense', subtype: 'depreciation', code: '6800' })
    .kind,
  'add_back'
);
assert.equal(
  isNonCashPnlAccount({ account_type: 'revenue', code: '4310' }).kind,
  'deduct'
);
assert.equal(
  isWorkingCapitalAccount({
    account_type: 'asset',
    subtype: 'receivable',
    code: '1130',
  }),
  true
);
assert.equal(
  isWorkingCapitalAccount({ account_type: 'asset', subtype: 'bank', code: '1110' }),
  false
);
assert.equal(
  isWorkingCapitalAccount({
    account_type: 'asset',
    subtype: 'contra_asset',
    code: '1135',
  }),
  false
);
assert.equal(workingCapitalCashEffect(1000, 1300), -300);
assert.equal(workingCapitalCashEffect(-400, -700), 300);

assert.deepEqual(monthsInRange('2026-03-01', '2026-05-31'), [
  '2026-03',
  '2026-04',
  '2026-05',
]);
assert.equal(monthsInRange('2026-11-01', '2027-01-15').length, 3);

console.log('cash-flow-ias7 classify ok');
