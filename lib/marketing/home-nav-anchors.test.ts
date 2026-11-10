/**
 * Run: npx --yes tsx lib/marketing/home-nav-anchors.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEGACY_HOME_ANCHOR_TARGETS } from '@/lib/marketing/legacy-home-anchors';

function src(rel: string) {
  return readFileSync(rel, 'utf8');
}

const nav = src('components/marketing/LandingNav.tsx');

assert.match(nav, /const PRIMARY_LINKS/);
assert.match(nav, /href: '\/product'/);
assert.match(nav, /href: '\/modules'/);
assert.match(nav, /href: '\/industries'/);
assert.match(nav, /href: '\/pricing'/);
assert.match(nav, /href: '\/roi'/);
const primaryBlock = nav.split('const PRIMARY_LINKS')[1]?.split('const MORE_LINKS')[0] ?? '';
assert.equal((primaryBlock.match(/href:/g) ?? []).length, 5, 'primary nav should expose exactly 5 links');
assert.doesNotMatch(nav, /href:\s*'\/#/);
assert.doesNotMatch(nav, /revealAndScroll|scrollToHashIfPresent|SPY_SECTIONS/);
assert.match(nav, /legacyHomeAnchorTarget/);

const requiredLegacyIds = [
  'video',
  'stack',
  'systems',
  'whats-new',
  'industry-packs',
  'tradeadvisor',
  'why-join',
  'compare',
  'proof',
  'super-cube',
  'modules',
  'modules-industry',
  'packaging',
  'trust',
  'security',
  'member-app',
  'pricing',
  'roi',
  'industries',
  'catalogues',
  'markets',
  'audiences',
];
for (const id of requiredLegacyIds) {
  assert.ok(LEGACY_HOME_ANCHOR_TARGETS[id], `legacy home anchor map should include ${id}`);
}

console.log('home-nav-anchors.test.ts ok');
