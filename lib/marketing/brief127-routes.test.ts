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
  { id: 'video', heading: 'Product story' },
  { id: 'markets', heading: 'Who the network serves' },
  { id: 'member-app', heading: 'Your personal wallet' },
  { id: 'why-join', heading: 'Compelling reasons to run' },
  { id: 'systems', heading: 'Every critical system.' },
  { id: 'modules', heading: 'Core OS · Sector · Industry' },
  { id: 'packaging', heading: 'Setup SupplierAdvisor®' },
  { id: 'trust', heading: 'When a lot fails,' },
  { heading: 'Four steps to live ops' },
  { id: 'audiences', heading: 'Why are you joining us?' },
] as const;
for (const section of relocated) {
  if (section.id) {
    assert.ok(
      allSource.includes(`id="${section.id}"`) || allSource.includes(`id={'${section.id}'}`),
      `missing relocated id ${section.id}`
    );
  }
  assert.ok(
    allSource.includes(section.heading),
    `missing relocated heading text for ${section.id ?? section.heading}`
  );
}

const movedContentFiles = [
  resolve(process.cwd(), 'components/marketing/HomeBelowFold.tsx'),
  ...readdirSync(resolve(process.cwd(), 'components/marketing/sections'))
    .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
    .map((name) => resolve(process.cwd(), 'components/marketing/sections', name)),
];
for (const file of movedContentFiles) {
  const src = readFileSync(file, 'utf8');
  const badCommaSpacing = ` ${','}`;
  assert.ok(!src.includes(badCommaSpacing), `found stray comma spacing in ${file}`);
  assert.ok(!src.includes('—'), `found em dash in ${file}`);
  assert.ok(!src.includes('–'), `found en dash in ${file}`);
}

console.log('brief127-routes.test.ts ok');
