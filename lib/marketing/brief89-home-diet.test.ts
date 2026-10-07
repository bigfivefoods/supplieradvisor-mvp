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
assert.match(page, /HomeLanding/, 'home page should render HomeLanding shell');
const mainCount = page.match(/<main[\s>]/g)?.length ?? 0;
assert.equal(mainCount, 0, 'home page shell should not inline additional <main> landmarks');

assert.doesNotMatch(page, /next\/dynamic/);
assert.doesNotMatch(page, /ProductMocks/);
assert.doesNotMatch(page, /@privy-io\/react-auth/);
assert.doesNotMatch(page, /\bviem\b/);
assert.doesNotMatch(page, /\bwagmi\b/);
assert.doesNotMatch(page, /\bundici\b/);
assert.doesNotMatch(page, /dict\/(fr|ar|pt|sw|zu)/);

const description = page.match(/description:\s*'([^']+)'/);
assert.ok(description?.[1], 'home metadata description should be present');
assert.ok(description![1].length <= 160, 'home metadata description should stay concise');

const landing = src('components/marketing/HomeLanding.tsx');
assert.match(landing, /HeroAudienceStage/, 'home landing should include hero');
assert.match(landing, /HomeBelowFoldLazy/, 'home landing should include lazy below-fold boundary');
assert.match(landing, /COMPANY_TRIAL_DAYS/, 'home landing should include compact trial CTA strip');
assert.match(landing, /onboarding\?lane=b2b/, 'trial CTA should route to /onboarding?lane=b2b');
const landingMainCount = landing.match(/<main[\s>]/g)?.length ?? 0;
assert.equal(landingMainCount, 1, 'home landing should render exactly one <main> landmark');

const lazy = src('components/marketing/HomeBelowFoldLazy.tsx');
assert.match(lazy, /ssr:\s*false/);
assert.match(lazy, /HomeBelowFold/);

const nav = src('components/marketing/LandingNav.tsx');
assert.doesNotMatch(nav, /dict\/(fr|ar|pt|sw|zu)/);
assert.doesNotMatch(nav, /@privy-io\/react-auth|\bviem\b|\bwagmi\b|\bundici\b/);

const hero = src('components/marketing/HeroAudienceStage.tsx');
assert.doesNotMatch(hero, /dict\/(fr|ar|pt|sw|zu)/);
assert.doesNotMatch(hero, /@privy-io\/react-auth|\bviem\b|\bwagmi\b|\bundici\b/);

const footer = src('components/marketing/SiteFooter.tsx');
assert.doesNotMatch(footer, /dict\/(fr|ar|pt|sw|zu)/);
assert.doesNotMatch(footer, /@privy-io\/react-auth|\bviem\b|\bwagmi\b|\bundici\b/);

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
