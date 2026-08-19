/**
 * Run: npx --yes tsx lib/movements/exercise-catalog.test.ts
 */
import assert from 'node:assert/strict';
import {
  EXERCISE_CATALOG,
  defaultExerciseVideoSrc,
  exerciseCodeToId,
  listedExerciseFromRow,
  mergeCatalogWithOverrides,
  patternSlug,
} from './exercise-catalog';

assert.ok(EXERCISE_CATALOG.length >= 2200, EXERCISE_CATALOG.length);
const codes = EXERCISE_CATALOG.map((r) => r.code);
assert.equal(new Set(codes).size, codes.length);
const names = EXERCISE_CATALOG.map((r) => r.name.toLowerCase());
assert.equal(new Set(names).size, names.length);

const deadlift = EXERCISE_CATALOG.find((r) => r.name === 'Barbell Deadlift');
assert.ok(deadlift);
assert.equal(deadlift.modality, 'Strength');
assert.equal(deadlift.muscle_group, 'Hamstrings');
assert.equal(deadlift.movement_pattern, 'Lower Body Hinge');

const listed = listedExerciseFromRow(deadlift);
assert.equal(listed.id, exerciseCodeToId(deadlift.code));
assert.equal(
  listed.video_url,
  defaultExerciseVideoSrc('Lower Body Hinge')
);
assert.equal(patternSlug('Core Flexion / Extension'), 'core-flexion-extension');
assert.equal(patternSlug(''), 'generic');

const merged = mergeCatalogWithOverrides(
  [
    {
      id: listed.id,
      code: deadlift.code,
      name: 'Barbell Deadlift',
      image_url: '/custom.jpg',
    },
  ],
  (row, override) => ({
    ...row,
    image_url: override?.image_url || row.image_url,
  })
);
assert.equal(
  merged.find((m) => m.code === deadlift.code)?.image_url,
  '/custom.jpg'
);

console.log(`exercise-catalog ok (${EXERCISE_CATALOG.length} unique)`);
