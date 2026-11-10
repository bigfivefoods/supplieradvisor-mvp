import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingPageShell from '@/components/marketing/sections/MarketingPageShell';
import AudienceDetailSection from '@/components/marketing/sections/AudienceDetailSection';
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
      <AudienceDetailSection
        title="Public-sector workflows"
        body="Government teams and suppliers can run procurement and programme workflows with a shared record of delivery. SupplierAdvisor® helps teams publish trust signals and maintain auditable trade records."
        bullets={[
          'Transparent procurement records',
          'Supplier verification and trust signals',
          'Accountable execution trails for programme teams',
        ]}
      />
      <Link href="/join" className="inline-flex rounded-full bg-[#00b4d8] px-6 py-3 font-bold text-[#0f172a]">Start free</Link>
    </MarketingPageShell>
  );
}
