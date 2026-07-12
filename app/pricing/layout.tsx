import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'SupplierAdvisor® pricing — 30-day free trial, then R499/month per company. Save 15% (1 year), 25% (2 years), or 30% (3 years) prepaid. Paystack billing in ZAR.',
  alternates: { canonical: 'https://www.supplieradvisor.com/pricing' },
  openGraph: {
    title: 'Pricing · SupplierAdvisor®',
    description:
      'Start free for 30 days, then R499/month. Multi-year prepaid discounts up to 30%. Full ERP and verified network trade.',
    url: 'https://www.supplieradvisor.com/pricing',
  },
};

/** Standalone marketing shell — no dashboard sidebar / breadcrumb chrome. */
export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#f8fafc]">{children}</div>;
}
