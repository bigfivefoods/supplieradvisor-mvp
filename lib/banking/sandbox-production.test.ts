/**
 * Sample bank rows must not be offered when VERCEL_ENV=production.
 * Run: npx --yes tsx lib/banking/sandbox-production.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sandboxSamplesAllowed } from './providers/banklink';

assert.equal(sandboxSamplesAllowed({ VERCEL_ENV: 'production' }), false);
assert.equal(sandboxSamplesAllowed({ VERCEL_ENV: 'preview' }), true);
assert.equal(sandboxSamplesAllowed({ VERCEL_ENV: 'development' }), true);
assert.equal(sandboxSamplesAllowed({}), true);

for (const file of [
  'app/api/banking/connect/route.ts',
  'app/api/banking/sync/route.ts',
  'app/api/banking/cron-sync/route.ts',
]) {
  const src = readFileSync(file, 'utf8');
  assert.match(src, /sandboxSamplesAllowed\(\)/, file);
}

const cron = readFileSync('app/api/banking/cron-sync/route.ts', 'utf8');
assert.match(cron, /cfg\.mode === 'sandbox' && conn\.provider !== 'fnb'/);

console.log('sandbox-production.test.ts ok');
