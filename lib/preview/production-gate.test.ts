/**
 * Fixture routes must 404 when VERCEL_ENV=production.
 * Run: npx --yes tsx lib/preview/production-gate.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fixturePublicHref, fixtureRoutesOpen, interactiveDemoHref } from './production-gate';

assert.equal(fixtureRoutesOpen({ VERCEL_ENV: 'production' }), false);
assert.equal(fixtureRoutesOpen({ VERCEL_ENV: 'preview' }), true);
assert.equal(fixtureRoutesOpen({ VERCEL_ENV: 'development' }), true);
assert.equal(fixtureRoutesOpen({}), true);
assert.equal(interactiveDemoHref({ VERCEL_ENV: 'production' }), '/join');
assert.equal(interactiveDemoHref({ VERCEL_ENV: 'preview' }), '/demo');
assert.equal(interactiveDemoHref({ VERCEL_ENV: 'development' }), '/demo');
assert.equal(interactiveDemoHref({}), '/demo');
assert.equal(fixturePublicHref('/preview/dashboard?tour=1', { VERCEL_ENV: 'production' }), '/join');
assert.equal(fixturePublicHref('/preview/dashboard?tour=1', { VERCEL_ENV: 'preview' }), '/preview/dashboard?tour=1');
assert.equal(fixturePublicHref('/preview/dashboard?tour=1', { VERCEL_ENV: 'development' }), '/preview/dashboard?tour=1');
assert.equal(fixturePublicHref('/preview/dashboard?tour=1', {}), '/preview/dashboard?tour=1');

const root = resolve('.');
const gate = 'blockFixtureRoutes';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function ancestorCallsGate(file: string): boolean {
  let dir = resolve(file, '..');
  const stop = resolve(root, 'app');
  while (dir.startsWith(stop)) {
    const layout = join(dir, 'layout.tsx');
    try {
      if (readFileSync(layout, 'utf8').includes(gate)) return true;
    } catch {
      /* no layout here */
    }
    if (dir === stop) break;
    dir = resolve(dir, '..');
  }
  return false;
}

const trees = ['app/preview', 'app/demo'];
const routes: string[] = [];
for (const tree of trees) {
  for (const file of walk(resolve(root, tree))) {
    if (!/\/(page|route)\.tsx?$/.test(file)) continue;
    routes.push(relative(root, file));
    const src = readFileSync(file, 'utf8');
    const covered = src.includes(gate) || ancestorCallsGate(file);
    assert.equal(covered, true, `${relative(root, file)} is reachable without blockFixtureRoutes`);
  }
}

assert.ok(routes.some((file) => file === 'app/preview/vat201/page.tsx'));
assert.ok(routes.some((file) => file === 'app/preview/delivery-note/pdf/route.ts'));
assert.ok(routes.some((file) => file === 'app/demo/page.tsx'));
assert.ok(routes.length >= 30, `expected the preview tree, saw ${routes.length}`);

const hrefLiteralPattern = /href\s*[:=]\s*['"]\/(?:demo|preview\/)/;
const hrefGuardAllowPrefixes = [
  'app/preview/',
  'app/demo/',
  'e2e/',
] as const;
const hrefGuardScannedRoots = ['app', 'components', 'lib'] as const;
for (const tree of hrefGuardScannedRoots) {
  for (const file of walk(resolve(root, tree))) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const rel = relative(root, file).replaceAll('\\', '/');
    if (hrefGuardAllowPrefixes.some((prefix) => rel.startsWith(prefix))) continue;
    const src = readFileSync(file, 'utf8');
    assert.equal(
      hrefLiteralPattern.test(src),
      false,
      `${rel} contains a literal href to /demo or /preview/ outside allowed trees`
    );
  }
}

async function assertProductionNotFound() {
  const previous = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = 'production';
  const { blockFixtureRoutes } = await import('./production-gate');
  assert.throws(
    () => blockFixtureRoutes(),
    (error: unknown) => {
      const digest = String((error as { digest?: string }).digest || '');
      const message = error instanceof Error ? error.message : String(error);
      return digest.includes('404') || message.includes('404');
    }
  );
  if (previous === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = previous;
}

assertProductionNotFound()
  .then(() => {
    console.log(`production-gate.test.ts ok (${routes.length} routes)`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
