/**
 * Run: npx --yes tsx lib/fitness/person-records.test.ts
 */
import assert from 'node:assert/strict';
import {
  healthFromInjuries,
  injuriesForPerson,
  parsePersonalBests,
  removeInjuryEntry,
  upsertInjuryEntry,
  upsertPersonalBest,
} from './person-records';

const pbs = upsertPersonalBest([], { title: 'Back squat', value: '140', unit: 'kg' });
assert.equal(pbs.error, undefined);
assert.equal(pbs.list.length, 1);
assert.equal(pbs.row.title, 'Back squat');
const again = upsertPersonalBest(pbs.list, {
  id: pbs.row.id,
  title: 'Back squat',
  value: '145',
  unit: 'kg',
});
assert.equal(again.list.length, 1);
assert.equal(again.row.value, '145');
assert.equal(parsePersonalBests(again.list)[0].unit, 'kg');

const miss = upsertPersonalBest([], { title: 'Bench' });
assert.ok(miss.error);

const inj = upsertInjuryEntry([], {
  area: 'Knee',
  side: 'left',
  status: 'recovering',
  pain_score: 4,
});
assert.equal(inj.list.length, 1);
const health = healthFromInjuries(inj.list);
assert.equal(health.injured, true);
assert.deepEqual(health.injury_areas, ['Knee']);
assert.equal(health.injury_status, 'recovering');

const cleared = upsertInjuryEntry(inj.list, {
  id: inj.row.id,
  area: 'Knee',
  status: 'cleared',
});
assert.equal(healthFromInjuries(cleared.list).injured, false);

const gone = removeInjuryEntry(cleared.list, inj.row.id);
assert.equal(gone.length, 0);

const lifted = injuriesForPerson({
  health: {
    injured: true,
    injury_areas: ['Shoulder'],
    injury_status: 'acute',
    injury_notes: 'Pressing aggravates it',
  },
});
assert.equal(lifted.length, 1);
assert.equal(lifted[0].area, 'Shoulder');

console.log('person-records.test.ts ok');
