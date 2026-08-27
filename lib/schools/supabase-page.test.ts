/**
 * Run: npx --yes tsx lib/schools/supabase-page.test.ts
 */
import assert from 'node:assert/strict';
import { FETCH_ALL_HARD_CAP, pagedOffsets } from './supabase-page';

assert.equal(FETCH_ALL_HARD_CAP, 5000);
assert.deepEqual(pagedOffsets(400, 1000, 5000), []);
assert.deepEqual(pagedOffsets(1000, 1000, 5000), []);
assert.deepEqual(pagedOffsets(2500, 1000, 5000), [1000, 2000]);
assert.deepEqual(
  pagedOffsets(200000, 1000, 5000),
  [1000, 2000, 3000, 4000]
);
assert.deepEqual(pagedOffsets(800, 500, 500), []);

console.log('supabase-page tests ok');
