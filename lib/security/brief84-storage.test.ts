/**
 * Brief 84 storage hardening regression scan.
 * Run: npx --yes tsx lib/security/brief84-storage.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

function src(path: string): string {
  return readFileSync(resolve(path), 'utf8');
}

const noPublicUrlFiles = [
  'app/api/buyer/payment-proof/route.ts',
  'app/api/accounting/bank/import/route.ts',
  'lib/services/person-qualification-upload.ts',
  'lib/portals/portal-storage.ts',
  'lib/containers/uploadIdDocument.ts',
  'app/consumer/onboarding/page.tsx',
];

for (const path of noPublicUrlFiles) {
  assert.ok(!src(path).includes('getPublicUrl('), `${path} must not use getPublicUrl`);
}

const businessUpload = src('app/api/business/upload/route.ts');
const sensitiveBranchStart = businessUpload.indexOf('} else {');
assert.ok(sensitiveBranchStart >= 0, 'business/upload route must have non-logo branch');
assert.ok(
  !businessUpload.slice(sensitiveBranchStart).includes('getPublicUrl('),
  'business/upload sensitive branch must not use getPublicUrl'
);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue;
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

for (const root of ['app', 'lib', 'components']) {
  for (const file of walk(resolve(root))) {
    if (file.endsWith('brief84-storage.test.ts')) continue;
    const text = readFileSync(file, 'utf8');
    if (text.includes("from '@/utils/supabase/client'") && text.includes('.storage.')) {
      assert.fail(`${file} must not combine browser Supabase client with storage usage`);
    }
  }
}

for (const file of walk(resolve('app')).concat(walk(resolve('lib'))).concat(walk(resolve('components')))) {
  if (file.endsWith('brief84-storage.test.ts')) continue;
  const text = readFileSync(file, 'utf8');
  assert.ok(
    !text.includes('updateBucket(') || !text.includes('public: true'),
    `${file} must not force public buckets`
  );
}

const gatedDocRoute = src('app/api/storage/doc/route.ts');
const gateIdx = gatedDocRoute.indexOf('requireCompanyAccess');
const signIdx = gatedDocRoute.indexOf('signSensitiveRef');
assert.ok(gateIdx >= 0, '/api/storage/doc must require company access');
assert.ok(signIdx > gateIdx, '/api/storage/doc must gate before signing URLs');

const migrateRoute = src('app/api/system/platform-console/storage-migrate/route.ts');
assert.ok(
  migrateRoute.includes('requirePlatformConsoleAccess'),
  'storage-migrate route must require platform console access'
);
assert.ok(
  migrateRoute.includes('const dryRun = !apply && !deleteOriginals;'),
  'storage-migrate route must default to dry run'
);

console.log('✓ Brief 84 storage assertions passed');
