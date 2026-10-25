/**
 * Run: npx --yes tsx lib/seo/public-page-cache.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { companyJsonLdGraph } from './company-public';
import { companyOpenRewritePath } from './company-open-rewrite';
import {
  publicCompanyTag,
  publicInvalidationPaths,
  publicInvalidationTags,
  PUBLIC_SITEMAP_TAG,
} from './public-page-cache';
import { aggregateFromReviews, sanitizeRealReviews, schemaReviews } from './public-reviews';

const company = {
  id: 102,
  trading_name: 'Big Five Foods',
  legal_name: 'Big Five Foods (Pty) Ltd',
  industry: 'Food',
  city: 'Johannesburg',
  country: 'South Africa',
  updated_at: '2026-10-20T12:00:00.000Z',
};

const empty = companyJsonLdGraph(company, { reviews: [] });
const emptyOrg = (empty['@graph'] as Array<Record<string, unknown>>)[0];
assert.equal(emptyOrg.aggregateRating, undefined);
assert.equal(emptyOrg.review, undefined);
assert.equal(JSON.stringify(empty).includes('aggregateRating'), false);
assert.equal(JSON.stringify(empty).includes('"ratingValue":5'), false);

const starsOnly = sanitizeRealReviews([
  { rating: 4, body: '', authorName: '' },
  { rating: 5, body: null, authorName: 'hidden@example.com' },
  { rating: 9, body: 'nope', authorName: 'Nope' },
  { rating: 0, body: 'zero', authorName: 'Zero' },
]);
assert.equal(starsOnly.length, 2);
assert.equal(starsOnly[1].authorName, null);
const starsGraph = companyJsonLdGraph(company, { reviews: starsOnly });
const starsOrg = (starsGraph['@graph'] as Array<Record<string, unknown>>)[0];
assert.deepEqual(starsOrg.aggregateRating, {
  '@type': 'AggregateRating',
  ratingValue: 4.5,
  bestRating: 5,
  worstRating: 1,
  ratingCount: 2,
});
assert.equal(starsOrg.review, undefined);

const written = sanitizeRealReviews([
  {
    rating: 5,
    body: 'On time and correct.',
    authorName: 'Amina D.',
    publishedAt: '2026-10-01T08:00:00.000Z',
  },
]);
assert.equal(aggregateFromReviews(written).count, 1);
assert.equal(schemaReviews(written).length, 1);
const writtenGraph = companyJsonLdGraph(company, { reviews: written });
const writtenOrg = (writtenGraph['@graph'] as Array<Record<string, unknown>>)[0];
const reviews = writtenOrg.review as Array<Record<string, unknown>>;
assert.equal(reviews.length, 1);
assert.equal((reviews[0].author as { name: string }).name, 'Amina D.');
assert.equal(reviews[0].reviewBody, 'On time and correct.');
assert.equal(
  (writtenGraph['@graph'] as Array<Record<string, unknown>>)[2].dateModified,
  '2026-10-20'
);

assert.equal(
  companyOpenRewritePath('/c/big-five-foods-102', 'quote', null),
  '/c/big-five-foods-102/open'
);
assert.equal(companyOpenRewritePath('/c/big-five-foods-102', null, 'rate'), '/c/big-five-foods-102/open');
assert.equal(companyOpenRewritePath('/c/big-five-foods-102', null, null), null);
assert.equal(companyOpenRewritePath('/c/big-five-foods-102/open', 'quote', null), null);
assert.equal(companyOpenRewritePath('/pricing', 'quote', null), null);

const tags = publicInvalidationTags({
  companyId: 102,
  tradingName: 'Big Five Foods',
  legalName: 'Big Five Foods (Pty) Ltd',
  metadata: { store_slug: 'big-five-foods' },
  previousTradingName: 'Old Name',
});
assert.ok(tags.includes(publicCompanyTag(102)));
assert.ok(tags.includes(PUBLIC_SITEMAP_TAG));
assert.ok(tags.includes('public-store-big-five-foods'));

const paths = publicInvalidationPaths({
  companyId: 102,
  tradingName: 'Big Five Foods',
  metadata: { store_slug: 'big-five-foods' },
});
assert.ok(paths.includes('/c/big-five-foods-102'));
assert.ok(paths.includes('/store/big-five-foods'));
assert.ok(paths.includes('/sitemap.xml'));

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const segmentFiles = [
  'app/c/[id]/page.tsx',
  'app/embed/store/[companySlug]/page.tsx',
  'app/sitemap.ts',
  'app/sitemap-index.xml/route.ts',
  'app/store/[companySlug]/page.tsx',
  'app/store/[companySlug]/products/[productKey]/page.tsx',
];
for (const file of segmentFiles) {
  const source = readFileSync(join(root, file), 'utf8');
  assert.match(source, /export const revalidate = 3600;/);
  assert.equal(source.includes('revalidate = PUBLIC_PAGE_REVALIDATE_SECONDS'), false);
  if (file !== 'app/sitemap.ts' && file !== 'app/sitemap-index.xml/route.ts') {
    assert.match(source, /export function generateStaticParams\(\)/);
  }
}

console.log('public-page-cache.test.ts ok');
