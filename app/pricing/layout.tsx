import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'SupplierAdvisor® pricing on one site — 30-day free trial, then R299/month. Multi-year prepaid discounts. Supply-chain referral 6% / 3% / 1% (max 10%).',
  alternates: { canonical: 'https://www.supplieradvisor.com/#pricing' },
  openGraph: {
    title: 'Pricing · SupplierAdvisor®',
    description:
      'Company pricing, prepaid tiers, and supply-chain referral fees — all on supplieradvisor.com.',
    url: 'https://www.supplieradvisor.com/#pricing',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
