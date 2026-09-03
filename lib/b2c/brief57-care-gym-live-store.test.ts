/**
 * Brief 57 — gym Member Care must read live fitgraph module-store data and
 * never full-save fossil metadata just to mint feedback tokens.
 *
 * Run: npx --yes tsx lib/b2c/brief57-care-gym-live-store.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const care = readFileSync(resolve(__dirname, 'care.ts'), 'utf8');

const gymBlock =
  care.match(
    /if \(mem\.kind === 'gym'\) \{[\s\S]*?\n    }\n\n    if \(!isClinicKindHref\(mem\.kind\) && mem\.kind !== 'hire' && mem\.kind !== 'retail'\) \{/
  )?.[0] || '';

assert.ok(gymBlock, 'gym branch should be present in lib/b2c/care.ts');

// 1) Gym care must load from canonical fitgraph module-store data, not a raw
//    profiles.metadata select that feeds readFitgraphFromMetadata.
assert.match(
  gymBlock,
  /loadAdvisorModuleStore\(companyId,\s*'fitgraph',\s*readFitgraphFromMetadata\)/,
  'gym care should load fitgraph via loadAdvisorModuleStore'
);
assert.doesNotMatch(
  gymBlock,
  /\.from\('profiles'\)[\s\S]*?\.select\('metadata'\)/,
  'gym care should not select profiles.metadata'
);

// 2) Dirty gym token maintenance must never full-save fitgraph metadata from
//    care. It may only patch bookings, or skip the write entirely.
assert.match(
  gymBlock,
  /companyId !== 102 && hasLiveFitgraphStore/,
  'company 102 and metadata-fallback gym paths must skip care writes'
);
assert.doesNotMatch(
  gymBlock,
  /saveAdvisorModuleStore\(/,
  'gym care must not full-save fitgraph from care'
);
assert.match(
  care,
  /saveFitgraphPatch\(\s*companyId,\s*\{\s*bookings:\s*store\.bookings\s*},\s*\{\s*ifUpdatedAt:\s*gymCareUpdatedAt\(store\)\s*}\s*\)/,
  'gym care dirty path must patch bookings only with stale-write protection'
);

// 3) Clinic regression: clinic care loaders remain on loadAdvisorModuleStore.
assert.match(
  care,
  /if \(kind === 'physio'\) \{[\s\S]*?loadAdvisorModuleStore\(\s*companyId,\s*'physiograph'/,
  'physio clinic care should still load via loadAdvisorModuleStore'
);
assert.match(
  care,
  /if \(kind === 'dental'\) \{[\s\S]*?loadAdvisorModuleStore\(\s*companyId,\s*'dentalgraph'/,
  'dental clinic care should still load via loadAdvisorModuleStore'
);

// 4) Stale collisions must be handled safely: reload fresh canonical state and
//    retry the bookings-only patch instead of overwriting newer edits.
assert.match(
  care,
  /if \(!isStaleModuleStoreError\(error\)\) throw error;[\s\S]*loadAdvisorModuleStore\(\s*companyId,\s*'fitgraph',\s*readFitgraphFromMetadata,\s*\[\],\s*\{\s*fresh:\s*true\s*}\s*\)/,
  'stale gym token maintenance should reload the canonical fitgraph store'
);
assert.match(
  care,
  /const dirty = ensureClientRatingTokens\(latest\.bookings[\s\S]*saveFitgraphPatch\(\s*companyId,\s*\{\s*bookings:\s*latest\.bookings\s*},\s*\{\s*ifUpdatedAt:\s*gymCareUpdatedAt\(latest\)\s*}\s*\)/,
  'stale gym token maintenance should retry with a bookings-only patch'
);

console.log('brief57-care-gym-live-store.test.ts ok');
