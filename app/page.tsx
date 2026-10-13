import type { Metadata } from 'next';
import HomeLanding from '@/components/marketing/HomeLanding';
import { hreflangAlternates } from '@/lib/i18n/config';
import { SITE_URL } from '@/lib/seo/site';

export const metadata: Metadata = {
  description:
    'SupplierAdvisor® is the supply-chain OS with a verified trade and trust layer. A 30-day company trial and a free SA Member account.',
  alternates: {
    canonical: SITE_URL,
    languages: hreflangAlternates('/', SITE_URL),
  },
  openGraph: {
    locale: 'en_ZA',
  },
};

/**
 * Brief 10 — first HTML is hero + compact CTA + nav only.
 * Product mocks load in a client island (HomeBelowFoldLazy) with ssr: false.
 */
export default function LandingPage() {
  return <HomeLanding />;
}
