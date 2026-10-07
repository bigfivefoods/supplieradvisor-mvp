/**
 * Run: npx --yes tsx lib/marketing/site-footer-links.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FOOTER_EXPLORE_GROUPS,
  FOOTER_INDUSTRY_GROUPS,
  FOOTER_LEGAL_LINKS,
  FOOTER_RESOURCE_GROUPS,
} from '@/lib/marketing/site-footer';
import { PRICING_SECTION_IDS } from '@/lib/marketing/pricing-plans';
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
    assert.ok(industrySlugs().includes(slug as (typeof industrySlugs)[number]), `${href}: unknown industry slug`);
    assert.ok(existsSync(resolve(root, 'app/industries/[slug]/page.tsx')), 'industries dynamic page missing');
    continue;
  }

  assert.ok(existsSync(routePagePath(route)), `${href}: expected matching app/**/page.tsx`);
}

const marketingDir = resolve(root, 'components/marketing');
const marketingTsxFiles = readdirSync(marketingDir)
  .filter((entry) => entry.endsWith('.tsx'))
  .map((entry) => resolve(marketingDir, entry));
const sectionIds = new Set<string>();
for (const file of marketingTsxFiles) {
  const src = readFileSync(file, 'utf8');
  for (const match of src.matchAll(/id="([^"]+)"/g)) {
    sectionIds.add(match[1]!);
  }
}

const pricingIds = new Set(Object.values(PRICING_SECTION_IDS));
for (const href of internalHrefs.filter((item) => item.startsWith('/#'))) {
  const id = href.split('#')[1] || '';
  assert.ok(sectionIds.has(id) || pricingIds.has(id), `${href}: missing matching id in components/marketing/*.tsx`);
}

const industryEntries = FOOTER_INDUSTRY_GROUPS.flatMap((group) => group.links)
  .filter((link) => link.href.startsWith('/industries/') && link.href !== '/industries');
const slugsFromFooter = industryEntries.map((item) => item.href.replace('/industries/', ''));
assert.equal(slugsFromFooter.length, 18, 'industry footer links should include 18 slugs');
assert.equal(new Set(slugsFromFooter).size, 18, 'industry slugs should appear exactly once');

for (const link of industryEntries) {
  const slug = link.href.replace('/industries/', '');
  const ind = getIndustry(slug);
  assert.ok(ind, `${link.href}: industry missing`);
  assert.equal(link.label, ind.name, `${link.href}: label must match INDUSTRIES[].name`);
}

for (const slug of industrySlugs()) {
  assert.equal(
    slugsFromFooter.filter((item) => item === slug).length,
    1,
    `${slug}: must appear exactly once in footer`
  );
}

for (const forbidden of ['/paia', '/accessibility', '/about', '/contact']) {
  assert.ok(!allHrefs.includes(forbidden), `forbidden route present in footer data: ${forbidden}`);
}

const columnHrefs = contentGroups.flatMap((group) => group.links.map((link) => link.href));
assert.equal(new Set(columnHrefs).size, columnHrefs.length, 'no duplicate hrefs allowed across columns');

const footerUsageFiles = [
  'components/marketing/HomeBelowFold.tsx',
  'app/pricing/page.tsx',
  'app/industries/page.tsx',
  'app/industries/[slug]/page.tsx',
  'app/demo/page.tsx',
  'app/privacy/page.tsx',
  'app/terms/page.tsx',
  'app/cancellation-refund/page.tsx',
  'app/verification-sla/page.tsx',
] as const;

for (const rel of footerUsageFiles) {
  const src = readFileSync(resolve(root, rel), 'utf8');
  const imports = src.match(/from ['"]@\/components\/marketing\/SiteFooter['"]/g) ?? [];
  assert.equal(imports.length, 1, `${rel}: should import SiteFooter exactly once`);
}

const homeBelowFold = readFileSync(resolve(root, 'components/marketing/HomeBelowFold.tsx'), 'utf8');
assert.doesNotMatch(homeBelowFold, /<footer\b/, 'HomeBelowFold should not contain inline footer markup');

const pricingPage = readFileSync(resolve(root, 'app/pricing/page.tsx'), 'utf8');
assert.ok(!pricingPage.includes("'use client'"), '/pricing page must remain a server component');

const homePage = readFileSync(resolve(root, 'app/page.tsx'), 'utf8');
assert.doesNotMatch(homePage, /SiteFooter/, 'app/page.tsx should keep footer lazy-loaded below fold');

console.log('site-footer-links.test.ts ok');
