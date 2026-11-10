import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
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

function HomeProofItem({ children }: { children: ReactNode }) {
  return (
    <p className="sa-home-proof-item">
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      {children}
    </p>
  );
}

function HomeAudienceCard({ card }: { card: (typeof AUDIENCES)[number] }) {
  return (
    <article className="sa-home-card">
      <h3 className="sa-home-card-title">{card.title}</h3>
      <p className="sa-home-card-body">{card.body}</p>
      <ul className="sa-home-bullets">
        {card.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00b4d8]" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      <Link href={card.href} className="sa-home-link">
        {card.cta}
      </Link>
    </article>
  );
}

function HomeModuleTile({ tile }: { tile: (typeof MODULE_TILES)[number] }) {
  return (
    <article className="sa-home-module">
      <h3 className="sa-home-module-title">{tile.title}</h3>
      <p className="sa-home-module-body">{tile.body}</p>
    </article>
  );
}

export default function HomeLanding({ locale = DEFAULT_LOCALE, dict = en }: { locale?: Locale; dict?: Dict }) {
  const demoHref = interactiveDemoHref();
  const tourHref = fixturePublicHref(productTourHref('dashboard', locale));

  return (
    <div className="relative z-0 min-h-dvh bg-sa-bg text-sa-text antialiased selection:bg-cyan-100 dark:selection:bg-cyan-500/30">
      {locale !== DEFAULT_LOCALE ? <LocaleDataScript dict={dict} /> : null}
      <LandingNav demoHref={demoHref} />
      <HeroAudienceStage />
      <main>
        <section className="sa-home-sec sa-home-sec-white sa-home-sec-tight">
          <div className="sa-home-wrap sa-home-proof">
            <div className="sa-home-proof-grid">
              <HomeProofItem>30-day free trial</HomeProofItem>
              <HomeProofItem>Verified trade and trust layer</HomeProofItem>
              <HomeProofItem>Published pricing from R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month</HomeProofItem>
              <HomeProofItem>South African built</HomeProofItem>
            </div>
          </div>
        </section>

        <section className="sa-home-sec sa-home-sec-muted">
          <div className="sa-home-wrap">
            <h2 className="sa-home-h2">Choose your path</h2>
            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              {AUDIENCES.map((card) => (
                <HomeAudienceCard key={card.href} card={card} />
              ))}
            </div>
          </div>
        </section>

        <section className="sa-home-sec sa-home-sec-white">
          <div className="sa-home-wrap">
            <h2 className="sa-home-h2">Module structure</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {MODULE_TILES.map((tile) => (
                <HomeModuleTile key={tile.title} tile={tile} />
              ))}
            </div>
            <Link href="/modules" className="sa-home-link">
              See all modules
            </Link>
          </div>
        </section>

        <section id="book-demo" className="sa-home-sec sa-home-sec-muted">
          <div className="sa-home-wrap sa-home-cta">
            <h2 className="sa-home-h2">Start on SupplierAdvisor®</h2>
            <p className="mt-3 text-sm text-slate-600">
              {format(t(dict, 'home.trialStrip'), { days: COMPANY_TRIAL_DAYS })} From R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/join" className="sa-home-btn">Start free</Link>
              <Link href="/me" className="sa-home-btn-ghost">Create free SA Member account</Link>
              <Link href="/login" className="sa-home-btn-ghost">Log in</Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
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
