/**
 * Run: npx --yes tsx lib/trades/pricing-copy.test.ts
 * TradeAdvisor® is the core company plan plus the trades pack at R199/month.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INDUSTRY_PACK_MONTHLY_ZAR } from '../product/packaging-constants';

assert.equal(INDUSTRY_PACK_MONTHLY_ZAR, 199);

const en = readFileSync(resolve('lib/i18n/dict/en.ts'), 'utf8');
assert.match(en, /pricing\.packsTitle/);
assert.match(en, /TradeAdvisor® is sold the same way as the other industry packs/);
assert.match(en, /\+R199\/month on top of core/);

const pricing = readFileSync(resolve('components/marketing/PricingContent.tsx'), 'utf8');
assert.match(pricing, /pricing\.packsTitle/);
assert.match(pricing, /pricing\.packsBody/);

const billing = readFileSync(resolve('app/dashboard/my-business/billing/page.tsx'), 'utf8');
assert.match(billing, /including TradeAdvisor®, is \+R199\/mo on top of core/);
assert.match(billing, /p\.shortName\} \+R\{p\.monthlyZar\}/);

const pack = readFileSync(resolve('lib/product/architecture.ts'), 'utf8');
assert.match(pack, /id: 'trades'/);
assert.match(pack, /name: 'TradeAdvisor®'/);
assert.match(pack, /shortName: 'TradeAdvisor®'/);
assert.match(pack, /monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR/);

const env = readFileSync(resolve('.env.example'), 'utf8');
for (const key of [
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'RESEND_REPLY_TO',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
]) {
  assert.match(env, new RegExp(key));
}

const customer = readFileSync(resolve('components/trades/CustomerTradeApp.tsx'), 'utf8');
assert.doesNotMatch(customer, /@privy-io|usePrivy/);
assert.match(customer, /action: 'push_subscribe'/);
assert.match(customer, /Alerts are not available/);

console.log('pricing-copy.test.ts ok');
