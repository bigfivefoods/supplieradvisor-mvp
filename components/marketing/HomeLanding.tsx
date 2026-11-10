import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import LandingNav from '@/components/marketing/LandingNav';
import HeroAudienceStage from '@/components/marketing/HeroAudienceStage';
import SiteFooter from '@/components/marketing/SiteFooter';
import LocaleDataScript from '@/components/i18n/LocaleDataScript';
import { COMPANY_SUBSCRIPTION_MONTHLY_ZAR, COMPANY_TRIAL_DAYS } from '@/lib/billing/company-subscription';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config';
import { en, format, t, type Dict } from '@/lib/i18n/dict';
import { productTourHref } from '@/lib/preview/product-tour';
import { fixturePublicHref, interactiveDemoHref } from '@/lib/preview/production-gate';

const AUDIENCES = [
  {
    title: 'Business',
    body: 'Run buying, selling, inventory, operations, quality, and finance in one workspace. SupplierAdvisor® links teams and counterparties on one operating model.',
    bullets: ['Verified company graph and trust layer', 'Shared process data across trade and operations', 'Built for operator execution'],
    href: '/business',
    cta: 'Explore business',
  },
  {
    title: 'Consumer, SA Member',
    body: 'Create one free SA Member account for bookings, check-ins, family profiles, and payment proof. Use one identity across SupplierAdvisor® service businesses.',
    bullets: ['Free personal account', 'One login across connected businesses', 'Book and pay with proof'],
    href: '/sa-member',
    cta: 'Explore SA Member',
  },
  {
    title: 'Government',
    body: 'Support public procurement and programme delivery with traceable workflows and verified suppliers. Keep accountable records for each stage of fulfilment.',
    bullets: ['Transparent procurement and scoring records', 'Audit-ready workflows for public programmes', 'Shared execution view for departments and suppliers'],
    href: '/government',
    cta: 'Explore government',
  },
] as const;

const MODULE_TILES = [
  { title: 'Core OS', body: 'Trade, operations, quality, and finance in one company workspace.' },
  { title: 'Sector', body: 'Operational layers for how you make, move, and fulfil work.' },
  { title: 'Industry', body: 'Advisor packs for specific vertical workflows and standards.' },
  { title: 'Bespoke', body: 'Specialist module combinations for unique operating requirements.' },
] as const;

export default function HomeLanding({ locale = DEFAULT_LOCALE, dict = en }: { locale?: Locale; dict?: Dict }) {
  const demoHref = interactiveDemoHref();
  const tourHref = fixturePublicHref(productTourHref('dashboard', locale));

  return (
    <div className="relative z-0 min-h-dvh bg-sa-bg text-sa-text antialiased selection:bg-cyan-100 dark:selection:bg-cyan-500/30">
      {locale !== DEFAULT_LOCALE ? <LocaleDataScript dict={dict} /> : null}
      <LandingNav demoHref={demoHref} />
      <HeroAudienceStage />
      <main>
        <section className="border-t border-slate-200 bg-white px-4 py-6 dark:border-neutral-800 dark:bg-neutral-950 sm:px-6 sm:py-8 lg:px-10">
          <div className="mx-auto max-w-screen-2xl rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-neutral-700 dark:bg-neutral-900 sm:px-6">
            <div className="grid gap-3 text-sm font-semibold text-slate-700 dark:text-neutral-200 sm:grid-cols-2 lg:grid-cols-4">
              <p className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" />30-day free trial</p>
              <p className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Verified trade and trust layer</p>
              <p className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Published pricing from R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month</p>
              <p className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" />South African built</p>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-[#f8fafc] px-4 py-12 dark:border-neutral-800 dark:bg-black sm:px-6 sm:py-14 lg:px-10">
          <div className="mx-auto max-w-screen-2xl">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">Choose your path</h2>
            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              {AUDIENCES.map((card) => (
                <article key={card.href} className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">{card.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-neutral-300">{card.body}</p>
                  <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-neutral-200">
                    {card.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2">
                        <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00b4d8]" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={card.href} className="mt-5 inline-flex font-semibold text-[#0077b6] underline underline-offset-4">
                    {card.cta}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-white px-4 py-12 dark:border-neutral-800 dark:bg-neutral-950 sm:px-6 sm:py-14 lg:px-10">
          <div className="mx-auto max-w-screen-2xl">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">Module structure</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {MODULE_TILES.map((tile) => (
                <article key={tile.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-neutral-700 dark:bg-neutral-900">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{tile.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-neutral-300">{tile.body}</p>
                </article>
              ))}
            </div>
            <Link href="/modules" className="mt-5 inline-flex font-semibold text-[#0077b6] underline underline-offset-4">
              See all modules
            </Link>
          </div>
        </section>

        <section id="book-demo" className="border-t border-slate-200 bg-[#f8fafc] px-4 py-12 dark:border-neutral-800 dark:bg-black sm:px-6 sm:py-14 lg:px-10">
          <div className="mx-auto max-w-screen-2xl rounded-3xl border border-slate-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950 sm:p-8">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">Start on SupplierAdvisor®</h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-neutral-300">
              {format(t(dict, 'home.trialStrip'), { days: COMPANY_TRIAL_DAYS })} From R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/join" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#00b4d8] px-6 py-3 text-sm font-bold text-[#0f172a] hover:brightness-95">Start free</Link>
              <Link href="/me" className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white">Create free SA Member account</Link>
              <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white">Log in</Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-neutral-300">
              <Link id="guided-tour" href={tourHref} className="underline underline-offset-4">Guided tour</Link>
              <a href="mailto:hello@supplieradvisor.com?subject=Demo%20request%20SupplierAdvisor" className="underline underline-offset-4">Email demo</a>
              <a href="https://wa.me/27825814215?text=Hi%20I%20would%20like%20a%20SupplierAdvisor%20demo" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">WhatsApp demo</a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter demoHref={demoHref} />
    </div>
  );
}
