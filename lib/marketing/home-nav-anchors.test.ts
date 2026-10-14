/**
 * Navbar section targets stay reachable while the homepage below-fold stays lazy.
 * Run: npx --yes tsx lib/marketing/home-nav-anchors.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LAZY_HOME_SECTION_IDS } from './home-nav-sections';

function src(rel: string) {
  return readFileSync(rel, 'utf8');
}

const nav = src('components/marketing/LandingNav.tsx');
const lazy = src('components/marketing/HomeBelowFoldLazy.tsx');
const scroll = src('lib/marketing/home-section-scroll.ts');
const css = src('app/globals.css');

const sectionIds = [...nav.matchAll(/section:\s*'([^']+)'/g)].map((match) => match[1]);
assert.ok(sectionIds.length >= 8, 'landing nav should declare section targets');
for (const id of sectionIds) {
  assert.ok(
    (LAZY_HOME_SECTION_IDS as readonly string[]).includes(id),
    `navbar section #${id} must be a lazy-home anchor`
  );
}
for (const id of LAZY_HOME_SECTION_IDS) {
  assert.ok(sectionIds.includes(id), `lazy anchor #${id} should be a navbar section`);
  assert.match(lazy, new RegExp(`LAZY_HOME_SECTION_IDS`), 'placeholders should come from the shared id list');
}

assert.match(lazy, /ssr:\s*false/);
assert.match(lazy, /data-sa-anchor-placeholder/);
assert.match(lazy, /data-home-below-fold/);
assert.match(lazy, /subscribeHomeBelowFold/);
assert.match(lazy, /isLazyHomeSection/);
assert.doesNotMatch(lazy, /setTimeout\(\(\) => \{\s*void import\('@\/components\/marketing\/HomeRecent'\)/);

assert.match(nav, /revealAndScroll/);
assert.match(nav, /data-nav-section=\{l\.section\}/);
assert.match(nav, /localizedPath\(locale, '\/'\)/);
assert.doesNotMatch(nav, /scrollIntoView/);

assert.match(scroll, /data-landing-nav/);
assert.match(scroll, /requestHomeBelowFold/);
assert.match(scroll, /HOME_ANCHOR_PLACEHOLDER_ATTR/);
assert.match(scroll, /'instant'/);

assert.match(css, /\.sa-anchor\s*\{[^}]*scroll-margin-top:\s*var\(--sa-nav-offset\)/s);

const below = src('components/marketing/HomeBelowFold.tsx');
const video = src('components/marketing/ProductVideo.tsx');
const pricing = src('components/marketing/HomePricing.tsx');
const roi = src('components/marketing/RoiCalculator.tsx');
const industries = src('components/marketing/IndustriesStrip.tsx');
const ownedBy = {
  video,
  'member-app': below,
  'why-join': below,
  modules: below,
  packaging: below,
  pricing,
  roi,
  industries,
} as const;

for (const [id, file] of Object.entries(ownedBy)) {
  assert.match(file, new RegExp(`id=["']${id}["']|id=\\{PRICING_SECTION_IDS\\.pricing\\}`), `#${id} should stay on its section`);
  assert.match(file, /sa-anchor/, `#${id} should keep the sticky-header scroll margin`);
}

console.log('home-nav-anchors.test.ts ok');
