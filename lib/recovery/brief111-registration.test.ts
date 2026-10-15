/**
 * Run: npx --yes tsx lib/recovery/brief111-registration.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { ADVISOR_SKINS } from '@/lib/brand/advisor-skins';
import { MODULE_NAV } from '@/lib/chrome/module-nav';
import { INDUSTRY_ADVISOR_MODULE_IDS } from '@/lib/business/company-modules';
import { ADVISOR_MODULE_CORE_HREF, ADVISOR_PACK_UNLOCKS } from '@/lib/product/advisor-core-unlocks';
import { INDUSTRY_PACKS } from '@/lib/product/architecture';
import { RECOVER_BRAND, RECOVER_PRODUCT_NAME } from './brand';

assert.equal(RECOVER_BRAND.accent, '#00b4d8');
assert.equal(RECOVER_BRAND.ink, '#0f172a');
assert.equal(RECOVER_PRODUCT_NAME, 'RecoverAdvisor®');

const mod = MODULE_NAV.find((item) => item.id === 'recovergraph');
assert.ok(mod);
assert.equal(mod.href, '/dashboard/recovergraph');
assert.equal(mod.resource, 'recovery');
assert.ok(mod.steps.some((step) => step.href === '/dashboard/recovergraph/queue'));

const pack = INDUSTRY_PACKS.find((item) => item.id === 'recovery');
assert.ok(pack);
assert.ok(pack.modules.some((item) => item.unlocks.includes('recovergraph')));

const skin = ADVISOR_SKINS.find((item) => item.id === 'recover');
assert.ok(skin);
assert.deepEqual(skin.moduleIds, ['recovergraph']);
assert.deepEqual(skin.packIds, ['recovery']);
assert.equal(skin.brand, '#00b4d8');
assert.equal(skin.ink, '#0f172a');

assert.ok(INDUSTRY_ADVISOR_MODULE_IDS.includes('recovergraph'));
assert.ok(ADVISOR_PACK_UNLOCKS.recovery.includes('recovergraph'));
assert.equal(ADVISOR_MODULE_CORE_HREF.recovergraph.book, '/dashboard/recovergraph/creditors');

const banned = [ ['dr', 'inc'].join(''), ['Har', 'bour'].join('') ].map((word) => word.toLowerCase());

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

const roots = [
  'lib/recovery',
  'components/recovery',
  'app/dashboard/recovergraph',
  'app/api/recovery',
  'app/(recover-portal)',
  'docs',
].flatMap((dir) => walk(resolve(dir)));

const files = roots.filter((path) => {
  const rel = relative(resolve('.'), path).replaceAll('\\', '/');
  if (rel.startsWith('docs/') && !rel.startsWith('docs/recoveradvisor')) return false;
  if (
    rel.includes('recovergraph') ||
    rel.includes('(recover-portal)') ||
    rel.startsWith('lib/recovery') ||
    rel.startsWith('components/recovery') ||
    rel.startsWith('app/api/recovery') ||
    rel.startsWith('docs/recoveradvisor')
  ) {
    return true;
  }
  return rel.includes('/recovergraph/');
});

const migration = walk(resolve('supabase/migrations')).filter((path) => path.includes('recovergraph'));
const scanned = [...files, ...migration];
assert.ok(scanned.length > 10);

for (const path of scanned) {
  const rel = relative(resolve('.'), path).replaceAll('\\', '/');
  assert.doesNotMatch(rel, /®/, rel);
  const text = readFileSync(path, 'utf8');
  const lower = text.toLowerCase();
  for (const word of banned) {
    assert.equal(lower.includes(word), false, `${rel} contains a forbidden name`);
  }
  if (rel.startsWith('components/recovery') || rel.startsWith('docs/recoveradvisor')) {
    const bare = text.match(/RecoverAdvisor(?!®)/);
    assert.equal(bare, null, `${rel} has RecoverAdvisor without the registered mark`);
    assert.doesNotMatch(text, /#fff\b|#ffffff|text-white/i);
    assert.doesNotMatch(text, /<aside/);
  }
  const testIds = text.match(/data-testid="[^"]+"/g) || [];
  for (const id of testIds) assert.doesNotMatch(id, /®/);
}

assert.equal(mod.id.includes('®'), false);
assert.equal(String(pack.id).includes('®'), false);

console.log('brief111-registration.test.ts ok');
