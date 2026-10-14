/**
 * Public SEO: share cards, JSON-LD offers, hreflang, and industry copy guardrails.
 * Run: npx tsx lib/seo/marketing-seo.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
} from '@/lib/billing/company-subscription';
import { INDUSTRIES } from '@/lib/marketing/industries';
import { hreflangAlternates, isTranslatedPath, LOCALES } from '@/lib/i18n/config';
import robots from '@/app/robots';
import { companyPlanOffers, siteJsonLd } from '@/lib/seo/jsonld';
import { DEFAULT_DESCRIPTION } from '@/lib/seo/site';
import {
  BRAND_CYAN,
  KEY_SHARE_CARDS,
  allShareCards,
  industryShareCard,
} from '@/lib/seo/share-cards';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

assert.equal(BRAND_CYAN, '#00b4d8');
assert.ok(DEFAULT_DESCRIPTION.length <= 160, DEFAULT_DESCRIPTION);

const home = read('app/page.tsx');
const homeDescription = home.match(/description:\s*'([^']+)'/)?.[1] || '';
assert.ok(homeDescription.includes('SupplierAdvisor®'));
assert.ok(homeDescription.includes('R299/month'));
assert.ok(homeDescription.length <= 160, String(homeDescription.length));

for (const card of KEY_SHARE_CARDS) {
  const copy = [...card.headline, ...card.sub, card.eyebrow, card.alt].join(' ');
  assert.match(copy, /SupplierAdvisor®/);
  assert.doesNotMatch(card.foot, /®/);
  assert.doesNotMatch(card.foot, /Kwaden/i);
  assert.doesNotMatch(copy, /Kwaden/i);
}

const pricingCard = KEY_SHARE_CARDS.find((card) => card.id === 'pricing');
assert.match(
  [...(pricingCard?.headline || []), ...(pricingCard?.sub || [])].join(' '),
  new RegExp(`${COMPANY_TRIAL_DAYS}-day`)
);
assert.match(
  KEY_SHARE_CARDS.find((card) => card.id === 'pricing')?.headline.join(' ') || '',
  new RegExp(`R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}`)
);

const offers = companyPlanOffers('https://www.supplieradvisor.com/pricing');
const monthly = offers[0];
assert.equal(monthly?.price, COMPANY_SUBSCRIPTION_MONTHLY_ZAR);
assert.match(monthly?.name || '', /30-day trial, then from R299\/month/);
assert.equal(monthly?.priceCurrency, 'ZAR');

const graph = JSON.stringify(siteJsonLd());
assert.match(graph, /"@type":"Organization"/);
assert.match(graph, /"@type":"SoftwareApplication"/);
assert.match(graph, /SupplierAdvisor®/);
assert.doesNotMatch(graph, /lowPrice":0/);
assert.doesNotMatch(graph, /Kwaden/i);
for (const locale of LOCALES) {
  assert.match(graph, new RegExp(`"${locale}"`));
}

assert.equal(isTranslatedPath('/demo'), false);
assert.equal(isTranslatedPath('/industries'), false);
assert.equal(isTranslatedPath('/'), true);
assert.equal(isTranslatedPath('/pricing'), true);
const alternates = hreflangAlternates('/pricing');
assert.equal(Object.keys(alternates).length, LOCALES.length + 1);

const robotRules = JSON.stringify(robots());
for (const locale of LOCALES) {
  if (locale === 'en') continue;
  assert.match(robotRules, new RegExp(`"/${locale}"`));
}
const sitemap = read('app/sitemap.ts');
assert.match(sitemap, /hreflangAlternates/);

const industryPage = read('app/industries/[slug]/page.tsx');
assert.match(industryPage, /title:\s*ind\.name/);
assert.doesNotMatch(industryPage, /trusted by \d/i);
assert.doesNotMatch(industryPage, /customers worldwide/i);
assert.doesNotMatch(industryPage, /Kwaden/i);

for (const industry of INDUSTRIES) {
  const card = industryShareCard(industry);
  assert.match([...card.sub, card.alt].join(' '), /SupplierAdvisor®|Advisor®/);
  assert.doesNotMatch(card.foot, /®/);
  assert.ok(industry.metaDescription.length <= 160);
}

const renderer = read('scripts/seo/render-share-cards.ts');
assert.match(renderer, /BRAND_CYAN/);
assert.doesNotMatch(renderer, /#0ea5e9|#22d3ee|#0099b8/);

async function assertSharePngs() {
  for (const card of allShareCards()) {
    const png = readFileSync(resolve(process.cwd(), 'public', card.file));
    const meta = await sharp(png).metadata();
    assert.equal(meta.width, 1200, card.id);
    assert.equal(meta.height, 630, card.id);
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const channels = info.channels;
    const offset = (4 * info.width + 8) * channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    assert.equal(r, 0x00, `${card.id} cyan r ${r}`);
    assert.equal(g, 0xb4, `${card.id} cyan g ${g}`);
    assert.equal(b, 0xd8, `${card.id} cyan b ${b}`);
  }
}

assertSharePngs()
  .then(() => {
    console.log('marketing-seo.test.ts ok');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
