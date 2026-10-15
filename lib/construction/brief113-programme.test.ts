/**
 * Critical path, baseline, and extension of time.
 * Run: npx --yes tsx lib/construction/brief113-programme.test.ts
 */
import assert from 'node:assert/strict';
import { emptyConstructiongraphStore, type ConstructionProgrammeRow } from './constructiongraph';
import { applyEotDays, baselineProgramme, criticalPathIds, reviseEnd, shiftProgrammeRow } from './programme-model';

function row(partial: Partial<ConstructionProgrammeRow> & { id: string }): ConstructionProgrammeRow {
  return {
    activity: partial.id,
    planned_start: '2026-10-01',
    planned_end: '2026-10-05',
    kind: 'task',
    depends_on: [],
    ...partial,
  };
}

const chain = criticalPathIds([
  row({ id: 'a', planned_end: '2026-10-03' }),
  row({ id: 'b', depends_on: ['a'], planned_start: '2026-10-04', planned_end: '2026-10-08' }),
  row({ id: 'c', depends_on: ['b'], planned_start: '2026-10-09', planned_end: '2026-10-10' }),
]);
assert.deepEqual(chain, ['a', 'b', 'c']);

const diamond = criticalPathIds([
  row({ id: 'start', planned_end: '2026-10-02' }),
  row({ id: 'long', depends_on: ['start'], planned_start: '2026-10-03', planned_end: '2026-10-12' }),
  row({ id: 'short', depends_on: ['start'], planned_start: '2026-10-03', planned_end: '2026-10-04' }),
  row({ id: 'end', depends_on: ['long', 'short'], planned_start: '2026-10-13', planned_end: '2026-10-14' }),
]);
assert.deepEqual(diamond, ['start', 'long', 'end']);

const cycle = criticalPathIds([
  row({ id: 'a', depends_on: ['b'] }),
  row({ id: 'b', depends_on: ['a'] }),
]);
assert.ok(cycle.every((id) => id === 'a' || id === 'b'));

const missing = criticalPathIds([row({ id: 'solo', depends_on: ['missing'] })]);
assert.deepEqual(missing, ['solo']);

const shifted = applyEotDays([row({ id: 'walls', planned_end: '2026-10-20' })], ['walls'], 3);
assert.equal(shifted[0]?.planned_end, '2026-10-20');
assert.equal(shifted[0]?.eot_days, 3);
assert.equal(reviseEnd(shifted[0]!).revisedEnd, '2026-10-23');

let store = emptyConstructiongraphStore();
store = { ...store, programme: [row({ id: 'task', site_id: 's1' })] };
const first = baselineProgramme(store, 's1', false);
assert.equal(first.ok, true);
if (!first.ok) throw new Error('baseline');
assert.equal(first.store.programme[0]?.baseline_start, '2026-10-01');
const again = baselineProgramme(first.store, 's1', false);
assert.equal(again.ok, false);
if (again.ok) throw new Error('expected confirm');
assert.equal(again.needsConfirm, true);
const moved = shiftProgrammeRow(first.store, 'task', 1);
assert.equal(moved.programme[0]?.planned_start, '2026-10-02');
assert.equal(moved.programme[0]?.baseline_start, '2026-10-01');

console.log('brief113-programme.test.ts ok');
