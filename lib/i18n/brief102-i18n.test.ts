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
import type { DictKey } from '@/lib/i18n/dict/en';

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

const usedKeys: DictKey[] = [
  'meta.home.title',
  'meta.home.description',
  'meta.pricing.title',
  'meta.pricing.description',
  'switcher.chooseLanguage',
  'notice.englishOnlyPage',
  'notice.englishOnlySection',
  'nav.ariaPrimary',
  'nav.ariaOpenMenu',
  'nav.ariaCloseMenu',
  'nav.ariaCloseOverlay',
  'nav.ariaSiteMenu',
  'nav.ariaOpenMore',
  'nav.ariaCloseMore',
  'nav.ariaMoreMenu',
  'nav.groupProduct',
  'nav.groupPricing',
  'nav.groupTry',
  'nav.product',
  'nav.member',
  'nav.why',
  'nav.modules',
  'nav.howFits',
  'nav.pricing',
  'nav.roi',
  'nav.industries',
  'nav.demo',
  'nav.more',
  'nav.appearance',
  'nav.logIn',
  'nav.startTrial',
  'nav.freeTrial',
  'nav.memberCreate',
  'theme.ariaLabel',
  'theme.trigger',
  'theme.light',
  'theme.dark',
  'theme.system',
  'home.trialStrip',
  'home.startTrial',
  'hero.headlineLead',
  'hero.headlineAccent',
  'hero.compare',
  'hero.businessRun',
  'hero.bookDemo',
  'hero.notExcel',
  'hero.trialDays',
  'hero.membersNeverPay',
  'hero.scene.b2b.title',
  'hero.scene.b2b.short',
  'hero.scene.b2b.body',
  'hero.scene.b2b.point1',
  'hero.scene.b2b.point2',
  'hero.scene.b2b.point3',
  'hero.scene.b2b.cta',
  'hero.scene.b2g.title',
  'hero.scene.b2g.short',
  'hero.scene.b2g.body',
  'hero.scene.b2g.point1',
  'hero.scene.b2g.point2',
  'hero.scene.b2g.point3',
  'hero.scene.b2g.cta',
  'hero.scene.b2c.title',
  'hero.scene.b2c.short',
  'hero.scene.b2c.body',
  'hero.scene.b2c.point1',
  'hero.scene.b2c.point2',
  'hero.scene.b2c.point3',
  'hero.scene.b2c.cta',
  'footer.tagline',
  'footer.motto',
  'footer.explore',
  'footer.industries',
  'footer.resources',
  'footer.group.product',
  'footer.group.getStarted',
  'footer.group.network',
  'footer.group.trust',
  'footer.group.apps',
  'footer.social',
  'footer.industriesBySector',
  'footer.legalNav',
  'footer.link.compare',
  'footer.link.security',
  'footer.link.roi',
  'footer.link.demo',
  'footer.link.joinBusiness',
  'footer.link.marketplace',
  'footer.link.findAdvisor',
  'footer.link.cipcSla',
  'footer.link.memberSignup',
  'footer.link.installApp',
  'footer.link.privacy',
  'footer.link.terms',
  'footer.link.cancellation',
  'footer.foundingTitle',
  'footer.foundingBlurb',
  'footer.rights',
  'footer.bigFiveCompany',
  'footer.contact.country',
  'footer.form.emailLabel',
  'footer.form.emailPlaceholder',
  'footer.form.consentLead',
  'footer.form.privacy',
  'footer.form.join',
  'footer.form.success',
  'footer.form.error',
  'pricing.kicker',
  'pricing.title',
  'pricing.lede',
  'pricing.ctaTrial',
  'pricing.ctaDemo',
  'pricing.companyProfile',
  'pricing.englishNote',
  'pricing.tiers',
  'pricing.tiersBody',
  'pricing.tier.monthly',
  'pricing.tier.1y',
  'pricing.tier.2y',
  'pricing.tier.3y',
  'pricing.tierCta.monthly',
  'pricing.tierCta.1y',
  'pricing.tierCta.2y',
  'pricing.tierCta.3y',
  'pricing.monthlyList',
  'pricing.prepaidTerm',
  'pricing.save',
  'pricing.referralTitle',
  'pricing.referral.label1',
  'pricing.referral.label2',
  'pricing.referral.label3',
  'pricing.referral.level1',
  'pricing.referral.level2',
  'pricing.referral.level3',
  'pricing.referral.step1.title',
  'pricing.referral.step1.body',
  'pricing.referral.step2.title',
  'pricing.referral.step2.body',
  'pricing.referral.step3.title',
  'pricing.referral.step3.body',
  'pricing.faq',
  'pricing.faq.1.q',
  'pricing.faq.1.a',
  'pricing.faq.2.q',
  'pricing.faq.2.a',
  'pricing.faq.3.q',
  'pricing.faq.3.a',
  'pricing.faq.4.q',
  'pricing.faq.4.a',
  'pricing.faq.5.q',
  'pricing.faq.5.a',
  'pricing.faq.6.q',
  'pricing.faq.6.a',
  'pricing.faq.7.q',
  'pricing.faq.7.a',
  'pricing.step',
];

for (const [locale, dict] of Object.entries({ fr, ar, pt, sw, zu })) {
  for (const key of usedKeys) {
    assert.ok(dict[key], `${locale} missing required key: ${key}`);
  }
}

for (const [locale, dict] of Object.entries({ fr, ar, pt, sw, zu })) {
  assert.equal(dict['nav.member'], 'SA Member', `${locale} nav.member should keep SA Member untranslated`);
}

const mustDifferFromEnglish: DictKey[] = [
  'nav.ariaPrimary',
  'footer.social',
  'footer.industriesBySector',
  'footer.legalNav',
  'footer.contact.country',
  'footer.form.success',
  'footer.form.error',
  'pricing.referral.label1',
  'pricing.referral.label2',
  'pricing.referral.label3',
];
for (const [locale, dict] of Object.entries({ fr, ar, pt, sw, zu })) {
  for (const key of mustDifferFromEnglish) {
    assert.notEqual(dict[key], en[key], `${locale} should translate ${key}`);
  }
}

assert.match(pt['pricing.tiersBody'] || '', /utilizadores/i, 'pt should use European Portuguese "utilizadores"');
assert.match(
  `${pt['pricing.ctaTrial']} ${pt['hero.trialDays']}` || '',
  /teste gratuito|período experimental gratuito/i,
  'pt should use European Portuguese trial wording'
);
assert.match(pt['nav.why'] || '', /porquê/i, 'pt should use European Portuguese “Porquê” phrasing');
assert.match(pt['hero.headlineLead'] || '', /fiável/i, 'pt should use “fiável”');
assert.match(pt['meta.pricing.description'] || '', /utilizadores/i, 'pt pricing meta should use “utilizadores”');
assert.match(pt['meta.pricing.description'] || '', /poupança/i, 'pt pricing meta should use “poupança”');

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

for (const [locale, dict] of Object.entries({ fr, ar, pt, sw, zu })) {
  const serialized = JSON.stringify(dict);
  assert.ok(!/\/mo(?!is)/i.test(serialized), `${locale} should not contain "/mo" short month marker`);
}

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
assert.deepEqual(new Set(TRANSLATED_PATHS), new Set(['/', '/pricing']));

console.log('brief102-i18n.test.ts ok');
