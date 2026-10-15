/**
 * FleetAdvisor® signed-out preview stays in memory.
 * Run: npx --yes tsx lib/fleet/brief114-preview.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = [
  'app/preview/fleetgraph/page.tsx',
  'app/preview/fleetgraph/[view]/page.tsx',
  'components/fleet/PreviewShell.tsx',
];
const src = files.map((file) => readFileSync(file, 'utf8')).join('\n');
assert.equal(/fetch\s*\(/.test(src), false);
assert.equal(src.includes('getSupabase'), false);
assert.match(src, /Illustration · sample data|illustrate/);
assert.match(src, /reset/);
assert.match(src, /data-book-ready/);
assert.match(src, /sessionStorage/);
assert.equal(src.includes('/api/'), false);

console.log('brief114-preview.test.ts ok');
