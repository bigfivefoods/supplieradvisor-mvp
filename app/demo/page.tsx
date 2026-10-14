import type { Metadata } from 'next';
import LandingNav from '@/components/marketing/LandingNav';
import InteractiveDemoMain from '@/components/marketing/InteractiveDemoMain';
import SiteFooter from '@/components/marketing/SiteFooter';
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

export default function InteractiveDemoPage() {
  return (
    <div className="min-h-dvh bg-[#f8fafc] text-slate-900">
      <LandingNav />
      <InteractiveDemoMain />
      <SiteFooter />
    </div>
  );
}
