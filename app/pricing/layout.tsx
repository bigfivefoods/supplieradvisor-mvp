import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo/site';
import { SA_OG_IMAGE_URL } from '@/lib/brand/assets';

export const metadata: Metadata = {
  title: 'Pricing — free trial from R299/mo',
  description:
    'SupplierAdvisor® pricing: 30-day free trial, then from R299/month. Multi-year prepaid discounts. Supply-chain referral 6% / 3% / 1% (max 10%). List your company free.',
  keywords: [
    'SupplierAdvisor pricing',
    'supply chain software cost',
    'B2B software South Africa',
    'SRM pricing',
    'free trial ERP alternative',
  ],
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: 'Pricing · SupplierAdvisor®',
    description:
      'Company pricing, prepaid tiers, and supply-chain referral fees — all on supplieradvisor.com.',
    url: `${SITE_URL}/pricing`,
    type: 'website',
    siteName: 'SupplierAdvisor®',
    images: [{ url: SA_OG_IMAGE_URL, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing · SupplierAdvisor®',
    description: '30-day free trial · from R299/mo.',
    images: [SA_OG_IMAGE_URL],
  },
  robots: { index: true, follow: true },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
