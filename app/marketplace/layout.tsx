import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'B2B Marketplace | SupplierAdvisor',
  description:
    'Browse public B2B product listings from verified African suppliers. Inquire, connect, trade, and settle on SupplierAdvisor.',
  openGraph: {
    title: 'SupplierAdvisor Marketplace',
    description:
      'Open B2B catalogue — connect, raise POs, settle with claims or USDC escrow.',
    url: 'https://www.supplieradvisor.com/marketplace',
    type: 'website',
  },
  alternates: {
    canonical: 'https://www.supplieradvisor.com/marketplace',
  },
  robots: { index: true, follow: true },
};

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
