import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingPageShell from '@/components/marketing/sections/MarketingPageShell';
import AudienceDetailSection from '@/components/marketing/sections/AudienceDetailSection';
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
      <AudienceDetailSection
        title="Run one operating system"
        body="Business teams use SupplierAdvisor® to connect procurement, inventory, operations, quality, and finance workflows. Keep every trade relationship on a verified trust layer with clear accountability."
        bullets={[
          'Cross-team execution in one workspace',
          'Verified suppliers and counterparties',
          'Shared records across trade and operational processes',
        ]}
      />
      <Link href="/join" className="inline-flex rounded-full bg-[#00b4d8] px-6 py-3 font-bold text-[#0f172a]">Start free</Link>
    </MarketingPageShell>
  );
}
