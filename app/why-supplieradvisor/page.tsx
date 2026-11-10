import type { Metadata } from 'next';
import MarketingPageShell from '@/components/marketing/sections/MarketingPageShell';
import WhyPageSections from '@/components/marketing/sections/WhyPageSections';
import { marketingMetadata } from '@/lib/seo/metadata';
import { HOME_SHARE_CARD } from '@/lib/seo/share-cards';

export const metadata: Metadata = marketingMetadata({
  path: '/why-supplieradvisor',
  title: 'Why SupplierAdvisor®',
  absoluteTitle: true,
  description: 'Why teams choose SupplierAdvisor® for verified trade, trust, and execution on one OS.',
  image: HOME_SHARE_CARD,
});

export default function WhySupplierAdvisorPage() {
  return (
    <MarketingPageShell title="Why SupplierAdvisor®" intro="One platform for verified trade, trusted records, and daily execution.">
      <WhyPageSections />
    </MarketingPageShell>
  );
}
