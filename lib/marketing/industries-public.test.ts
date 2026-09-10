/**
 * Public website industry catalogue includes ConstructionAdvisor® and ApparelAdvisor®.
 * Run: npx --yes tsx lib/marketing/industries-public.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INDUSTRIES, getIndustry, industrySlugs } from './industries';

assert.ok(
  industrySlugs().includes('construction-building'),
  'industry catalogue should include construction-building'
);
assert.ok(
  industrySlugs().includes('apparel-clothing'),
  'industry catalogue should include apparel-clothing'
);

const construction = getIndustry('construction-building');
assert.equal(construction?.pack, 'ConstructionAdvisor®');
assert.match(construction?.name || '', /construction/i);

const apparel = getIndustry('apparel-clothing');
assert.equal(apparel?.pack, 'ApparelAdvisor®');

const indexSrc = readFileSync(resolve('app/industries/page.tsx'), 'utf8');
assert.match(indexSrc, /construction-building/);
assert.match(indexSrc, /apparel-clothing/);
assert.match(indexSrc, /ConstructionAdvisor/);
assert.match(indexSrc, /ApparelAdvisor/);

const stripSrc = readFileSync(
  resolve('components/marketing/IndustriesStrip.tsx'),
  'utf8'
);
assert.match(stripSrc, /construction-building/);
assert.match(stripSrc, /ConstructionAdvisor/);

const compareSrc = readFileSync(
  resolve('components/marketing/ComparePlatforms.tsx'),
  'utf8'
);
assert.match(compareSrc, /ConstructionAdvisor®/);
assert.match(compareSrc, /ApparelAdvisor®/);
assert.match(compareSrc, /progress payments/);

const homeSrc = readFileSync(
  resolve('components/marketing/HomeBelowFold.tsx'),
  'utf8'
);
assert.match(homeSrc, /ConstructionAdvisor®/);
assert.match(homeSrc, /Progress payments/);
assert.match(homeSrc, /BOQ quotes/);
assert.match(homeSrc, /client\/contractor PWA/);

const mockSrc = readFileSync(
  resolve('components/marketing/ProductMocks.tsx'),
  'utf8'
);
assert.match(mockSrc, /BOQ · payments · programme/);

assert.match(construction?.cardBlurb || '', /progress payments/);
assert.match(construction?.subhead || '', /progress-payment dates/);

const listed = new Set(
  [
    ...['agriculture', 'quarry-aggregates', 'food-beverage'],
    ...[
      'manufacturing',
      'apparel-clothing',
      'construction-building',
      'distribution',
      'containers',
    ],
    ...[
      'fitness-gyms',
      'physio-allied-health',
      'dental',
      'mental-health',
      'medical-practices',
      'veterinary-practices',
    ],
    ...['hire-rental', 'retail-shop'],
    ...['public-sector', 'multi-entity'],
  ]
);
for (const slug of industrySlugs()) {
  if (slug === 'staffing-recruitment') continue;
  assert.ok(
    listed.has(slug),
    `/industries index groups should include ${slug}`
  );
}

assert.ok(INDUSTRIES.length >= 18);

console.log('industries-public.test.ts ok');
