import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

const scanRoots = [
  resolve(process.cwd(), 'app'),
  resolve(process.cwd(), 'components/marketing/sections'),
  resolve(process.cwd(), 'components/marketing'),
];
const corpus: string[] = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
      corpus.push(readFileSync(full, 'utf8'));
    }
  }
};
for (const root of scanRoots) walk(root);
const allSource = corpus.join('\n');
const relocated = [
  ['video', 'Product story'],
  ['markets', 'Who the network serves'],
  ['member-app', 'Your personal wallet'],
  ['why-join', 'Compelling reasons to run'],
  ['systems', 'Every critical system.'],
  ['modules', 'Core OS · Sector · Industry'],
  ['packaging', 'Setup SupplierAdvisor®'],
  ['trust', 'When a lot fails,'],
  ['how-it-works', 'Four steps to live ops'],
  ['audiences', 'Why are you joining us?'],
] as const;
for (const [id, heading] of relocated) {
  assert.ok(allSource.includes(`id="${id}"`) || allSource.includes(`id={'${id}'}`), `missing relocated id ${id}`);
  assert.ok(allSource.includes(heading), `missing relocated heading text for ${id}`);
}

console.log('brief127-routes.test.ts ok');
