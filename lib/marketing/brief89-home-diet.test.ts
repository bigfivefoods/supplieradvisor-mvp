/**
 * Brief 89/97 — homepage composition + lazy module-loading guardrails.
 * Run: npx --yes tsx lib/marketing/brief89-home-diet.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function src(rel: string) {
  return readFileSync(rel, 'utf8');
}

const page = src('app/page.tsx');
assert.match(page, /HeroAudienceStage/, 'home page should include hero');
assert.match(page, /HomeBelowFoldLazy/, 'home page should include lazy below-fold boundary');
assert.match(page, /COMPANY_TRIAL_DAYS/, 'home page should include compact trial CTA strip');
assert.match(page, /href="\/onboarding\?lane=b2b"/, 'trial CTA should route to /onboarding?lane=b2b');
const mainCount = page.match(/<main[\s>]/g)?.length ?? 0;
assert.equal(mainCount, 1, 'home page should render exactly one <main> landmark');

assert.doesNotMatch(page, /next\/dynamic/);
assert.doesNotMatch(page, /ProductMocks/);
assert.doesNotMatch(page, /@privy-io\/react-auth/);
assert.doesNotMatch(page, /\bviem\b/);
assert.doesNotMatch(page, /\bundici\b/);

const description = page.match(/description:\s*'([^']+)'/);
assert.ok(description?.[1], 'home metadata description should be present');
assert.ok(description![1].length <= 160, 'home metadata description should stay concise');

const lazy = src('components/marketing/HomeBelowFoldLazy.tsx');
assert.match(lazy, /ssr:\s*false/);
assert.match(lazy, /HomeBelowFold/);

const homeBelowFold = src('components/marketing/HomeBelowFold.tsx');
assert.match(
  homeBelowFold,
  /from\s+['"]@\/components\/marketing\/ProductMocks['"]/,
  'home below-fold should import ProductMocks for restored module richness'
);

const requiredSections = [
  'markets',
  'member-app',
  'why-join',
  'systems',
  'modules',
  'packaging',
  'trust',
  'audiences',
];
for (const id of requiredSections) {
  assert.match(homeBelowFold, new RegExp(`id="${id}"`), `home below-fold should include #${id}`);
}

console.log('brief89-home-diet.test.ts ok');
