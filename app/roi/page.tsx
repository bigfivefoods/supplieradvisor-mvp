import type { Metadata } from 'next';
import MarketingPageShell from '@/components/marketing/sections/MarketingPageShell';
import RoiCalculator from '@/components/marketing/RoiCalculator';
import { COMPANY_SUBSCRIPTION_MONTHLY_ZAR } from '@/lib/billing/company-subscription';
import { marketingMetadata } from '@/lib/seo/metadata';
import { HOME_SHARE_CARD } from '@/lib/seo/share-cards';

export const metadata: Metadata = marketingMetadata({
  path: '/roi',
  title: 'ROI calculator · SupplierAdvisor®',
  absoluteTitle: true,
  description: 'Estimate SupplierAdvisor® ROI from reclaimed labour and tool savings assumptions.',
  image: HOME_SHARE_CARD,
});

export default function RoiPage() {
  return (
    <MarketingPageShell title="ROI calculator" intro="Estimate value from reclaimed labour and reduced tool sprawl.">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-black text-slate-900">How we calculate</h2>
        <ul className="mt-4 space-y-2 text-slate-700">
          <li>We assume SupplierAdvisor® can reclaim 65% of weekly rework labour time.</li>
          <li>We assume consolidating tools can save 55% of monthly tool spend.</li>
          <li>We subtract the SupplierAdvisor® company plan from R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month.</li>
        </ul>
      </section>
      <div className="-mt-6 sm:-mt-8">
        <RoiCalculator heading={false} reserveResultHeight startHref="/join" />
      </div>
    </MarketingPageShell>
  );
}
