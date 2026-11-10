/**
 * Run: npx --yes tsx lib/marketing/home-recent.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { INDUSTRY_PACK_MONTHLY_ZAR, CORE_OS_MONTHLY_ZAR } from '../product/packaging-constants';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

assert.equal(CORE_OS_MONTHLY_ZAR, 299);
assert.equal(INDUSTRY_PACK_MONTHLY_ZAR, 199);

const page = src('app/product/page.tsx');
assert.match(page, /ProductPageSections/);

const recent = src('components/marketing/HomeRecent.tsx');
assert.match(recent, /from 'next\/image'/);
assert.match(recent, /loading="lazy"/);
assert.match(recent, /quality=\{60\}/);
assert.doesNotMatch(recent, /priority/);
assert.match(recent, /\/marketing\/trade-customer-app\.webp/);
assert.match(recent, /\/industries\/trades/);
assert.match(recent, /\/customer\/tradegraph\/demo/);
assert.match(recent, /pricing\.packsBody/);
assert.match(recent, /pricing\.packsTitle/);
assert.match(recent, /INDUSTRY_PACK_MONTHLY_ZAR/);
assert.match(recent, /CORE_OS_MONTHLY_ZAR/);
assert.match(recent, /#00b4d8/);
assert.match(recent, /prefetch=\{false\}/);
assert.match(recent, /TradeAdvisor®/);
assert.doesNotMatch(recent, /https?:\/\//);
assert.doesNotMatch(recent, /supplieradvisor\.com/i);
assert.doesNotMatch(recent, /@privy-io|usePrivy|from 'viem'|from 'wagmi'|undici|getSupabaseServer|lib\/product\/architecture/);
assert.doesNotMatch(recent, /useEffect|useState/);

const image = statSync(resolve('public/marketing/trade-customer-app.webp'));
assert.ok(image.size > 0 && image.size < 80_000, `customer app image should stay under 80KB, got ${image.size}`);

const nextConfig = src('next.config.js');
assert.match(nextConfig, /qualities:\s*\[60,\s*75\]/);

console.log('home-recent.test.ts ok');
