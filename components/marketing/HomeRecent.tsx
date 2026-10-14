'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLocaleDictionary } from '@/components/i18n/LocaleDictionaryProvider';
import { localizedPath } from '@/lib/i18n/config';
import { format } from '@/lib/i18n/dict';
import { productTourHref } from '@/lib/preview/product-tour';
import {
  CORE_OS_MONTHLY_ZAR,
  INDUSTRY_PACK_MONTHLY_ZAR,
} from '@/lib/product/packaging-constants';

const PACKS: Array<{ name: string; href: string; fresh?: boolean }> = [
  { name: 'CropAdvisor®', href: '/industries/agriculture' },
  { name: 'QuarryAdvisor®', href: '/industries/quarry-aggregates' },
  { name: 'ApparelAdvisor®', href: '/industries/apparel-clothing' },
  { name: 'ConstructionAdvisor®', href: '/industries/construction-building' },
  { name: 'TradeAdvisor®', href: '/industries/trades', fresh: true },
  { name: 'GymAdvisor®', href: '/industries/fitness-gyms' },
  { name: 'PhysioAdvisor®', href: '/industries/physio-allied-health' },
  { name: 'DentalAdvisor®', href: '/industries/dental' },
  { name: 'PsychiatryAdvisor®', href: '/industries/mental-health' },
  { name: 'MedicalAdvisor®', href: '/industries/medical-practices' },
  { name: 'VetAdvisor®', href: '/industries/veterinary-practices' },
  { name: 'HireAdvisor®', href: '/industries/hire-rental' },
  { name: 'RetailAdvisor®', href: '/industries/retail-shop' },
  { name: 'ContainerAdvisor®', href: '/industries/containers' },
];

const HIGHLIGHTS: Array<{
  title: 'home.new.trade.title' | 'home.new.checklist.title' | 'home.new.tour.title' | 'home.new.gym.title' | 'home.new.industries.title' | 'home.new.verify.title';
  body: 'home.new.trade.body' | 'home.new.checklist.body' | 'home.new.tour.body' | 'home.new.gym.body' | 'home.new.industries.body' | 'home.new.verify.body';
  href: string | null;
  fresh?: boolean;
  english?: boolean;
}> = [
  {
    title: 'home.new.trade.title',
    body: 'home.new.trade.body',
    href: '/industries/trades',
    fresh: true,
    english: true,
  },
  {
    title: 'home.new.checklist.title',
    body: 'home.new.checklist.body',
    href: '/onboarding?lane=b2b',
    fresh: true,
    english: true,
  },
  {
    title: 'home.new.tour.title',
    body: 'home.new.tour.body',
    href: null,
    fresh: true,
  },
  {
    title: 'home.new.gym.title',
    body: 'home.new.gym.body',
    href: '/industries/fitness-gyms',
    english: true,
  },
  {
    title: 'home.new.industries.title',
    body: 'home.new.industries.body',
    href: '/industries',
    english: true,
  },
  {
    title: 'home.new.verify.title',
    body: 'home.new.verify.body',
    href: '#trust',
  },
];

const TRADE_POINTS = [
  'home.trade.point1',
  'home.trade.point2',
  'home.trade.point3',
  'home.trade.point4',
  'home.trade.point5',
] as const;

/**
 * Below-fold showcase. Loaded with ssr:false from HomeBelowFoldLazy so it
 * stays out of the first HTML and the hero bundle.
 */
export default function HomeRecent() {
  const { locale, t } = useLocaleDictionary();
  const prices = { core: CORE_OS_MONTHLY_ZAR, pack: INDUSTRY_PACK_MONTHLY_ZAR };
  const tourHref = productTourHref('dashboard', locale);

  return (
    <>
      <section
        id="whats-new"
        className="border-t border-slate-200 bg-white px-4 py-16 dark:border-neutral-800 dark:bg-neutral-950 sm:px-6 sm:py-20 lg:px-10"
      >
        <div className="mx-auto max-w-screen-2xl">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00b4d8]">
              {t('home.new.kicker')}
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-900 dark:text-white sm:text-5xl">
              {t('home.new.title')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-neutral-300 sm:text-lg">
              {t('home.new.body')}
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HIGHLIGHTS.map((item) => {
              const href = item.href ?? tourHref;
              return (
                <li key={item.title}>
                  <Link
                    href={href}
                    hrefLang={item.english ? 'en' : undefined}
                    prefetch={false}
                    className="group flex h-full flex-col rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-sky-50/40 p-6 shadow-sm transition-colors hover:border-[#00b4d8]/45 dark:border-neutral-800 dark:from-neutral-950 dark:to-neutral-900"
                  >
                    {item.fresh ? (
                      <span className="mb-3 inline-flex w-fit rounded-full bg-[#00b4d8] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#0f172a]">
                        {t('home.new.badge')}
                      </span>
                    ) : (
                      <span className="mb-3 inline-flex w-fit rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:border-neutral-700 dark:text-neutral-400">
                        {t('home.new.onPlatform')}
                      </span>
                    )}
                    <h3 className="text-lg font-black text-slate-900 group-hover:text-[#0077b6] dark:text-white">
                      {t(item.title)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-neutral-300">
                      {t(item.body)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section
        id="industry-packs"
        className="border-t border-slate-200 bg-[#f8fafc] px-4 py-16 dark:border-neutral-800 dark:bg-black sm:px-6 sm:py-20 lg:px-10"
      >
        <div className="mx-auto max-w-screen-2xl">
          <div className="mx-auto mb-8 max-w-3xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00b4d8]">
              {t('home.packs.kicker')}
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-900 dark:text-white sm:text-5xl">
              {t('pricing.packsTitle')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-neutral-300 sm:text-lg">
              {t('pricing.packsBody')}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <Link
              href="/onboarding?lane=b2b"
              hrefLang="en"
              prefetch={false}
              className="flex shrink-0 flex-col justify-center rounded-3xl bg-[#00b4d8] px-6 py-5 text-[#0f172a] sm:w-56"
            >
              <span className="text-[10px] font-black uppercase tracking-widest">
                {t('home.packs.coreNote')}
              </span>
              <span className="mt-1 text-xl font-black">{t('home.packs.coreLabel')}</span>
              <span className="mt-1 text-sm font-bold">
                {format(t('home.packs.corePrice'), prices)}
              </span>
            </Link>
            <div className="min-w-0 flex-1 rounded-3xl border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950 sm:p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-neutral-400">
                {format(t('home.packs.addon'), prices)}
              </p>
              <ul className="flex gap-2 overflow-x-auto pb-1">
                {PACKS.map((pack) => (
                  <li key={pack.href} className="shrink-0">
                    <Link
                      href={pack.href}
                      hrefLang="en"
                      prefetch={false}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold ${
                        pack.fresh
                          ? 'border-[#00b4d8] bg-sky-50 text-slate-950 dark:bg-cyan-500/10 dark:text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-[#00b4d8] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'
                      }`}
                    >
                      {pack.fresh ? (
                        <span className="rounded-full bg-[#00b4d8] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#0f172a]">
                          {t('home.new.badge')}
                        </span>
                      ) : null}
                      {pack.name}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-neutral-300">
                {t('home.packs.specialist')}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={localizedPath(locale, '/pricing')}
              prefetch={false}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#00b4d8] px-6 py-3 text-sm font-bold text-[#0f172a] hover:brightness-95"
            >
              {t('home.packs.pricing')}
            </Link>
            <Link
              href="/industries"
              hrefLang="en"
              prefetch={false}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-900 hover:border-[#00b4d8] dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
            >
              {t('home.packs.industries')}
            </Link>
          </div>
        </div>
      </section>

      <section
        id="tradeadvisor"
        className="border-t border-slate-200 bg-white px-4 py-16 dark:border-neutral-800 dark:bg-neutral-950 sm:px-6 sm:py-20 lg:px-10"
      >
        <div className="mx-auto grid max-w-screen-2xl items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00b4d8]">
              {t('home.trade.kicker')}
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-900 dark:text-white sm:text-5xl">
              {t('home.trade.title')}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-neutral-300 sm:text-lg">
              {t('home.trade.body')}
            </p>
            <p className="mt-3 text-sm font-bold text-[#0077b6] dark:text-[#00b4d8]">
              {format(t('home.trade.price'), prices)}
            </p>
            <ul className="mt-6 space-y-2.5">
              {TRADE_POINTS.map((key) => (
                <li key={key} className="flex gap-2 text-sm leading-relaxed text-slate-700 dark:text-neutral-200">
                  <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#00b4d8]" />
                  {t(key)}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/industries/trades"
                hrefLang="en"
                prefetch={false}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#00b4d8] px-6 py-3 text-sm font-bold text-[#0f172a] hover:brightness-95"
              >
                {t('home.trade.explore')}
              </Link>
              <Link
                href="/customer/tradegraph/demo"
                hrefLang="en"
                prefetch={false}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-900 hover:border-[#00b4d8] dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
              >
                {t('home.trade.demo')}
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/70 dark:border-neutral-800 dark:shadow-none">
              <Image
                src="/marketing/trade-customer-app.webp"
                alt={t('home.trade.imageAlt')}
                width={780}
                height={1688}
                sizes="390px"
                quality={60}
                loading="lazy"
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
