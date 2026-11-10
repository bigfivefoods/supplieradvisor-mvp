import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEGACY_HOME_ANCHOR_TARGETS } from '@/lib/marketing/legacy-home-anchors';

const requiredIds = [
  'video', 'stack', 'systems', 'whats-new', 'industry-packs', 'tradeadvisor',
  'why-join', 'compare', 'proof', 'super-cube', 'modules', 'modules-industry',
  'packaging', 'trust', 'security', 'member-app', 'pricing', 'roi', 'industries',
  'catalogues', 'markets', 'audiences',
];
for (const id of requiredIds) {
  assert.ok(LEGACY_HOME_ANCHOR_TARGETS[id], `legacy map missing ${id}`);
}

const targets = new Set(Object.values(LEGACY_HOME_ANCHOR_TARGETS));
for (const route of targets) {
  if (route === '/') continue;
  const path = resolve(process.cwd(), `app/${route.replace(/^\//, '')}/page.tsx`);
  assert.ok(existsSync(path), `${route} should exist as app/**/page.tsx`);
}

const expectedSeoRoutes = [
  '/product',
  '/modules',
  '/how-it-fits',
  '/why-supplieradvisor',
  '/trust',
  '/sa-member',
  '/business',
  '/government',
  '/roi',
];
const seoSrc = readFileSync(resolve(process.cwd(), 'lib/seo/site.ts'), 'utf8');
for (const route of expectedSeoRoutes) {
  assert.ok(seoSrc.includes(`path: '${route}'`), `${route} missing from STATIC_SEO_ROUTES`);
}

assert.match(seoSrc, /fixtureRoutesOpen\(\)/, 'seo routes should gate /demo by fixtureRoutesOpen');

const robotsSrc = readFileSync(resolve(process.cwd(), 'app/robots.ts'), 'utf8');
for (const route of expectedSeoRoutes) {
  assert.match(robotsSrc, new RegExp(`'${route.replace('/', '\\/')}'`), `${route} missing from robots allow list`);
}

const newPages = [
  'app/product/page.tsx',
  'app/modules/page.tsx',
  'app/how-it-fits/page.tsx',
  'app/why-supplieradvisor/page.tsx',
  'app/trust/page.tsx',
  'app/sa-member/page.tsx',
  'app/business/page.tsx',
  'app/government/page.tsx',
  'app/roi/page.tsx',
];
for (const rel of newPages) {
  const src = readFileSync(resolve(process.cwd(), rel), 'utf8');
  assert.doesNotMatch(src, /Providers|@privy-io\/react-auth|\bviem\b|\bwagmi\b|\bundici\b/);
}

console.log('brief127-routes.test.ts ok');
