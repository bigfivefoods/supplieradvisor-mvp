/**
 * Member app and marketing entry graphs must not pull server loaders
 * or the gym movement catalogue into the browser.
 * Run: npx --yes tsx lib/http/member-app-bundle.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve('.');
const FORBIDDEN = [
  '@/lib/supabase/server-client',
  '@/lib/fitness/movement-catalog',
  '@/lib/fitness/fitgraph',
  '@/lib/fitness/gym-grow-share',
  '@/lib/hire/hiregraph',
  '@/lib/b2c/hire-journeys',
  'undici',
];

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

function resolveImport(fromFile: string, spec: string): string | null {
  if (spec.startsWith('@/')) return withExt(join(ROOT, spec.slice(2)));
  if (spec.startsWith('.')) return withExt(resolve(dirname(fromFile), spec));
  return null;
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
    if (existsSync(t) && statSync(t).isFile()) return t;
  }
  return null;
}

function walk(file: string, seen: Set<string>) {
  const abs = resolve(file);
  if (seen.has(abs)) return;
  seen.add(abs);
  const text = src(abs).replace(
    /dynamic\(\s*\(\)\s*=>\s*import\((?:'[^']+'|"[^"]+")\)[\s\S]*?\)/g,
    ''
  );
  const re = /from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const spec = m[1];
    for (const bad of FORBIDDEN) {
      if (spec === bad || spec.startsWith(`${bad}/`)) {
        assert.fail(`${abs} imports forbidden ${spec}`);
      }
    }
    const next = resolveImport(abs, spec);
    if (next) walk(next, seen);
  }
}

for (const entry of ['app/me/page.tsx', 'app/me/layout.tsx', 'components/marketing/HomeLanding.tsx']) {
  const seen = new Set<string>();
  walk(entry, seen);
  assert.ok(seen.size > 3, `expected to walk ${entry}`);
}

assert.doesNotMatch(src('lib/billing/lifetime.ts'), /server-client/);
assert.doesNotMatch(src('lib/billing/lifetime.ts'), /getSupabaseServer/);
assert.match(src('lib/billing/lifetime-server.ts'), /getSupabaseServer/);
assert.match(src('lib/advisors/member-pwa.ts'), /gym-join-path/);
assert.doesNotMatch(src('components/b2c/B2cHireJourney.tsx'), /hire-journeys/);
assert.match(src('components/marketing/HomeBelowFoldLazy.tsx'), /ssr:\s*false/);
assert.match(src('components/marketing/HeroAudienceStage.tsx'), /mountedScenes/);

console.log('member-app-bundle.test.ts ok');
