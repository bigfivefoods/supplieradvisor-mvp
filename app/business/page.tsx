import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingPageShell from '@/components/marketing/sections/MarketingPageShell';
import HomeBelowFold from '@/components/marketing/HomeBelowFold';
import { marketingMetadata } from '@/lib/seo/metadata';
import { HOME_SHARE_CARD } from '@/lib/seo/share-cards';

export const metadata: Metadata = marketingMetadata({
  path: '/business',
  title: 'Business · SupplierAdvisor®',
  absoluteTitle: true,
  description: 'Run business trade, operations, quality, and finance in one SupplierAdvisor® workspace.',
  image: HOME_SHARE_CARD,
});

export default function BusinessPage() {
  return (
    <MarketingPageShell title="Business" intro="SupplierAdvisor® for operators who run daily trade and fulfilment.">
      <HomeBelowFold
        tourHref="/join"
        demoHref="/join"
        sections={['markets', 'audiences']}
        audienceFilter={['b2b']}
      />
      <Link href="/join" className="inline-flex rounded-full bg-[#00b4d8] px-6 py-3 font-bold text-[#0f172a]">Start free</Link>
    </MarketingPageShell>
  );
}
