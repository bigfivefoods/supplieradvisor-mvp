import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingPageShell from '@/components/marketing/sections/MarketingPageShell';
import AudienceDetailSection from '@/components/marketing/sections/AudienceDetailSection';
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
      <AudienceDetailSection
        title="Personal account, no subscription"
        body="Create your SA Member account to book, check in, manage family profiles, and keep payment proof in one place. Use the same identity across gyms, clinics, hire, and retail businesses on SupplierAdvisor®."
        bullets={[
          'Free account creation and login',
          'Bookings and check-ins with shared profile data',
          'Wallet records and payment proof across services',
        ]}
      />
      <Link href="/me" className="inline-flex rounded-full bg-[#00b4d8] px-6 py-3 font-bold text-[#0f172a]">Create free SA Member account</Link>
    </MarketingPageShell>
  );
}
