/**
 * Run: npx --yes tsx lib/marketing/company-profile.test.ts
 *
 * The company profile PDF must exist in /public, stay small, and be linked from
 * server pages only (never from the home page bundle).
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { COMPANY_PROFILE_PDF } from '@/lib/marketing/company-profile';

const root = process.cwd();
const file = resolve(root, 'public', COMPANY_PROFILE_PDF.href.replace(/^\//, ''));

assert.ok(existsSync(file), `missing ${file} (run npm run profile:pdf)`);
const bytes = statSync(file).size;
assert.ok(bytes < 5 * 1024 * 1024, `profile PDF is ${bytes} bytes; keep it under 5 MB`);
assert.equal(readFileSync(file).subarray(0, 5).toString('latin1'), '%PDF-', 'not a PDF');

for (const page of ['app/pricing/page.tsx', 'app/industries/page.tsx']) {
  const src = readFileSync(resolve(root, page), 'utf8');
  assert.ok(src.includes('COMPANY_PROFILE_PDF.href'), `${page} should link the company profile`);
}

const home = readFileSync(resolve(root, 'app/page.tsx'), 'utf8');
assert.ok(!home.includes('company-profile'), 'do not link the profile from the home page bundle');

console.log(`company-profile: ok (${(bytes / 1024).toFixed(0)} KB)`);
