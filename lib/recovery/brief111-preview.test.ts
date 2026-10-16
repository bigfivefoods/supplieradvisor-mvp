/**
 * The signed-out sample does not call the API or the database.
 * Run: npx --yes tsx lib/recovery/brief111-preview.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { isPublicApiPath, isPublicPagePath } from '../auth/public-paths';

function filesIn(path: string): string[] {
  const full = resolve(path);
  if (!statSync(full).isDirectory()) return [full];
  return readdirSync(full).flatMap((name) => filesIn(resolve(full, name)));
}

const files = [
  ...filesIn('app/preview/recovergraph'),
  resolve('components/recovery/PreviewDesk.tsx'),
].filter((file) => file.endsWith('.tsx') || file.endsWith('.ts'));

const src = files.map((file) => readFileSync(file, 'utf8')).join('\n');
assert.equal(src.includes('getSupabase'), false);
assert.equal(src.includes('/api/'), false);
assert.match(src, /data-book-ready/);
assert.match(src, /Illustration · sample data/);
assert.match(src, /Sample/);
assert.doesNotMatch(src, /<aside/);
assert.equal(isPublicPagePath('/preview/recovergraph'), true);
assert.equal(isPublicPagePath('/preview/recovergraph/queue'), true);
assert.equal(isPublicPagePath('/preview/recovergraph/settings/team'), true);
assert.equal(isPublicPagePath('/api/preview/recovergraph'), false);
assert.equal(isPublicApiPath('/api/recovery/recovergraph'), false);
assert.equal(isPublicApiPath('/preview/recovergraph'), false);

const desks = [
  'components/recovery/RecoverQueue.tsx',
  'components/recovery/RecoverBooks.tsx',
  'components/recovery/RecoverTeam.tsx',
  'components/recovery/RecoverPortals.tsx',
  'components/recovery/RecoverCommand.tsx',
];
for (const file of desks) {
  const page = readFileSync(resolve(file), 'utf8');
  assert.match(page, /RecoverDemoGate/, file);
}

const owner = readFileSync(resolve('app/work/recovergraph/manifest.webmanifest/route.ts'), 'utf8');
assert.match(owner, /private, no-store/);
assert.match(owner, /\/work\/recovergraph\?source=pwa/);
assert.match(owner, /scope: '\/work\/recovergraph'/);
assert.match(owner, /\/recover\/owner-192.png/);

const crew = readFileSync(resolve('app/crew/recovergraph/[token]/manifest.webmanifest/route.ts'), 'utf8');
const customer = readFileSync(resolve('app/customer/recovergraph/[token]/manifest.webmanifest/route.ts'), 'utf8');
for (const manifest of [crew, customer]) {
  assert.match(manifest, /private, no-store/);
  assert.match(manifest, /token\.length < 8/);
  assert.match(manifest, /source=pwa/);
}
assert.match(crew, /\/recover\/workers-192.png/);
assert.match(customer, /\/recover\/client-192.png/);
assert.doesNotMatch(
  readFileSync(resolve('app/crew/recovergraph/[token]/page.tsx'), 'utf8'),
  /token/
);
assert.doesNotMatch(
  readFileSync(resolve('app/customer/recovergraph/[token]/page.tsx'), 'utf8'),
  /token/
);
for (const page of [
  'app/work/recovergraph/page.tsx',
  'app/crew/recovergraph/[token]/page.tsx',
  'app/customer/recovergraph/[token]/page.tsx',
]) {
  const body = readFileSync(resolve(page), 'utf8');
  assert.doesNotMatch(body, /\/preview\/recovergraph|\/dashboard\/recovergraph/, page);
  assert.match(body, /RecoverLaunching/, page);
}
for (const layout of [
  'app/crew/recovergraph/[token]/layout.tsx',
  'app/customer/recovergraph/[token]/layout.tsx',
]) {
  const body = readFileSync(resolve(layout), 'utf8');
  assert.match(body, /token\.length < 8/, layout);
  assert.match(body, /notFound\(\)/, layout);
}
const debtor = readFileSync(resolve('app/(recover-portal)/debtor/recovergraph/[token]/page.tsx'), 'utf8');
assert.match(debtor, /notFound\(\)/);
assert.doesNotMatch(debtor, /params\.token/);

console.log('brief111-preview.test.ts ok');
