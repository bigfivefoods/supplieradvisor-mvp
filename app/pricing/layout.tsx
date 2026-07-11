import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'SupplierAdvisor® pricing — 30-day free trial, then simple per-company plans for the full supply-chain operating system.',
  alternates: { canonical: 'https://www.supplieradvisor.com/pricing' },
  openGraph: {
    title: 'Pricing · SupplierAdvisor®',
    description:
      'Start free for 30 days. Full ERP, verified network trade, manufacturing, distribution, and intelligence.',
    url: 'https://www.supplieradvisor.com/pricing',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
