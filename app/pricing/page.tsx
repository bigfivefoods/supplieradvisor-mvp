import type { Metadata } from 'next';
import PricingContent from '@/components/marketing/PricingContent';
import { hreflangAlternates } from '@/lib/i18n/config';
import { SITE_URL } from '@/lib/seo/site';
import { COMPANY_PROFILE_PDF } from '@/lib/marketing/company-profile';
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
  const companyProfileHref = COMPANY_PROFILE_PDF.href;
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
      <PricingContent companyProfileHref={companyProfileHref} />
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
