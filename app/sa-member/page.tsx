import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingPageShell from '@/components/marketing/sections/MarketingPageShell';
import HomeBelowFold from '@/components/marketing/HomeBelowFold';
import { marketingMetadata } from '@/lib/seo/metadata';
import { HOME_SHARE_CARD } from '@/lib/seo/share-cards';

export const metadata: Metadata = marketingMetadata({
  path: '/sa-member',
  title: 'SA Member · SupplierAdvisor®',
  absoluteTitle: true,
  description: 'Create your free SA Member account for bookings, check-ins, wallet, and proof.',
  image: HOME_SHARE_CARD,
});

export default function SaMemberPage() {
  return (
    <MarketingPageShell title="SA Member" intro="One free member account for connected services on SupplierAdvisor®.">
      <HomeBelowFold
        tourHref="/join"
        demoHref="/join"
        sections={['markets', 'member-app', 'audiences']}
        audienceFilter={['b2c']}
      />
      <Link href="/me" className="inline-flex rounded-full bg-[#00b4d8] px-6 py-3 font-bold text-[#0f172a]">Create free SA Member account</Link>
    </MarketingPageShell>
  );
}
