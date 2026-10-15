/**
 * Run: npx --yes tsx lib/recovery/brief111-portal-shells.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RECOVER_PORTAL_PAGE_PREFIXES, isPublicApiPath, isRecoverPortalPath } from '@/lib/auth/public-paths';

const pages = [
  'app/(recover-portal)/creditor/recovergraph/[token]/page.tsx',
  'app/(recover-portal)/debtor/recovergraph/[token]/page.tsx',
  'app/(recover-portal)/attorney/recovergraph/[token]/page.tsx',
  'app/(recover-portal)/layout.tsx',
  'components/recovery/PortalPending.tsx',
];

for (const file of pages) {
  const src = readFileSync(resolve(file), 'utf8');
  assert.doesNotMatch(src, /fetch\(/);
  assert.doesNotMatch(src, /supabase/i);
  assert.doesNotMatch(src, /params\.token/);
  assert.doesNotMatch(src, /\{token\}/);
  assert.doesNotMatch(src, /searchParams/);
}

const layout = readFileSync(resolve('app/(recover-portal)/layout.tsx'), 'utf8');
assert.match(layout, /noindex/);
assert.match(layout, /nofollow/);
assert.match(layout, /absolute: 'RecoverAdvisor®'/);
assert.match(layout, /manifest: null/);
assert.match(layout, /description: null/);
assert.match(layout, /keywords: null/);
assert.match(layout, /icons:/);
assert.match(layout, /apple:\s*\[\]/);
assert.match(layout, /appleWebApp:\s*false/);
assert.match(layout, /themeColor:\s*'#f8fafc'/);
assert.doesNotMatch(layout, /manifest\.webmanifest/);
assert.doesNotMatch(layout, /SupplierAdvisor/);
assert.doesNotMatch(layout, /apple-mobile-web-app-capable/);
assert.doesNotMatch(layout, /mobile-web-app-capable/);
assert.doesNotMatch(layout, /serviceWorker\.register/);
assert.doesNotMatch(layout, /node\.remove\(\)/);
assert.doesNotMatch(layout, /rel="icon"/);

assert.deepEqual([...RECOVER_PORTAL_PAGE_PREFIXES], [
  '/creditor/recovergraph',
  '/debtor/recovergraph',
  '/attorney/recovergraph',
]);
assert.equal(isRecoverPortalPath('/creditor/recovergraph/abc'), true);
assert.equal(isRecoverPortalPath('/dashboard/recovergraph'), false);
assert.equal(isPublicApiPath('/api/recovery/recovergraph'), false);

const paths = readFileSync(resolve('lib/auth/public-paths.ts'), 'utf8');
assert.doesNotMatch(paths, /\/api\/recovery/);
assert.doesNotMatch(paths, /\/api\/public\/recovergraph/);

const middleware = readFileSync(resolve('middleware.ts'), 'utf8');
assert.match(middleware, /isRecoverPortalPath/);
assert.match(middleware, /private, no-store/);
assert.match(middleware, /x-sa-portal/);

const root = readFileSync(resolve('app/layout.tsx'), 'utf8');
assert.doesNotMatch(root, /headers\(/);
assert.doesNotMatch(root, /serviceWorker\.register/);
assert.doesNotMatch(root, /apple-mobile-web-app-capable/);

const chrome = readFileSync(resolve('components/recovery/RecoverChrome.tsx'), 'utf8');
assert.doesNotMatch(chrome, /<aside/);

console.log('brief111-portal-shells.test.ts ok');
