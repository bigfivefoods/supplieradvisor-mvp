import type { Metadata } from 'next';
import PricingContent from '@/components/marketing/PricingContent';
import { COMPANY_PROFILE_PDF } from '@/lib/marketing/company-profile';
import {
  MARKETING_PRICING_TERMS,
  PRICING_FAQ_ITEMS,
} from '@/lib/marketing/pricing-plans';
import { absoluteUrl, jsonLdString, pricingFaqJsonLd, pricingProductJsonLd } from '@/lib/seo/jsonld';
import { marketingMetadata } from '@/lib/seo/metadata';
import { PRICING_SHARE_CARD } from '@/lib/seo/share-cards';

const title = 'Pricing · SupplierAdvisor® — 30-day trial from R299/month';
const description =
  'SupplierAdvisor® pricing: 30-day trial, then from R299/month. Unlimited team users on the company plan.';
const canonicalUrl = absoluteUrl('/pricing');

export const metadata: Metadata = marketingMetadata({
  path: '/pricing',
  title,
  absoluteTitle: true,
  description,
  image: PRICING_SHARE_CARD,
  keywords: [
    'SupplierAdvisor pricing',
    'supply chain software cost',
    'B2B software South Africa',
    'SRM pricing',
    'free trial ERP alternative',
  ],
});

export default function PricingPage() {
  const companyProfileHref = COMPANY_PROFILE_PDF.href;
  const productJsonLd = pricingProductJsonLd(
    canonicalUrl,
    description,
    MARKETING_PRICING_TERMS
  );
  const faqJsonLd = pricingFaqJsonLd(PRICING_FAQ_ITEMS);

  return (
    <>
      <PricingContent companyProfileHref={companyProfileHref} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }}
      />
    </>
  );
}
