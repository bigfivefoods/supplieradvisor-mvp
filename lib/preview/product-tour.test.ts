/**
 * Guided product tour — sample screens only, no database writes.
 * Run: npx --yes tsx lib/preview/product-tour.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { en } from '@/lib/i18n/dict/en';
import fr from '@/lib/i18n/dict/fr';
import ar from '@/lib/i18n/dict/ar';
import pt from '@/lib/i18n/dict/pt';
import sw from '@/lib/i18n/dict/sw';
import zu from '@/lib/i18n/dict/zu';
import {
  PRODUCT_TOUR_STEPS,
  TOUR_DEMO_HREF,
  TOUR_TRIAL_HREF,
  productTourHref,
  resolveTourStep,
} from './product-tour';

const paths = PRODUCT_TOUR_STEPS.filter((step) => !step.final).map((step) => step.path);
assert.deepEqual(paths, [
  '/preview/dashboard',
  '/preview/crm',
  '/preview/srm',
  '/preview/po',
  '/preview/inventory',
  '/preview/ratings',
  '/preview/sheq',
]);

assert.equal(productTourHref('dashboard'), '/preview/dashboard?tour=1&step=dashboard');
assert.equal(productTourHref('dashboard', 'en'), '/preview/dashboard?tour=1&step=dashboard');
assert.equal(
  productTourHref('crm', 'fr'),
  '/preview/crm?tour=1&step=crm&lang=fr'
);
assert.equal(productTourHref('close', 'ar'), '/preview/sheq?tour=1&step=close&lang=ar');
assert.equal(TOUR_TRIAL_HREF, '/onboarding?lane=b2b');
assert.equal(TOUR_DEMO_HREF, '/#book-demo');

assert.equal(resolveTourStep('/preview/dashboard', null).id, 'dashboard');
assert.equal(resolveTourStep('/preview/crm', 'dashboard').id, 'crm');
assert.equal(resolveTourStep('/preview/sheq', 'sheq').id, 'sheq');
assert.equal(resolveTourStep('/preview/sheq', 'close').id, 'close');
assert.equal(resolveTourStep('/preview/po/', 'inventory').id, 'po');
assert.equal(resolveTourStep('/preview', 'close').id, 'dashboard');

const copyKeys = [
  'tour.dashboard.body',
  'tour.crm.body',
  'tour.srm.body',
  'tour.po.body',
  'tour.inventory.body',
  'tour.ratings.body',
  'tour.sheq.body',
  'tour.close.body',
] as const;

for (const dict of [en, fr, ar, pt, sw, zu]) {
  assert.match(dict['home.tourCta'] || '', /\S/);
  assert.match(dict['brand.supplierAdvisor'] || '', /SupplierAdvisor®/);
  for (const key of copyKeys) {
    const text = dict[key] || '';
    assert.match(text, /SupplierAdvisor®/, `${key} should name SupplierAdvisor®`);
    assert.doesNotMatch(text, /Kwaden/i);
    assert.doesNotMatch(text, /\d+\s*%/);
    assert.doesNotMatch(text, /\/mo(?!is)/i);
  }
}

const files = [
  'lib/preview/product-tour.ts',
  'components/preview/ProductTour.tsx',
  'components/preview/ProductTourGate.tsx',
  'components/preview/FixtureStudio.tsx',
  'app/preview/layout.tsx',
  'components/marketing/HomeLanding.tsx',
  'components/marketing/ProductVideo.tsx',
  'components/marketing/ReplaceStackDiagram.tsx',
  'components/marketing/InteractiveDemoMain.tsx',
];

for (const rel of files) {
  const text = readFileSync(resolve(rel), 'utf8');
  assert.doesNotMatch(text, /Kwaden/i, rel);
  assert.doesNotMatch(text, /supabase/i, rel);
}

for (const rel of [
  'lib/preview/product-tour.ts',
  'components/preview/ProductTour.tsx',
  'components/preview/ProductTourGate.tsx',
  'app/preview/layout.tsx',
]) {
  assert.doesNotMatch(readFileSync(resolve(rel), 'utf8'), /#0099b8/, rel);
}

const tour = readFileSync(resolve('components/preview/ProductTour.tsx'), 'utf8');
assert.match(tour, /#00b4d8/);
assert.match(tour, /data-tour-cta="trial"/);
assert.match(tour, /data-tour-cta="demo"/);
assert.match(tour, /TOUR_TRIAL_HREF/);
assert.match(tour, /TOUR_DEMO_HREF/);
assert.match(tour, /tour\.sample/);
assert.doesNotMatch(tour, /\.insert\(|\.update\(|\.upsert\(/);

const gate = readFileSync(resolve('components/preview/ProductTourGate.tsx'), 'utf8');
assert.match(gate, /next\/dynamic/);
assert.match(gate, /ssr:\s*false/);
assert.match(gate, /tour'\) !== '1'|get\('tour'\) !== '1'/);

const layout = readFileSync(resolve('app/preview/layout.tsx'), 'utf8');
assert.match(layout, /ProductTourGate/);
assert.match(layout, /Suspense/);
assert.doesNotMatch(layout, /ProductTour'/);

const landing = readFileSync(resolve('components/marketing/HomeLanding.tsx'), 'utf8');
assert.match(landing, /id="guided-tour"/);
assert.match(landing, /id="book-demo"/);
assert.match(landing, /productTourHref\('dashboard', locale\)/);
assert.match(landing, /home\.tourCta/);
assert.match(landing, /#00b4d8/);

const video = readFileSync(resolve('components/marketing/ProductVideo.tsx'), 'utf8');
assert.match(video, /productTourHref\('dashboard'\)/);
assert.doesNotMatch(video, /href="\/demo"/);

const stack = readFileSync(resolve('components/marketing/ReplaceStackDiagram.tsx'), 'utf8');
assert.match(stack, /productTourHref\('dashboard'\)/);

const studio = readFileSync(resolve('components/preview/FixtureStudio.tsx'), 'utf8');
assert.match(studio, /data-tour-stage/);

console.log('preview/product-tour.test.ts ok');
