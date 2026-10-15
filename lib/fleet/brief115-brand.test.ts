/**
 * FleetAdvisor® brand guards for the compliance brief.
 * Run: npx --yes tsx lib/fleet/brief115-brand.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const forbidden = ['kwa', 'den'].join('');
const otherBrand = ['dr', 'inc'].join('');
const banned = /\b(legal|compliant|certified)\b/i;

function walk(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return statSync(dir, { throwIfNoEntry: false }) ? [dir] : [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const roots = ['components/fleet', 'app/dashboard/fleetgraph', 'app/preview/fleetgraph', 'lib/fleet', 'docs/fleetadvisor-compliance.md', 'supabase/migrations/20261020_fleetgraph_b.sql', 'docs/pr/brief-115'];
for (const root of roots) {
  for (const file of walk(root)) {
    if (!/\.(ts|tsx|md|sql|txt|json)$/.test(file)) continue;
    const src = readFileSync(file, 'utf8');
    const lower = src.toLowerCase();
    assert.equal(lower.includes(forbidden), false, file);
    assert.equal(lower.includes(otherBrand), false, file);
    if (file.includes('components/fleet') || file.includes('app/dashboard/fleetgraph') || file.includes('app/preview/fleetgraph')) {
      assert.equal(banned.test(src), false, file);
      assert.equal(/stone-|amber-/.test(src), false, file);
      assert.equal(/window\.(alert|confirm|prompt)/.test(src), false, file);
    }
    if (file.endsWith('ComplianceViews.tsx') || file.endsWith('FleetSubjectPage.tsx') || file.includes('app/dashboard/fleetgraph/compliance') || file.includes('app/dashboard/fleetgraph/import') || file.includes('/vehicles/[id]') || file.includes('/drivers/[id]')) {
      assert.equal(src.includes('<aside'), false, file);
    }
  }
}

const views = readFileSync('components/fleet/ComplianceViews.tsx', 'utf8');
assert.equal(views.includes('http://'), false);
assert.equal(views.includes('https://'), false);
assert.equal(/data-testid="[^"]*®/.test(views), false);
assert.match(views, /FleetAdvisor®/);
assert.match(views, /#00b4d8|#0f172a|#0077b6/);

const email = readFileSync('lib/fleet/reminders-email.ts', 'utf8');
assert.equal(email.includes('http://'), false);
assert.equal(email.includes('https://'), false);
assert.match(email, /FleetAdvisor®/);

console.log('brief115-brand.test.ts ok');
