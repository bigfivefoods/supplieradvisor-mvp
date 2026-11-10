/**
 * Run: npx --yes tsx lib/marketing/brief89-home-diet.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function src(rel: string) {
  return readFileSync(rel, 'utf8');
}

const page = src('app/page.tsx');
assert.match(page, /HomeLanding/);
assert.doesNotMatch(page, /next\/dynamic/);
assert.doesNotMatch(page, /@privy-io\/react-auth/);
assert.doesNotMatch(page, /\bviem\b|\bwagmi\b|\bundici\b/);

const landing = src('components/marketing/HomeLanding.tsx');
assert.match(landing, /HeroAudienceStage/);
assert.match(landing, /id="book-demo"/);
assert.match(landing, /\/business/);
assert.match(landing, /\/sa-member/);
assert.match(landing, /\/government/);
assert.match(landing, /\/modules/);
assert.match(landing, /id="guided-tour"/);
assert.doesNotMatch(landing, /HomeBelowFoldLazy/);
assert.doesNotMatch(landing, /home\.bookSample/);
assert.equal(landing.match(/<section/g)?.length, 4, 'home main should include four explicit sections after hero');

const hero = src('components/marketing/HeroAudienceStage.tsx');
assert.match(hero, /href=\{startFreeHref\}/);
assert.match(hero, /bookDemoHref/);
assert.doesNotMatch(hero, /hero\.businessRun/);
assert.doesNotMatch(hero, /href="#compare"/);

const nav = src('components/marketing/LandingNav.tsx');
assert.doesNotMatch(nav, /dict\/(fr|ar|pt|sw|zu)/);
assert.doesNotMatch(nav, /@privy-io\/react-auth|\bviem\b|\bwagmi\b|\bundici\b/);

console.log('brief89-home-diet.test.ts ok');
