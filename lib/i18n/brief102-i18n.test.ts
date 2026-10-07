/**
 * Brief 102 — i18n routing + dictionary guardrails.
 * Run: npx --yes tsx lib/i18n/brief102-i18n.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  TRANSLATED_PATHS,
  hreflangAlternates,
  localizedPath,
  stripLocale,
} from '@/lib/i18n/config';
import { en } from '@/lib/i18n/dict/en';
import fr from '@/lib/i18n/dict/fr';
import ar from '@/lib/i18n/dict/ar';
import pt from '@/lib/i18n/dict/pt';
import sw from '@/lib/i18n/dict/sw';
import zu from '@/lib/i18n/dict/zu';

assert.equal(localizedPath('fr', '/'), '/fr');
assert.equal(localizedPath('en', '/pricing'), '/pricing');
assert.equal(localizedPath('ar', '/pricing'), '/ar/pricing');

assert.deepEqual(stripLocale('/fr/pricing'), { locale: 'fr', pathname: '/pricing' });
assert.deepEqual(stripLocale('/pricing'), { locale: 'en', pathname: '/pricing' });
assert.deepEqual(stripLocale('/ar'), { locale: 'ar', pathname: '/' });

const rootAlternates = hreflangAlternates('/');
assert.equal(Object.keys(rootAlternates).length, 7);
assert.equal(rootAlternates.en, 'https://www.supplieradvisor.com/');
assert.equal(rootAlternates.fr, 'https://www.supplieradvisor.com/fr');
assert.equal(rootAlternates['x-default'], 'https://www.supplieradvisor.com/');

for (const dict of [fr, ar, pt, sw, zu]) {
  for (const key of Object.keys(dict)) {
    assert.ok(key in en, `missing english fallback for key: ${key}`);
  }
}

for (const dict of [fr, ar, pt, sw, zu]) {
  assert.match(dict['brand.supplierAdvisor'] || '', /SupplierAdvisor®/);
  assert.match(dict['brand.schoolAdvisor'] || '', /SchoolAdvisor®/);
  assert.match(dict['brand.superCube'] || '', /Super-Cube®/);
  assert.match(dict['brand.bigFiveGroup'] || '', /Big Five Group/);
}

assert.match(ar['brand.supplierAdvisor'] || '', /\u2066.*\u2069/);
assert.match(ar['brand.schoolAdvisor'] || '', /\u2066.*\u2069/);
assert.match(ar['brand.superCube'] || '', /\u2066.*\u2069/);
assert.match(ar['brand.bigFiveGroup'] || '', /\u2066.*\u2069/);

const localePages = readdirSync(resolve(process.cwd(), 'app/[locale]'), {
  recursive: true,
})
  .map((p) => String(p))
  .filter((p) => p.endsWith('/page.tsx') || p === 'page.tsx')
  .map((p) => `/${p.replace(/\/page\.tsx$/, '').replace(/\\/g, '/')}`)
  .map((p) => (p === '/' ? '/' : p));

const normalized = new Set(localePages.map((p) => (p === '/page.tsx' ? '/' : p)));
assert.ok(normalized.has('/'), 'localized / page missing');
assert.ok(normalized.has('/pricing'), 'localized /pricing page missing');
assert.deepEqual(new Set(TRANSLATED_PATHS), new Set(['/','/pricing']));

console.log('brief102-i18n.test.ts ok');
