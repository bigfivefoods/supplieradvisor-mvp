/**
 * Run: npx --yes tsx lib/fitness/movement-art.test.ts
 */
import assert from 'node:assert/strict';
import {
  figurePaths,
  movementDisplayDescription,
  movementPoseImageSrc,
  resolveMovementPose,
} from './movement-art';

assert.equal(resolveMovementPose('Back squat', 'Squat'), 'squat');
assert.equal(resolveMovementPose('Romanian deadlift', 'Hinge'), 'hinge');
assert.equal(resolveMovementPose('Kettlebell swing', 'Hinge'), 'swing');
assert.equal(resolveMovementPose('Pull-up', 'Pull'), 'pullup');
assert.equal(resolveMovementPose('Farmer carry', 'Carry'), 'carry');
assert.equal(resolveMovementPose('Box jump', 'Plyometric'), 'jump');
assert.ok(figurePaths('squat', 1).length > 10);
assert.ok(figurePaths('bike', 2).length > 10);
assert.equal(movementPoseImageSrc('squat'), '/images/movements/squat.jpg');
assert.equal(movementPoseImageSrc('pullup'), '/images/movements/pullup.jpg');

const copy = movementDisplayDescription({
  overview: 'Short overview of the lift for coaches.',
  details: 'Longer coaching details live here for the library card.',
});
assert.equal(copy.overview.includes('Short overview'), true);
assert.equal(copy.details.includes('Longer coaching'), true);

console.log('movement-art ok');
