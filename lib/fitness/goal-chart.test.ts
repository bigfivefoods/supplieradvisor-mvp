/**
 * Run: npx --yes tsx lib/fitness/goal-chart.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildGoalSeries,
  formatGoalTick,
  goalPeriodRange,
  goalYDomain,
  sliceGoalSeries,
} from './goal-chart';

const now = new Date(2026, 7, 24, 12, 0, 0, 0);
assert.equal(goalPeriodRange('1w', { now }).from, '2026-08-18');
assert.equal(goalPeriodRange('1w', { now }).to, '2026-08-24');
assert.equal(goalPeriodRange('1m', { now }).from, '2026-07-26');
assert.deepEqual(
  goalPeriodRange('custom', {
    now,
    customFrom: '2026-01-01',
    customTo: '2026-03-01',
  }),
  { from: '2026-01-01', to: '2026-03-01' }
);
assert.deepEqual(
  goalPeriodRange('custom', {
    now,
    customFrom: '2026-03-01',
    customTo: '2026-01-01',
  }),
  { from: '2026-01-01', to: '2026-03-01' }
);

const series = buildGoalSeries({
  start_value: 90,
  start_date: '2026-06-01',
  actual: 82,
  check_ins: [
    { at: '2026-07-01T00:00:00.000Z', metric_value: 88 },
    { at: '2026-08-01T00:00:00.000Z', metric_value: 84 },
  ],
});
assert.equal(series[0].v, 90);
assert.equal(series[1].v, 88);
assert.equal(series[2].v, 84);
assert.equal(series[series.length - 1].v, 82);

const from = Date.parse('2026-07-15T12:00:00');
const to = Date.parse('2026-08-24T12:00:00');
const sliced = sliceGoalSeries(series, from, to);
assert.equal(sliced[0].t, from);
assert.equal(sliced[0].v, 88);

const d = goalYDomain([10, 20], 15);
assert.ok(d.min < 10 && d.max > 20);
assert.equal(formatGoalTick(82.4), '82.4');
assert.equal(formatGoalTick(182), '182');

console.log('goal-chart.test.ts ok');
