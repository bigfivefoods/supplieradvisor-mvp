/**
 * Brief 89 — homepage DOM/TBT diet guardrails.
 * Run: npx --yes tsx lib/marketing/brief89-home-diet.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve('.');

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

function withExt(base: string): string | null {
  const tries = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];
  for (const t of tries) {
    if (existsSync(t)) return t;
  }
  return null;
}

function resolveImport(fromFile: string, spec: string): string | null {
  if (spec.startsWith('@/')) {
    return withExt(join(ROOT, spec.slice(2)));
  }
  if (spec.startsWith('.')) {
    return withExt(resolve(dirname(fromFile), spec));
  }
  return null;
}

function walk(file: string, seen: Set<string>) {
  const abs = resolve(file);
  if (seen.has(abs)) return;
  seen.add(abs);
  const text = src(abs);
  const stripped = text.replace(
    /dynamic\(\s*\(\)\s*=>\s*import\((?:'[^']+'|"[^"]+")\)[\s\S]*?\)/g,
    ''
  );
  const re = /from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) {
    const next = resolveImport(abs, m[1]);
    if (next) walk(next, seen);
  }
}

const page = src('app/page.tsx');
assert.match(page, /<main[\s>]/, 'home page should render a <main> element');
assert.doesNotMatch(page, /next\/dynamic/);
assert.doesNotMatch(page, /ProductMocks/);
assert.match(page, /HeroAudienceStage/);
assert.doesNotMatch(page, /@privy-io\/react-auth/);
assert.doesNotMatch(page, /\bviem\b/);
assert.doesNotMatch(page, /\bundici\b/);

const description = page.match(/description:\s*'([^']+)'/);
assert.ok(description?.[1], 'home metadata description should be present');
assert.ok(description![1].length <= 160, 'home metadata description should stay concise');

const approxWords = page.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g)?.length ?? 0;
assert.ok(approxWords >= 600, `expected 600+ words in app/page.tsx, found ${approxWords}`);

const lazy = src('components/marketing/HomeBelowFoldLazy.tsx');
assert.match(lazy, /ssr:\s*false/);
assert.match(lazy, /HomeBelowFold/);

const homeBelowFold = src('components/marketing/HomeBelowFold.tsx');
assert.doesNotMatch(
  homeBelowFold,
  /from\s+['"]@\/components\/marketing\/ProductMocks['"]/,
  'home below-fold should not import ProductMocks'
);

const forbiddenIndustryMocks = [
  'FieldgraphMock',
  'ApparelgraphMock',
  'ConstructiongraphMock',
  'QuarrygraphMock',
  'FitgraphMock',
  'PhysiographMock',
  'DentalgraphMock',
  'PsychiatrygraphMock',
  'MedicalgraphMock',
  'VetgraphMock',
  'HiregraphMock',
  'RetailgraphMock',
  'SchoolsMock',
];
for (const name of forbiddenIndustryMocks) {
  assert.doesNotMatch(homeBelowFold, new RegExp(`\\b${name}\\b`), `${name} must not be on home`);
}

const seen = new Set<string>();
walk('app/page.tsx', seen);
assert.ok(seen.size > 3, 'expected to walk home import graph');
for (const file of seen) {
  const text = src(file);
  for (const name of forbiddenIndustryMocks) {
    assert.doesNotMatch(text, new RegExp(`\\b${name}\\b`), `${name} leaked into home graph via ${file}`);
  }
}

console.log('brief89-home-diet.test.ts ok');
