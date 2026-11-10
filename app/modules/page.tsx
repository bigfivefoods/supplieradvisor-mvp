import type { Metadata } from 'next';
import MarketingPageShell from '@/components/marketing/sections/MarketingPageShell';
import ModulesPageSections from '@/components/marketing/sections/ModulesPageSections';
import { marketingMetadata } from '@/lib/seo/metadata';
import { HOME_SHARE_CARD } from '@/lib/seo/share-cards';

export const metadata: Metadata = marketingMetadata({
  path: '/modules',
  title: 'Modules · SupplierAdvisor®',
  absoluteTitle: true,
  description: 'Explore Core OS, Sector, Industry, and Bespoke module bands on SupplierAdvisor®.',
  image: HOME_SHARE_CARD,
});

export default function ModulesPage() {
  return (
    <MarketingPageShell title="Modules" intro="Build your workspace from Core OS through sector and industry depth.">
      <ModulesPageSections />
    </MarketingPageShell>
  );
}
