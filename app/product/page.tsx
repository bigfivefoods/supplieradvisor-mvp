import type { Metadata } from 'next';
import MarketingPageShell from '@/components/marketing/sections/MarketingPageShell';
import ProductPageSections from '@/components/marketing/sections/ProductPageSections';
import { productTourHref } from '@/lib/preview/product-tour';
import { fixturePublicHref } from '@/lib/preview/production-gate';
import { marketingMetadata } from '@/lib/seo/metadata';
import { HOME_SHARE_CARD } from '@/lib/seo/share-cards';

export const metadata: Metadata = marketingMetadata({
  path: '/product',
  title: 'Product · SupplierAdvisor®',
  absoluteTitle: true,
  description: 'See SupplierAdvisor® product workflows across trade, systems, and Advisor modules.',
  image: HOME_SHARE_CARD,
});

export default function ProductPage() {
  const tourHref = fixturePublicHref(productTourHref('dashboard', 'en'));
  return (
    <MarketingPageShell title="Product" intro="Explore the product story and how SupplierAdvisor® runs connected operations.">
      <ProductPageSections tourHref={tourHref} />
    </MarketingPageShell>
  );
}
