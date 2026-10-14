import type { Metadata } from 'next';
import { marketingMetadata } from '@/lib/seo/metadata';
import { DEMO_SHARE_CARD } from '@/lib/seo/share-cards';

export const metadata: Metadata = marketingMetadata({
  path: '/demo',
  title: 'Interactive demo · SupplierAdvisor®',
  absoluteTitle: true,
  description:
    'Explore SupplierAdvisor® without signing up — operations, suppliers, finance, quality, and trade.',
  image: DEMO_SHARE_CARD,
  keywords: [
    'SupplierAdvisor demo',
    'supply chain software demo',
    'SRM demo',
    'B2B platform tour',
  ],
});

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
