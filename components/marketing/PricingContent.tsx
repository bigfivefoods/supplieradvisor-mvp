import Link from 'next/link';
import SiteFooter from '@/components/marketing/SiteFooter';
import LocaleDataScript from '@/components/i18n/LocaleDataScript';
import { formatZar } from '@/lib/billing/company-subscription';
import {
  MARKETING_PRICING_TERMS,
  PRICING_FAQ_ITEMS,
  PRICING_SECTION_IDS,
  REFERRAL_EXPLAINER_STEPS,
  REFERRAL_LEVEL_DETAILS,
} from '@/lib/marketing/pricing-plans';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config';
import { en, format, t, type Dict } from '@/lib/i18n/dict';

export default function PricingContent({ locale = DEFAULT_LOCALE, dict = en }: { locale?: Locale; dict?: Dict }) {
  const tierLabel = (id: string) =>
    id === 'monthly'
      ? t(dict, 'pricing.tier.monthly')
      : id === '1y'
        ? t(dict, 'pricing.tier.1y')
        : id === '2y'
          ? t(dict, 'pricing.tier.2y')
          : t(dict, 'pricing.tier.3y');

  const tierCta = (id: string) =>
    id === 'monthly'
      ? t(dict, 'pricing.tierCta.monthly')
      : id === '1y'
        ? t(dict, 'pricing.tierCta.1y')
        : id === '2y'
          ? t(dict, 'pricing.tierCta.2y')
          : t(dict, 'pricing.tierCta.3y');

  const referralLevelDescription = (index: number) =>
    index === 0
      ? t(dict, 'pricing.referral.level1')
      : index === 1
        ? t(dict, 'pricing.referral.level2')
        : t(dict, 'pricing.referral.level3');

  const stepTitle = (index: number) =>
    index === 0
      ? t(dict, 'pricing.referral.step1.title')
      : index === 1
        ? t(dict, 'pricing.referral.step2.title')
        : t(dict, 'pricing.referral.step3.title');

  const stepBody = (index: number) =>
    index === 0
      ? t(dict, 'pricing.referral.step1.body')
      : index === 1
        ? t(dict, 'pricing.referral.step2.body')
        : t(dict, 'pricing.referral.step3.body');

  const faqQ = (index: number) =>
    index === 0
      ? t(dict, 'pricing.faq.1.q')
      : index === 1
        ? t(dict, 'pricing.faq.2.q')
        : index === 2
          ? t(dict, 'pricing.faq.3.q')
          : index === 3
            ? t(dict, 'pricing.faq.4.q')
            : index === 4
              ? t(dict, 'pricing.faq.5.q')
              : index === 5
                ? t(dict, 'pricing.faq.6.q')
                : t(dict, 'pricing.faq.7.q');

  const faqA = (index: number) =>
    index === 0
      ? t(dict, 'pricing.faq.1.a')
      : index === 1
        ? t(dict, 'pricing.faq.2.a')
        : index === 2
          ? t(dict, 'pricing.faq.3.a')
          : index === 3
            ? t(dict, 'pricing.faq.4.a')
            : index === 4
              ? t(dict, 'pricing.faq.5.a')
              : index === 5
                ? t(dict, 'pricing.faq.6.a')
                : t(dict, 'pricing.faq.7.a');

  return (
    <>
      {locale !== DEFAULT_LOCALE ? <LocaleDataScript dict={dict} /> : null}
      <main className="bg-white text-slate-900">
        <section id={PRICING_SECTION_IDS.pricing} className="sa-anchor border-b border-slate-200">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">{t(dict, 'pricing.kicker')}</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{t(dict, 'pricing.title')}</h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-700">
              {t(dict, 'pricing.lede')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login?next=%2Fonboarding%3Ftype%3Dbusiness"
                hrefLang="en"
                className="rounded-xl bg-[#0077b6] px-6 py-3 text-sm font-bold text-white hover:bg-[#00639a]"
              >
                {t(dict, 'pricing.ctaTrial')}
              </Link>
              <Link
                href="/demo"
                hrefLang="en"
                className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                {t(dict, 'pricing.ctaDemo')}
              </Link>
            </div>
          </div>
        </section>

        <section id={PRICING_SECTION_IDS.tiers} className="sa-anchor border-b border-slate-200 bg-slate-50/60">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{t(dict, 'pricing.tiers')}</h2>
            <p className="mt-3 max-w-3xl text-slate-700">{t(dict, 'pricing.tiersBody')}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {MARKETING_PRICING_TERMS.map((tier) => (
                <article key={tier.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tierLabel(tier.id)}</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{formatZar(tier.payZar)}</p>
                  <p className="text-sm text-slate-600">
                    {tier.months === 1
                      ? t(dict, 'pricing.monthlyList')
                      : format(t(dict, 'pricing.prepaidTerm'), { months: tier.months })}
                  </p>
                  {tier.discountPercent > 0 ? (
                    <p className="mt-2 text-sm font-semibold text-emerald-700">
                      {format(t(dict, 'pricing.save'), {
                        discount: tier.discountPercent,
                        savings: formatZar(tier.savingsZar),
                        effective: formatZar(Math.round(tier.effectiveMonthlyZar)),
                      })}
                    </p>
                  ) : null}
                  <p className="mt-3 text-sm text-slate-700">{tierCta(tier.id)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id={PRICING_SECTION_IDS.referral} className="sa-anchor border-b border-slate-200">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{t(dict, 'pricing.referralTitle')}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {REFERRAL_LEVEL_DETAILS.map((level, index) => (
                <article key={level.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-bold text-slate-900">{level.label}</h3>
                  <p className="mt-1 text-2xl font-black text-emerald-700">{level.rate}%</p>
                  <p className="mt-1 text-sm text-slate-600">{referralLevelDescription(index)}</p>
                </article>
              ))}
            </div>
            <ol className="mt-6 space-y-3 text-slate-700">
              {REFERRAL_EXPLAINER_STEPS.map((step, index) => (
                <li key={step.title} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {format(t(dict, 'pricing.step'), { step: index + 1 })}
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">{stepTitle(index)}</p>
                  <p className="mt-1 text-sm leading-relaxed">{stepBody(index)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{t(dict, 'pricing.faq')}</h2>
          <div className="mt-6 space-y-4">
            {PRICING_FAQ_ITEMS.map((item, index) => (
              <article key={item.question} className="rounded-2xl border border-slate-200 p-5">
                <h3 className="text-lg font-bold text-slate-900">{faqQ(index)}</h3>
                <p className="mt-2 leading-relaxed text-slate-700">{faqA(index)}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
