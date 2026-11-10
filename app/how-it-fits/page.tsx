import type { Metadata } from 'next';
import MarketingPageShell from '@/components/marketing/sections/MarketingPageShell';
import HowItFitsSections from '@/components/marketing/sections/HowItFitsSections';
import { marketingMetadata } from '@/lib/seo/metadata';
import { HOME_SHARE_CARD } from '@/lib/seo/share-cards';

export const metadata: Metadata = marketingMetadata({
  path: '/how-it-fits',
  title: 'How it fits · SupplierAdvisor®',
  absoluteTitle: true,
  description: 'See how SupplierAdvisor® packaging and rollout steps fit your operating model.',
  image: HOME_SHARE_CARD,
});

export default function HowItFitsPage() {
  return (
    <MarketingPageShell title="How it fits" intro="Package SupplierAdvisor® around your current operation, then go live with confidence.">
      <HowItFitsSections />
    </MarketingPageShell>
  );
}
