/**
 * Gym View portal must not auto-iframe the live site (that made the desk jump).
 * Run: npx --yes tsx lib/advisors/gym-portal-preview-stable.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const grow = readFileSync(
  resolve('components/advisors/AdvisorGrowPreviews.tsx'),
  'utf8'
);
assert.match(grow, /Load live website/);
assert.match(grow, /sandbox=/);
assert.match(grow, /renderPhone/);
assert.doesNotMatch(grow, /screens=\{/);
assert.match(grow, /liveFrame/);

const desk = readFileSync(
  resolve('components/advisors/AdvisorPortalPreviewDesk.tsx'),
  'utf8'
);
assert.match(desk, /sectionKey/);
assert.match(desk, /JSON\.stringify\(readPortalSectionMap/);

console.log('gym-portal-preview-stable.test.ts ok');
