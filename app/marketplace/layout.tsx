import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo/site';
import { SA_OG_IMAGE_URL } from '@/lib/brand/assets';

export const metadata: Metadata = {
  title: 'B2B Marketplace — products from verified suppliers',
  description:
    'Browse public B2B product listings from verified suppliers on SupplierAdvisor. Inquire, connect, trade, and settle — open catalogue for African and global trade.',
  keywords: [
    'B2B marketplace',
    'supplier products',
    'verified suppliers',
    'SupplierAdvisor marketplace',
    'wholesale catalogue',
    'trade network',
  ],
  openGraph: {
    title: 'SupplierAdvisor Marketplace',
    description:
      'Open B2B catalogue — connect, raise POs, settle with claims or USDC escrow.',
    url: `${SITE_URL}/marketplace`,
    type: 'website',
    siteName: 'SupplierAdvisor®',
    locale: 'en_ZA',
    images: [{ url: SA_OG_IMAGE_URL, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SupplierAdvisor Marketplace',
    description: 'Open B2B catalogue from verified suppliers.',
    images: [SA_OG_IMAGE_URL],
  },
  alternates: {
    canonical: `${SITE_URL}/marketplace`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
