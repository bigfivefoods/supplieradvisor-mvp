/**
 * Run: npx --yes tsx lib/advisors/grow-preview.test.ts
 */
import assert from 'node:assert/strict';
import { growPreviewCopy, growWebsiteNav } from './grow-preview';

const gym = growPreviewCopy('fitgraph');
assert.equal(gym.audienceSingular, 'member');
assert.ok(gym.pwaTabs.includes('Class'));
assert.ok(gym.pwaTabs.includes('You'));
assert.equal(gym.pwaActiveTab, 'Class');
assert.equal(gym.showProgramme, true);
assert.ok(gym.programmeName);

const physio = growPreviewCopy('physiograph');
assert.equal(physio.audienceSingular, 'patient');
assert.ok(physio.pwaTabs.includes('Open diary'));
const hire = growPreviewCopy('hiregraph');
assert.equal(hire.audienceSingular, 'customer');
assert.equal(hire.pwaEyebrow, 'Customer portal · HireAdvisor®');
assert.deepEqual(hire.pwaTabs, ['Shop', 'Coming', 'You', 'History', 'Nearby']);

assert.deepEqual(growWebsiteNav('fitgraph').slice(0, 2), [
  'Class timetable',
  'Coaches',
]);
assert.ok(growWebsiteNav('medicalgraph').includes('Open diary'));
assert.ok(growWebsiteNav('hiregraph').includes('Catalogue'));
assert.ok(growWebsiteNav('hiregraph').includes('Hours & visit'));
assert.ok(growWebsiteNav('retailgraph').includes('Shop'));
assert.ok(growWebsiteNav('retailgraph').includes('Hours & visit'));
assert.equal(growPreviewCopy('fitgraph').showWeekDiary, true);
assert.equal(growPreviewCopy('hiregraph').showWeekDiary, false);
assert.equal(growPreviewCopy('hiregraph').color, '#0891b2');
assert.equal(growPreviewCopy('fitgraph').staffRole, 'contracted coach');
assert.equal(
  growPreviewCopy('medicalgraph').staffRole,
  'contracted practitioner'
);
assert.equal(growPreviewCopy('hiregraph').staffRole, null);

console.log('grow-preview.test.ts ok');
