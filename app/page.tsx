import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import LandingNav from '@/components/marketing/LandingNav';
import HeroAudienceStage from '@/components/marketing/HeroAudienceStage';
import HomeBelowFoldLazy from '@/components/marketing/HomeBelowFoldLazy';
import { COMPANY_TRIAL_DAYS } from '@/lib/billing/company-subscription';

/**
 * Brief 10 — first HTML is hero + CTA + nav only.
 * Product mocks load in a client island (HomeBelowFoldLazy) with ssr: false.
 */
export default function LandingPage() {
  return (
    <div className="relative z-0 min-h-dvh bg-sa-bg text-sa-text antialiased selection:bg-cyan-100 dark:selection:bg-cyan-500/30">
      <LandingNav />
      <HeroAudienceStage />
      <section className="border-t border-slate-200 bg-white px-4 py-10 sm:px-6 sm:py-12 lg:px-10">
        <div className="mx-auto flex max-w-screen-2xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-center sm:text-left">
          <p className="text-sm font-semibold text-slate-700 sm:text-base">
            {COMPANY_TRIAL_DAYS}-day free trial. Register your company and run
            the first trade loop.
          </p>
          <Link
            href="/onboarding?lane=b2b"
            className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#0096c7]"
          >
            Start free trial
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
      <HomeBelowFoldLazy />
    </div>
  );
}
