import type { Metadata } from 'next';
<<<<<<< HEAD
import PricingContent from '@/components/marketing/PricingContent';
import { hreflangAlternates } from '@/lib/i18n/config';
import { SITE_URL } from '@/lib/seo/site';
=======
import Link from 'next/link';
import SiteFooter from '@/components/marketing/SiteFooter';
import { COMPANY_PROFILE_PDF } from '@/lib/marketing/company-profile';
import { formatZar } from '@/lib/billing/company-subscription';
>>>>>>> origin/main
import {
  MARKETING_PRICING_TERMS,
  PRICING_FAQ_ITEMS,
} from '@/lib/marketing/pricing-plans';

const title = 'Pricing';
const description = 'Company pricing from R299/mo with unlimited users and clear referral savings.';
const canonicalUrl = `${SITE_URL}/pricing`;

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: canonicalUrl,
    languages: hreflangAlternates('/pricing', SITE_URL),
  },
  openGraph: {
    title,
    description,
    url: canonicalUrl,
    type: 'website',
    locale: 'en_ZA',
  },
};

export default function PricingPage() {
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'SupplierAdvisor Company Subscription',
    description,
    brand: {
      '@type': 'Brand',
      name: 'SupplierAdvisor',
    },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'ZAR',
      lowPrice: MARKETING_PRICING_TERMS[0]?.payZar,
      highPrice: MARKETING_PRICING_TERMS[MARKETING_PRICING_TERMS.length - 1]?.payZar,
      offerCount: MARKETING_PRICING_TERMS.length,
      offers: MARKETING_PRICING_TERMS.map((tier) => ({
        '@type': 'Offer',
        name: tier.label,
        priceCurrency: 'ZAR',
        price: tier.payZar,
        category: tier.months === 1 ? 'monthly' : 'prepaid',
        eligibleDuration: {
          '@type': 'QuantitativeValue',
          value: tier.months,
          unitText: 'month',
        },
        availability: 'https://schema.org/InStock',
        url: canonicalUrl,
      })),
    },
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: PRICING_FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <>
<<<<<<< HEAD
      <PricingContent />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
=======
      <main className="bg-white text-slate-900">
        <section id={PRICING_SECTION_IDS.pricing} className="sa-anchor border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Pricing</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Transparent company pricing from R299/month
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-700">
            SupplierAdvisor is built for companies that need one operating system across procurement,
            quality, supplier relationships, inventory, and finance. Instead of charging for every user,
            we price per company workspace so your operational team, leadership, and support staff can
            collaborate without seat anxiety. This keeps adoption practical for growing businesses and
            avoids fragmented tooling where only a subset of people can work in the system.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-slate-700">
            Every plan starts with a 30-day free trial and includes the same full platform. The difference
            between tiers is billing term and savings. Monthly gives flexibility; prepaid tiers reduce your
            effective monthly cost for teams that already know they want continuity. If you are scaling
            supplier onboarding, standardising trade controls, and improving audit readiness, longer terms
            normally deliver better planning certainty and lower total software cost.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-slate-700">
            We also run a trust-driven referral model designed for real trade networks. Referral fees are
            tied to paid platform subscriptions, not product turnover, so incentives stay aligned with
            long-term partner success. As partners become active and remain compliant, value compounds in
            a way that rewards healthy operational behavior instead of short-term sign-up volume.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login?next=%2Fonboarding%3Ftype%3Dbusiness"
              className="rounded-xl bg-[#0077b6] px-6 py-3 text-sm font-bold text-white hover:bg-[#00639a]"
            >
              Start free trial
            </Link>
            <Link
              href="/demo"
              className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Book a demo
            </Link>
            <a
              href={COMPANY_PROFILE_PDF.href}
              download
              type="application/pdf"
              className="inline-flex items-center gap-2 rounded-xl px-2 py-3 text-sm font-semibold text-[#0077b6] underline-offset-4 hover:underline"
            >
              {COMPANY_PROFILE_PDF.label}
              <span className="text-xs font-medium text-slate-500">{COMPANY_PROFILE_PDF.meta}</span>
            </a>
          </div>
        </div>
      </section>

      <section id={PRICING_SECTION_IDS.tiers} className="sa-anchor border-b border-slate-200 bg-slate-50/60">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Billing tiers</h2>
          <p className="mt-3 max-w-3xl text-slate-700">
            All tiers include unlimited users and the same full SupplierAdvisor product scope. Choose a
            billing term that fits your budgeting rhythm and maturity stage.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {MARKETING_PRICING_TERMS.map((tier) => (
              <article key={tier.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tier.label}</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{formatZar(tier.payZar)}</p>
                <p className="text-sm text-slate-600">
                  {tier.months === 1 ? 'Monthly list rate' : `${tier.months}-month prepaid term`}
                </p>
                {tier.discountPercent > 0 ? (
                  <p className="mt-2 text-sm font-semibold text-emerald-700">
                    Save {tier.discountPercent}% ({formatZar(tier.savingsZar)}) · ~
                    {formatZar(Math.round(tier.effectiveMonthlyZar))}/mo effective
                  </p>
                ) : null}
                <p className="mt-3 text-sm text-slate-700">{tier.cta}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id={PRICING_SECTION_IDS.referral} className="sa-anchor border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Referral programme: 6% / 3% / 1%</h2>
          <p className="mt-3 text-slate-700">
            The referral programme shares subscription value across three levels and caps the combined
            payout at 10%. L1 applies to direct invites, L2 applies when your referral invites another
            company, and L3 applies one level deeper. Because fees are linked to qualifying subscription
            payments, this model favours trustworthy onboarding and sustained platform use.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {REFERRAL_LEVEL_DETAILS.map((level) => (
              <article key={level.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-bold text-slate-900">{level.label}</h3>
                <p className="mt-1 text-2xl font-black text-emerald-700">{level.rate}%</p>
                <p className="mt-1 text-sm text-slate-600">{level.description}</p>
              </article>
            ))}
          </div>
          <ol className="mt-6 space-y-3 text-slate-700">
            {REFERRAL_EXPLAINER_STEPS.map((step, index) => (
              <li key={step.title} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step {index + 1}</p>
                <p className="mt-1 font-semibold text-slate-900">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Pricing FAQ</h2>
          <div className="mt-6 space-y-4">
            {PRICING_FAQ_ITEMS.map((item) => (
              <article key={item.question} className="rounded-2xl border border-slate-200 p-5">
                <h3 className="text-lg font-bold text-slate-900">{item.question}</h3>
                <p className="mt-2 leading-relaxed text-slate-700">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </main>
      <SiteFooter />
>>>>>>> origin/main
    </>
  );
}
