import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import LandingNav from '@/components/marketing/LandingNav';
import HeroAudienceStage from '@/components/marketing/HeroAudienceStage';
import HomeBelowFoldLazy from '@/components/marketing/HomeBelowFoldLazy';
import EnglishOnly from '@/components/i18n/EnglishOnly';
import LocaleDataScript from '@/components/i18n/LocaleDataScript';
import { COMPANY_TRIAL_DAYS } from '@/lib/billing/company-subscription';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config';
import { en, format, t, type Dict } from '@/lib/i18n/dict';

export default function HomeLanding({ locale = DEFAULT_LOCALE, dict = en }: { locale?: Locale; dict?: Dict }) {
  return (
    <div className="relative z-0 min-h-dvh bg-sa-bg text-sa-text antialiased selection:bg-cyan-100 dark:selection:bg-cyan-500/30">
      {locale !== DEFAULT_LOCALE ? <LocaleDataScript dict={dict} /> : null}
      <LandingNav />
      <HeroAudienceStage />
      <main>
        <section className="border-t border-slate-200 bg-white px-4 py-10 sm:px-6 sm:py-12 lg:px-10">
          <div className="mx-auto flex max-w-screen-2xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-center sm:text-left">
            <p className="text-sm font-semibold text-slate-700 sm:text-base">
              {format(t(dict, 'home.trialStrip'), { days: COMPANY_TRIAL_DAYS })}
            </p>
            <Link
              href="/onboarding?lane=b2b"
              hrefLang="en"
              className="sa-btn-brand inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold shadow-sm hover:bg-[#22d3ee]"
            >
              {t(dict, 'home.startTrial')}
              <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
            </Link>
          </div>
        </section>
      </main>
      <EnglishOnly locale={locale} dict={dict}>
        <HomeBelowFoldLazy />
      </EnglishOnly>
    </div>
  );
}
