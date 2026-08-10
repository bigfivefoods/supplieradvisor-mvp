import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo/site';
import { SA_OG_IMAGE_URL } from '@/lib/brand/assets';

export const metadata: Metadata = {
  title: 'Interactive demo — try SupplierAdvisor free',
  description:
    'Click through SupplierAdvisor® product mocks — operations, suppliers, finance, quality, inventory, and Super-Cube leadership — without signing up.',
  keywords: [
    'SupplierAdvisor demo',
    'supply chain software demo',
    'SRM demo',
    'B2B platform tour',
  ],
  alternates: { canonical: `${SITE_URL}/demo` },
  openGraph: {
    title: 'Interactive demo · SupplierAdvisor®',
    description:
      'Explore product mocks without signing up — ops, suppliers, finance, quality, and more.',
    url: `${SITE_URL}/demo`,
    type: 'website',
    images: [{ url: SA_OG_IMAGE_URL, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Interactive demo · SupplierAdvisor®',
    description: 'Click through the product without signing up.',
    images: [SA_OG_IMAGE_URL],
  },
  robots: { index: true, follow: true },
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
