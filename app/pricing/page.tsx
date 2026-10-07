import type { Metadata } from 'next';
import PricingContent from '@/components/marketing/PricingContent';
import { hreflangAlternates } from '@/lib/i18n/config';
import { SITE_URL } from '@/lib/seo/site';
import { MARKETING_PRICING_TERMS } from '@/lib/marketing/pricing-plans';

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
  void MARKETING_PRICING_TERMS;
  return <PricingContent />;
}
