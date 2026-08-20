/**
 * Run: npx --yes tsx lib/accounting/cash-flow-budget.test.ts
 */
import assert from 'node:assert/strict';
import { planOperatingCashFromBudgetRows } from './cash-flow-budget';

const plan = planOperatingCashFromBudgetRows({
  fyStartMonth: 3,
  from: '2026-03-01',
  to: '2026-05-31',
  rows: [
    {
      account_id: 1,
      account_type: 'revenue',
      fiscal_year: 2026,
      months: { m01: 1000, m02: 1100, m03: 1200 },
    },
    {
      account_id: 2,
      account_type: 'expense',
      fiscal_year: 2026,
      months: { m01: 400, m02: 400, m03: 500 },
    },
    {
      account_id: 3,
      account_type: 'cogs',
      fiscal_year: 2026,
      months: { m01: 100, m02: 0, m03: 0 },
    },
  ],
});
assert.equal(plan.set, true);
assert.equal(plan.operatingInflow, 3300);
assert.equal(plan.operatingOutflow, 1400);
assert.equal(plan.netOperating, 1900);
assert.equal(plan.months.length, 3);
assert.equal(plan.months[0].month, '2026-03');
assert.equal(plan.months[0].net, 500);

const empty = planOperatingCashFromBudgetRows({
  fyStartMonth: 3,
  from: '2026-03-01',
  to: '2026-03-31',
  rows: [],
});
assert.equal(empty.set, false);

console.log('cash-flow-budget.test.ts ok');
