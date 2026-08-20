/**
 * Run: npx --yes tsx lib/accounting/pipeline-forecast.test.ts
 */
import assert from 'node:assert/strict';
import { buildPipelineForecastFromRows } from './pipeline-forecast';

const pack = buildPipelineForecastFromRows({
  from: '2026-03-01',
  to: '2026-05-31',
  rows: [
    {
      id: 1,
      name: 'Gym memberships',
      stage: 'proposal',
      amount: 10000,
      probability: 60,
      expected_close_date: '2026-04-15',
      company_name: 'VUKA',
    },
    {
      id: 2,
      name: 'Won deal',
      stage: 'closed_won',
      amount: 4000,
      actual_close_date: '2026-03-20',
    },
    {
      id: 3,
      name: 'Outside slice',
      stage: 'negotiation',
      amount: 8000,
      expected_close_date: '2026-08-01',
    },
    {
      id: 4,
      name: 'Lost',
      stage: 'closed_lost',
      amount: 2000,
      expected_close_date: '2026-05-02',
    },
  ],
});

assert.equal(pack.summary.openDeals, 1);
assert.equal(pack.summary.expected, 10000);
assert.equal(pack.summary.weighted, 6000);
assert.equal(pack.summary.won, 4000);
assert.equal(pack.summary.lost, 2000);
assert.equal(pack.summary.wonDeals, 1);
assert.equal(pack.months.length, 3);
assert.equal(pack.months[1].month, '2026-04');
assert.equal(pack.months[1].expected, 10000);
assert.equal(pack.months[1].weighted, 6000);
assert.equal(pack.rows.some((r) => r.id === 3), false);

console.log('pipeline-forecast.test.ts ok');
