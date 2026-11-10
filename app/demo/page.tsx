import type { Metadata } from 'next';
import LandingNav from '@/components/marketing/LandingNav';
import InteractiveDemoMain from '@/components/marketing/InteractiveDemoMain';
import SiteFooter from '@/components/marketing/SiteFooter';
import { marketingMetadata } from '@/lib/seo/metadata';
import { DEMO_SHARE_CARD } from '@/lib/seo/share-cards';
import { interactiveDemoHref } from '@/lib/preview/production-gate';

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
  const demoHref = interactiveDemoHref();
  return (
    <div className="min-h-dvh bg-[#f8fafc] text-slate-900">
      <LandingNav demoHref={demoHref} />
      <InteractiveDemoMain />
      <SiteFooter demoHref={demoHref} />
    </div>
  );
}
