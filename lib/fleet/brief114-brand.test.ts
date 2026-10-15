/**
 * FleetAdvisor® brand and copy guards.
 * Run: npx --yes tsx lib/fleet/brief114-brand.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { FLEET_CYAN, FLEET_DEEP, FLEET_NAVY } from './brand';

assert.equal(FLEET_CYAN, '#00b4d8');
assert.equal(FLEET_NAVY, '#0f172a');
assert.equal(FLEET_DEEP, '#0077b6');

const forbidden = ['kwa', 'den'].join('');
const otherBrand = ['dr', 'inc'].join('');

function walk(dir: string): string[] {
  if (!statSync(dir).isDirectory()) return [dir];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const roots = ['components/fleet', 'app/dashboard/fleetgraph', 'app/preview/fleetgraph', 'lib/fleet', 'docs', 'supabase/migrations/20261019_fleetgraph_a.sql'];
for (const root of roots) {
  for (const file of walk(root)) {
    if (!/\.(ts|tsx|md|sql|txt)$/.test(file)) continue;
    const src = readFileSync(file, 'utf8').toLowerCase();
    assert.equal(src.includes(forbidden), false, file);
    assert.equal(src.includes(otherBrand), false, file);
  }
}

const ui = readFileSync('components/fleet/FleetUi.tsx', 'utf8');
assert.equal(/stone-|amber-/.test(ui), false);
assert.match(ui, /bg-\[#00b4d8\][\s\S]{0,80}text-\[#0f172a\]/);
assert.equal(/window\.(alert|confirm|prompt)/.test(ui), false);
assert.match(ui, /Illustration · sample data/);

for (const file of walk('components/fleet').concat(walk('app/dashboard/fleetgraph'))) {
  if (!file.endsWith('.tsx')) continue;
  const src = readFileSync(file, 'utf8');
  assert.equal(/window\.(alert|confirm|prompt)/.test(src), false, file);
  if (file.includes(`${resolve('app/dashboard/fleetgraph')}`)) {
    assert.equal(src.includes('<aside'), false, file);
  }
  if (file.endsWith('FleetViews.tsx')) {
    assert.equal(src.includes('<aside'), false);
    assert.equal(/mapbox|openstreetmap|maps\.google|tile\.open/i.test(src), false);
  }
}

const mapPage = readFileSync('app/dashboard/fleetgraph/map/page.tsx', 'utf8');
assert.equal(/https?:\/\/|fetch\(|mapbox|openstreetmap|google/i.test(mapPage), false);
const art = readFileSync('components/fleet/Illustrations.tsx', 'utf8');
assert.equal(/https?:\/\/|fetch\(|mapbox|openstreetmap/i.test(art), false);

console.log('brief114-brand.test.ts ok');
