import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import LandingNav from '@/components/marketing/LandingNav';
import HeroAudienceStage from '@/components/marketing/HeroAudienceStage';
import HomeBelowFoldLazy from '@/components/marketing/HomeBelowFoldLazy';
import SiteFooter from '@/components/marketing/SiteFooter';
import EnglishOnly from '@/components/i18n/EnglishOnly';
import LocaleDataScript from '@/components/i18n/LocaleDataScript';
import { COMPANY_TRIAL_DAYS } from '@/lib/billing/company-subscription';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config';
import { en, format, t, type Dict } from '@/lib/i18n/dict';
import { productTourHref } from '@/lib/preview/product-tour';

export default function HomeLanding({ locale = DEFAULT_LOCALE, dict = en }: { locale?: Locale; dict?: Dict }) {
  return (
    <div className="relative z-0 min-h-dvh bg-sa-bg text-sa-text antialiased selection:bg-cyan-100 dark:selection:bg-cyan-500/30">
      {locale !== DEFAULT_LOCALE ? <LocaleDataScript dict={dict} /> : null}
      <LandingNav />
      <HeroAudienceStage />
      <main>
        <section
          id="book-demo"
          className="border-t border-slate-200 bg-white px-4 py-10 dark:border-neutral-800 dark:bg-neutral-950 sm:px-6 sm:py-14 lg:px-10"
        >
          <div className="mx-auto grid max-w-screen-2xl items-start gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-7">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0077b6]">
                {t(dict, 'brand.supplierAdvisor')}
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900 dark:text-white sm:text-4xl">
                {t(dict, 'home.bookTitle')}
              </h2>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-700 dark:text-neutral-200">
                {t(dict, 'home.bookBody')}
              </p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-neutral-300">
                {t(dict, 'home.proofCue')}
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Link
                  id="guided-tour"
                  href={productTourHref('dashboard', locale)}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#00b4d8] px-6 py-3 text-sm font-bold text-[#0f172a] shadow-sm hover:brightness-95 sm:w-auto"
                >
                  {t(dict, 'home.tourCta')}
                  <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
                </Link>
                <a
                  href="mailto:hello@supplieradvisor.com?subject=Demo%20request%20%E2%80%94%20SupplierAdvisor"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
                >
                  {t(dict, 'home.bookEmail')}
                  <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
                </a>
                <a
                  href="https://wa.me/27825814215?text=Hi%20%E2%80%94%20I%27d%20like%20a%20SupplierAdvisor%20demo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-900 hover:border-[#00b4d8] dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
                >
                  {t(dict, 'home.bookWhatsapp')}
                </a>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-neutral-300">
                {t(dict, 'home.bookSample')}{' '}
                <Link
                  href={productTourHref('dashboard', locale)}
                  className="font-semibold text-[#0077b6] underline decoration-[#0077b6]/40 underline-offset-4"
                >
                  {t(dict, 'home.bookSampleLink')}
                </Link>
                . {t(dict, 'home.bookSampleNote')}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-[#f8fafc] p-6 dark:border-neutral-800 dark:bg-neutral-900 sm:p-8 lg:col-span-5">
              <p className="text-sm font-semibold leading-relaxed text-slate-700 dark:text-neutral-200 sm:text-base">
                {format(t(dict, 'home.trialStrip'), { days: COMPANY_TRIAL_DAYS })}
              </p>
              <div className="mt-5">
                <Link
                  href="/onboarding?lane=b2b"
                  hrefLang="en"
                  className="sa-btn-brand inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold shadow-sm hover:bg-[#22d3ee]"
                >
                  {t(dict, 'home.startTrial')}
                  <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <EnglishOnly locale={locale} dict={dict}>
        <HomeBelowFoldLazy />
      </EnglishOnly>
      {/* Footer stays outside the ssr:false below-fold island so it is in server HTML. */}
      <SiteFooter />
    </div>
  );
}
