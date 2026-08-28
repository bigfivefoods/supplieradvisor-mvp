/**
 * Run: npx --yes tsx lib/http/tenant-list.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseListLimit, MAX_LIST_LIMIT, DEFAULT_LIST_LIMIT } from './tenant-list';

assert.equal(parseListLimit(null), DEFAULT_LIST_LIMIT);
assert.equal(parseListLimit('50'), 50);
assert.equal(parseListLimit('999'), MAX_LIST_LIMIT);
assert.equal(DEFAULT_LIST_LIMIT, 50);
assert.ok(MAX_LIST_LIMIT <= 100);

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

const customersGet = src('app/api/customers/route.ts').split('export async function POST')[0];
assert.match(customersGet, /parseListLimit/);
assert.doesNotMatch(customersGet, /select\('\*'\)/);
assert.doesNotMatch(customersGet, /\.limit\(500\)/);

const coaGet = src('app/api/accounting/chart-of-accounts/route.ts').split('export async function POST')[0];
assert.match(coaGet, /1180\|2180\|4400/);
assert.doesNotMatch(coaGet, /party_leaves'\) === '1' \|\| Boolean\(q\)/);

const page = src('app/page.tsx');
assert.doesNotMatch(page, /@privy-io\/react-auth/);
assert.doesNotMatch(page, /from 'viem'/);
assert.doesNotMatch(page, /from 'wagmi'/);
assert.doesNotMatch(page, /ProductMocks/);
assert.doesNotMatch(page, /supply-chain-referral/);
assert.doesNotMatch(page, /getSupabaseServer/);

const pub = src('components/PublicProviders.tsx');
assert.doesNotMatch(pub, /@privy-io\/react-auth/);
assert.doesNotMatch(pub, /SchemaHealthBanner/);
assert.doesNotMatch(pub, /from 'viem'/);
assert.doesNotMatch(pub, /from 'wagmi'/);

const nav = src('components/marketing/LandingNav.tsx');
assert.doesNotMatch(nav, /@privy-io\/react-auth/);

const health = src('app/api/system/health/route.ts');
assert.doesNotMatch(health, /getSupabaseServer/);
assert.match(health, /runtime = 'edge'/);

const layout = src('app/layout.tsx');
assert.doesNotMatch(layout, /js\.paystack\.co/);

const core = src('lib/core-os/server.ts');
assert.match(core, /loadCustomersAndInvoices\(/);
assert.match(core, /limit: opts\?\.limit/);
assert.doesNotMatch(core, /\.limit\(2000\)/);

const coaPage = src('app/dashboard/accounting/chart-of-accounts/page.tsx');
assert.doesNotMatch(coaPage, /party_leaves/);

console.log('tenant-list.test.ts / brief9 ok');
