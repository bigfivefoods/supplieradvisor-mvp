import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PricingContent from '@/components/marketing/PricingContent';
import { t } from '@/lib/i18n/dict';
import { getLocaleDict } from '@/lib/i18n/server';
import { DEFAULT_LOCALE, OG_LOCALE, hreflangAlternates, isLocale, type Locale } from '@/lib/i18n/config';
import { SITE_URL } from '@/lib/seo/site';
import {
  MARKETING_PRICING_TERMS,
  PRICING_FAQ_ITEMS,
} from '@/lib/marketing/pricing-plans';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale) || locale === DEFAULT_LOCALE) return {};
  const dict = await getLocaleDict(locale);
  const canonical = `${SITE_URL}/${locale}/pricing`;

  return {
    title: t(dict, 'meta.pricing.title'),
    description: t(dict, 'meta.pricing.description'),
    alternates: {
      canonical,
      languages: hreflangAlternates('/pricing', SITE_URL),
    },
    openGraph: {
      title: t(dict, 'meta.pricing.title'),
      description: t(dict, 'meta.pricing.description'),
      locale: OG_LOCALE[locale],
      url: canonical,
    },
    twitter: {
      title: t(dict, 'meta.pricing.title'),
      description: t(dict, 'meta.pricing.description'),
    },
  };
}

export default async function LocalizedPricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === DEFAULT_LOCALE) notFound();

  const dict = await getLocaleDict(locale as Locale);
  const canonicalUrl = `${SITE_URL}/${locale}/pricing`;
  const description = 'Company pricing from R299/mo with unlimited users and clear referral savings.';
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
      <PricingContent locale={locale as Locale} dict={dict} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </>
  );
}
