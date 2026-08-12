import Link from 'next/link';
import type { Metadata } from 'next';
import LandingNav from '@/components/marketing/LandingNav';
import { INDUSTRIES } from '@/lib/marketing/industries';
import { ArrowRight } from 'lucide-react';
import { SA_OG_IMAGE_URL } from '@/lib/brand/assets';
import { INDUSTRY_PACK_MONTHLY_ZAR } from '@/lib/product/architecture';

export const metadata: Metadata = {
  title: 'Industries — supply chain & services OS by sector',
  description:
    'SupplierAdvisor® for food & beverage, agriculture (CropAdvisor®), quarry (QuarryAdvisor®), manufacturing, distribution, fitness (GymAdvisor® rooms · waitlist · marketplace), physio, dental, mental health and medical practices (exclusive diaries, treatment plans, waitlist desks), public sector, and multi-entity groups.',
  keywords: [
    'supply chain by industry',
    'CropAdvisor',
    'QuarryAdvisor',
    'GymAdvisor',
    'PhysioAdvisor',
    'DentalAdvisor',
    'MedicalAdvisor',
    'food beverage ERP',
    'agriculture supply chain',
    'gym management software',
    'clinic practice software',
    'public sector procurement',
    'SupplierAdvisor industries',
  ],
  openGraph: {
    title: 'Industries · SupplierAdvisor®',
    description:
      'Sector-ready depth on one OS — agri, extractives, manufacturing, logistics, gyms and clinics (waitlist, rooms, treatment plans, marketplace), public programmes, multi-entity.',
    url: 'https://www.supplieradvisor.com/industries',
    type: 'website',
    images: [{ url: SA_OG_IMAGE_URL, width: 1200, height: 630 }],
  },
  alternates: { canonical: 'https://www.supplieradvisor.com/industries' },
  robots: { index: true, follow: true },
};

const PRIMARY = INDUSTRIES.filter((i) =>
  ['agriculture', 'quarry-aggregates', 'food-beverage'].includes(i.slug)
);
const MAKE_MOVE = INDUSTRIES.filter((i) =>
  ['manufacturing', 'distribution'].includes(i.slug)
);
const SERVICES = INDUSTRIES.filter((i) =>
  [
    'fitness-gyms',
    'physio-allied-health',
    'dental',
    'mental-health',
    'medical-practices',
  ].includes(i.slug)
);
const ORG = INDUSTRIES.filter((i) =>
  ['public-sector', 'multi-entity'].includes(i.slug)
);

function IndustryCard({
  ind,
}: {
  ind: (typeof INDUSTRIES)[number];
}) {
  return (
    <Link
      href={`/industries/${ind.slug}`}
      className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-[#00b4d8]/40 hover:shadow-md"
    >
      {ind.pack ? (
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#00b4d8]">
          {ind.pack}
        </p>
      ) : null}
      <h2 className="text-xl font-black text-slate-900 group-hover:text-[#0077b6]">
        {ind.name}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 line-clamp-3">
        {ind.cardBlurb || ind.subhead}
      </p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#00b4d8]">
        Explore <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Section({
  title,
  blurb,
  items,
}: {
  title: string;
  blurb: string;
  items: typeof INDUSTRIES;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-14">
      <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">{blurb}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((ind) => (
          <IndustryCard key={ind.slug} ind={ind} />
        ))}
      </div>
    </section>
  );
}

export default function IndustriesIndexPage() {
  return (
    <div className="min-h-dvh bg-[#f8fafc] text-slate-900">
      <LandingNav />
      <main className="mx-auto max-w-screen-2xl px-4 py-16 sm:px-6 lg:px-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00b4d8]">
          Industries
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
          Sector-ready depth on one OS
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          Same verified network and Core modules — plus Industry Advisors for
          agri, extractives, gyms, and clinics: exclusive diaries & rooms,
          waitlist desks, treatment-plan book next, portals, marketplace
          listings, and in-app care messages. SA bills the company
          subscription — practice fees stay yours.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Industry packs from +R{INDUSTRY_PACK_MONTHLY_ZAR}/mo each · Core OS
          always included.
        </p>

        <Section
          title="Primary & food"
          blurb="Produce and protect — CropAdvisor®, QuarryAdvisor®, and food & beverage lots."
          items={PRIMARY}
        />
        <Section
          title="Make & move"
          blurb="Secondary manufacturing and logistics towers on the same fabric."
          items={MAKE_MOVE}
        />
        <Section
          title="Services · fitness & clinical"
          blurb="GymAdvisor® gyms and Physio · Dental · Psychiatry · Medical — rooms, waitlist desks, treatment plans, marketplace listings."
          items={SERVICES}
        />
        <Section
          title="Public & multi-entity"
          blurb="B2G programmes (NSNP / Health) and group workspaces with clean walls."
          items={ORG}
        />

        <div className="mt-16 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-center">
          <h2 className="text-xl font-black text-slate-900">
            Not sure which pack fits?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            Start with Core OS, then enable Field, Fit, clinic, or public
            programme modules from Company → Modules when you are ready.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/onboarding?type=business"
              className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-6 py-3 text-sm font-bold text-white hover:bg-[#0099b8]"
            >
              Start free trial <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/#modules-industry"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-800"
            >
              View Industry modules
            </Link>
          </div>
        </div>

        <p className="mt-12 text-center text-sm text-slate-500">
          <Link href="/" className="font-semibold text-[#0077b6] underline">
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
