import type { Metadata } from 'next';
import HomeLanding from '@/components/marketing/HomeLanding';
import { marketingMetadata } from '@/lib/seo/metadata';
import { HOME_SHARE_CARD } from '@/lib/seo/share-cards';
import { DEFAULT_TITLE } from '@/lib/seo/site';

export const metadata: Metadata = marketingMetadata({
  path: '/',
  title: DEFAULT_TITLE,
  absoluteTitle: true,
  description:
    'SupplierAdvisor® supply-chain OS with a verified trade and trust layer. 30-day trial, then from R299/month.',
  image: HOME_SHARE_CARD,
});

export default function LandingPage() {
  return <HomeLanding />;
}
