import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingPageShell from '@/components/marketing/sections/MarketingPageShell';
import HomeBelowFold from '@/components/marketing/HomeBelowFold';
import { marketingMetadata } from '@/lib/seo/metadata';
import { HOME_SHARE_CARD } from '@/lib/seo/share-cards';

export const metadata: Metadata = marketingMetadata({
  path: '/government',
  title: 'Government · SupplierAdvisor®',
  absoluteTitle: true,
  description: 'SupplierAdvisor® for transparent public procurement and accountable programme execution.',
  image: HOME_SHARE_CARD,
});

export default function GovernmentPage() {
  return (
    <MarketingPageShell title="Government" intro="Support public programmes with transparent procurement and traceable execution.">
      <HomeBelowFold
        tourHref="/join"
        demoHref="/join"
        sections={['markets', 'audiences']}
        audienceFilter={['b2g']}
      />
      <Link href="/join" className="inline-flex rounded-full bg-[#00b4d8] px-6 py-3 font-bold text-[#0f172a]">Start free</Link>
    </MarketingPageShell>
  );
}
