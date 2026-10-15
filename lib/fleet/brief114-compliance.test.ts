/**
 * FleetAdvisor® expiry status.
 * Run: npx --yes tsx lib/fleet/brief114-compliance.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { complianceLabel, complianceStatus, prdpCategoryMissing } from './compliance';

assert.equal(complianceStatus(null, '2026-03-04', 30), 'no_date');
assert.equal(complianceStatus('2026-03-03', '2026-03-04', 30), 'expired');
assert.equal(complianceStatus('2026-03-04', '2026-03-04', 0), 'expiring');
assert.equal(complianceStatus('2026-03-05', '2026-03-04', 0), 'valid');
assert.equal(complianceStatus('2026-03-05', '2026-03-04', 1), 'expiring');
assert.equal(complianceStatus('2026-04-03', '2026-03-04', 30), 'expiring');
assert.equal(complianceStatus('2026-04-04', '2026-03-04', 30), 'valid');
assert.equal(complianceStatus('2027-03-04', '2026-03-04', 365), 'expiring');
assert.equal(complianceStatus('2027-03-05', '2026-03-04', 365), 'valid');
assert.equal(complianceStatus('2026-03-03T22:30:00.000Z', '2026-03-03T21:30:00.000Z', 0), 'valid');
assert.equal(complianceStatus('2026-03-03T21:30:00.000Z', '2026-03-03T22:30:00.000Z', 0), 'expired');
assert.equal(complianceLabel('2026-03-01', '2026-03-04', 30), 'Expired 3 days ago');
assert.equal(complianceLabel('2027-03-12', '2026-03-04', 30), 'Expires 12 Mar 2027');
assert.equal(prdpCategoryMissing('prdp', {}), true);
assert.equal(prdpCategoryMissing('prdp', { category: 'G' }), false);
assert.equal(prdpCategoryMissing('medical', {}), false);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const banned = /\b(legal|compliant|certified)\b/i;
for (const file of [
  ...walk('components/fleet'),
  ...walk('app/dashboard/fleetgraph'),
  ...walk('app/preview/fleetgraph'),
]) {
  const src = readFileSync(file, 'utf8');
  assert.equal(banned.test(src), false, file);
}

console.log('brief114-compliance.test.ts ok');
