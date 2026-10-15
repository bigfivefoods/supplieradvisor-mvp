/**
 * Run: npx --yes tsx lib/recovery/brief116-pwa.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

for (const file of [
  'app/work/recovergraph/manifest.webmanifest/route.ts',
  'app/crew/recovergraph/[token]/manifest.webmanifest/route.ts',
  'app/customer/recovergraph/[token]/manifest.webmanifest/route.ts',
]) {
  const text = readFileSync(resolve(file), 'utf8');
  assert.match(text, /private, no-store/);
  assert.match(text, /#00b4d8/);
  assert.match(text, /#f8fafc/);
  assert.match(text, /standalone/);
  assert.doesNotMatch(text, /company_id|account_id/);
}

const sw = readFileSync(resolve('public/sw.js'), 'utf8');
assert.match(sw, /recover-offline\.html/);
assert.match(sw, /\/work\/recovergraph/);
assert.match(sw, /startsWith\('\/api\/'\)/);
assert.doesNotMatch(sw, /cache\.put\([^)]*\/api\//);
assert.equal(existsSync(resolve('public/recover-offline.html')), true);
const offline = readFileSync(resolve('public/recover-offline.html'), 'utf8');
assert.match(offline, /RecoverAdvisor®/);
assert.doesNotMatch(offline, /RC-/);

function filesIn(path: string): string[] {
  const full = resolve(path);
  if (!statSync(full, { throwIfNoEntry: false })?.isDirectory()) return existsSync(full) ? [full] : [];
  return readdirSync(full).flatMap((name) => filesIn(join(full, name)));
}
const desk = filesIn('app/dashboard/recovergraph').map((file) => readFileSync(file, 'utf8')).join('\n');
assert.equal(desk.includes('recover-bottom-nav'), false);
const installed = readFileSync(resolve('components/recovery/RecoverInstalled.tsx'), 'utf8');
assert.match(installed, /recover-bottom-nav/);
const root = readFileSync(resolve('app/layout.tsx'), 'utf8');
assert.equal(root.includes('headers('), false);
assert.equal(root.includes('cookies('), false);
for (const page of [
  'app/work/recovergraph/page.tsx',
  'app/crew/recovergraph/[token]/page.tsx',
  'app/customer/recovergraph/[token]/page.tsx',
]) {
  const body = readFileSync(resolve(page), 'utf8');
  assert.match(body, /RecoverLaunching/);
  assert.doesNotMatch(body, /params\.token|searchParams/);
}

console.log('brief116-pwa.test.ts ok');
