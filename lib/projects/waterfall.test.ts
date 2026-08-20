/**
 * Run: npx --yes tsx lib/projects/waterfall.test.ts
 */
import assert from 'node:assert/strict';
import {
  dateRangeOverlaps,
  daysBetween,
  ganttPct,
  seedWaterfallTasks,
  waterfallWindows,
} from './waterfall';

assert.equal(daysBetween('2026-01-01', '2026-01-11'), 10);

const win = waterfallWindows('2026-01-01', '2026-03-11');
assert.equal(win.length, 5);
assert.equal(win[0].key, 'initiate');
assert.equal(win[0].start, '2026-01-01');
assert.equal(win[4].key, 'close');
assert.equal(win[4].end, '2026-03-11');
for (let i = 1; i < win.length; i++) {
  assert.ok(win[i].start >= win[i - 1].end, 'phases are sequential');
}

const seeds = seedWaterfallTasks('2026-08-01', '2026-08-20');
assert.equal(seeds.length, 5);
assert.equal(seeds[0].column_key, 'todo');
assert.equal(seeds[2].title, 'Execute');

assert.equal(dateRangeOverlaps('2026-02-01', '2026-02-28', '2026-01-01', '2026-03-31'), true);
assert.equal(dateRangeOverlaps('2026-04-01', '2026-04-30', '2026-01-01', '2026-03-31'), false);
assert.equal(ganttPct('2026-01-16', '2026-01-01', '2026-01-31') > 40, true);

console.log('waterfall.test.ts ok');
