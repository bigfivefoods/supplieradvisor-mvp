/**
 * Run: npx --yes tsx lib/accounting/cash-flow-ias7.test.ts
 */
import assert from 'node:assert/strict';
import { classifyGlForCashFlow, isCashAccount } from './cash-flow-ias7';

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

console.log('cash-flow-ias7 classify ok');
