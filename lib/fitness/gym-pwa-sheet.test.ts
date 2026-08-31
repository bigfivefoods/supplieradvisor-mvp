/**
 * Run: npx --yes tsx lib/fitness/gym-pwa-sheet.test.ts
 */
import assert from 'node:assert/strict';
import { popGymPwaSheet, pushGymPwaSheet } from './gym-pwa-sheet';

const start = ['library'] as const;
const stacked = pushGymPwaSheet([...start], 'movement');
assert.deepEqual(stacked, ['library', 'movement']);

const back = popGymPwaSheet(stacked);
assert.deepEqual(back, ['library']);
assert.equal(back.includes('library'), true);

console.log('gym-pwa-sheet.test.ts ok');
