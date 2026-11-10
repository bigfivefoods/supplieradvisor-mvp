/**
 * Run: npx --yes tsx lib/marketing/site-footer-links.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FOOTER_EXPLORE_GROUPS,
  FOOTER_INDUSTRY_GROUPS,
  FOOTER_LEGAL_LINKS,
  FOOTER_RESOURCE_GROUPS,
} from '@/lib/marketing/site-footer';
import { getIndustry, industrySlugs } from '@/lib/marketing/industries';

const root = process.cwd();

const contentGroups = [
  ...FOOTER_EXPLORE_GROUPS,
  ...FOOTER_INDUSTRY_GROUPS,
  ...FOOTER_RESOURCE_GROUPS,
];
const allGroups = [...contentGroups, { label: 'Legal', links: FOOTER_LEGAL_LINKS }];
const allHrefs = allGroups.flatMap((group) => group.links.map((link) => link.href));
const internalHrefs = allHrefs.filter((href) => href.startsWith('/'));

function stripUrlBits(href: string) {
  return href.split('#')[0]!.split('?')[0]!;
}

function routePagePath(route: string) {
  if (route === '/') return resolve(root, 'app/page.tsx');
  const clean = route.replace(/^\//, '');
  return resolve(root, `app/${clean}/page.tsx`);
}

for (const href of internalHrefs) {
  const route = stripUrlBits(href);

  if (route.startsWith('/industries/') && route !== '/industries') {
    const slug = route.slice('/industries/'.length);
    assert.ok(
      industrySlugs().includes(slug as ReturnType<typeof industrySlugs>[number]),
      `${href}: unknown industry slug`
    );
    assert.ok(existsSync(resolve(root, 'app/industries/[slug]/page.tsx')), 'industries dynamic page missing');
    continue;
  }

  assert.ok(existsSync(routePagePath(route)), `${href}: expected matching app/**/page.tsx`);
}

assert.ok(!allHrefs.some((href) => href.startsWith('/#')), 'footer should not link to legacy home anchors');

const industryEntries = FOOTER_INDUSTRY_GROUPS.flatMap((group) => group.links)
  .filter((link) => link.href.startsWith('/industries/') && link.href !== '/industries');
const slugsFromFooter = industryEntries.map((item) => item.href.replace('/industries/', ''));
const expectedIndustryCount = industrySlugs().length;
assert.equal(expectedIndustryCount, 19, 'industry source list should contain 19 slugs');
assert.equal(slugsFromFooter.length, expectedIndustryCount, 'industry footer links should include all slugs');
assert.equal(new Set(slugsFromFooter).size, expectedIndustryCount, 'industry slugs should appear exactly once');

for (const link of industryEntries) {
  const slug = link.href.replace('/industries/', '');
  const ind = getIndustry(slug);
  assert.ok(ind, `${link.href}: industry missing`);
  assert.equal(link.label, ind.name, `${link.href}: label must match INDUSTRIES[].name`);
}

const homeLanding = readFileSync(resolve(root, 'components/marketing/HomeLanding.tsx'), 'utf8');
assert.match(homeLanding, /<SiteFooter/, 'home landing should render the footer in server HTML');
assert.doesNotMatch(homeLanding, /HomeBelowFoldLazy/, 'home landing should not use lazy below-fold island');

const pricingPage = readFileSync(resolve(root, 'app/pricing/page.tsx'), 'utf8');
assert.ok(!pricingPage.includes("'use client'"), '/pricing page must remain a server component');
assert.match(
  pricingPage,
  /<PricingContent/,
  '/pricing stays a server page and renders PricingContent, which owns SiteFooter'
);

const homePage = readFileSync(resolve(root, 'app/page.tsx'), 'utf8');
assert.doesNotMatch(homePage, /SiteFooter/, 'app/page.tsx stays a thin shell; HomeLanding renders the footer');

console.log('site-footer-links.test.ts ok');
