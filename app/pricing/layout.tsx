import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'SupplierAdvisor® pricing — 30-day free trial, then R299/month per company. Save up to 30% prepaid. Supply-chain referral: 6% / 3% / 1% (max 10%) when companies you invite subscribe. Paystack billing in ZAR.',
  alternates: { canonical: 'https://www.supplieradvisor.com/pricing' },
  openGraph: {
    title: 'Pricing · SupplierAdvisor®',
    description:
      'Start free for 30 days, then R299/month. Multi-year prepaid up to 30% off. Earn up to 10% referral fees across 3 levels when companies you invite pay.',
    url: 'https://www.supplieradvisor.com/pricing',
  },
};

/** Standalone marketing shell — no dashboard sidebar / breadcrumb chrome. */
export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#f8fafc]">{children}</div>;
}
