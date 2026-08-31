/**
 * Run: npx --yes tsx lib/fitness/gym-pwa-theme.test.ts
 */
import assert from 'node:assert/strict';
import {
  gymPwaFieldClass,
  validateGymPwaFieldClassTokens,
} from './gym-pwa-theme';

const valid = validateGymPwaFieldClassTokens(gymPwaFieldClass);
assert.deepEqual(valid.missing, []);
assert.deepEqual(valid.forbidden, []);

const noDarkText = validateGymPwaFieldClassTokens(
  gymPwaFieldClass.replace('dark:text-white', '')
);
assert.ok(noDarkText.missing.includes('dark:text-white'));

const badYellowDark = validateGymPwaFieldClassTokens(
  `${gymPwaFieldClass} dark:bg-yellow-950`
);
assert.ok(badYellowDark.forbidden.includes('dark:bg-yellow-950'));

console.log('gym-pwa-theme.test.ts ok');
