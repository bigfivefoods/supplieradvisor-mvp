import type { Metadata } from 'next';
import MarketingPageShell from '@/components/marketing/sections/MarketingPageShell';
import TrustPageSections from '@/components/marketing/sections/TrustPageSections';
import { marketingMetadata } from '@/lib/seo/metadata';
import { HOME_SHARE_CARD } from '@/lib/seo/share-cards';

export const metadata: Metadata = marketingMetadata({
  path: '/trust',
  title: 'Trust · SupplierAdvisor®',
  absoluteTitle: true,
  description: 'SupplierAdvisor® trust and security approach for accountable trade and operations.',
  image: HOME_SHARE_CARD,
});

export default function TrustPage() {
  return (
    <MarketingPageShell title="Trust" intro="Verification, accountability, and security are built into every SupplierAdvisor® workflow.">
      <TrustPageSections />
    </MarketingPageShell>
  );
}
