/**
 * Homepage recent showcase stays lazy, priced like /pricing, and marketing-only.
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

const page = src('app/page.tsx');
assert.doesNotMatch(page, /HomeRecent/);
assert.doesNotMatch(page, /next\/dynamic/);

const lazy = src('components/marketing/HomeBelowFoldLazy.tsx');
assert.match(lazy, /ssr:\s*false/);
assert.match(lazy, /import\('@\/components\/marketing\/HomeRecent'\)/);
assert.match(lazy, /import\('@\/components\/marketing\/HomeBelowFold'\)/);
assert.match(lazy, /notice\.englishOnlySection/);
assert.doesNotMatch(lazy, /setTimeout\(\(\) => \{\s*void import\('@\/components\/marketing\/HomeRecent'\)/);

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

const en = src('lib/i18n/dict/en.ts');
assert.match(en, /SupplierAdvisor®/);
assert.match(en, /TradeAdvisor® is the van operating system/);
assert.match(en, /\+R\{pack\}\/month on top of core/);
assert.match(en, /VerifyNow is already on SupplierAdvisor®/);

console.log('home-recent.test.ts ok');
