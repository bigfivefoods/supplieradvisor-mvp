/**
 * Run: npx --yes tsx lib/brief119-home-static.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

for (const rel of ['app/page.tsx', 'components/marketing/HomeLanding.tsx']) {
  const src = read(rel);
  assert.doesNotMatch(src, /cookies\(/, rel);
  assert.doesNotMatch(src, /headers\(/, rel);
  assert.doesNotMatch(src, /force-dynamic/, rel);
  assert.doesNotMatch(src, /searchParams/, rel);
  assert.doesNotMatch(src, /@\/lib\/catalogues/, rel);
  assert.doesNotMatch(src, /components\/catalogues/, rel);
  assert.doesNotMatch(src, /HomeCatalogues/, rel);
}

const below = read('components/marketing/HomeBelowFold.tsx');
const industriesAt = below.indexOf('<IndustriesStrip />');
const cataloguesAt = below.indexOf('<HomeCatalogues />');
const audiencesAt = below.indexOf('id="audiences"');
assert.ok(industriesAt >= 0, 'IndustriesStrip should stay');
assert.ok(cataloguesAt > industriesAt, 'HomeCatalogues renders after IndustriesStrip');
assert.ok(audiencesAt > cataloguesAt, 'HomeCatalogues renders before #audiences');

const lazyIds = read('lib/marketing/home-nav-sections.ts');
assert.doesNotMatch(lazyIds, /['"]catalogues['"]/);

const nav = read('components/marketing/LandingNav.tsx');
assert.doesNotMatch(nav, /catalogues/i);

const route = read('app/catalogues/[id]/download/route.ts');
assert.doesNotMatch(route, /searchParams/);
assert.doesNotMatch(route, /request\.url/);
assert.match(route, /catalogueFileUrl/);
assert.doesNotMatch(route, /CATALOGUE_FILE_BASE_URL/);

console.log('brief119-home-static.test.ts ok');
