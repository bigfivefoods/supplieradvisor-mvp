import Link from 'next/link';
import type { Metadata } from 'next';
import LandingNav from '@/components/marketing/LandingNav';
import { INDUSTRIES } from '@/lib/marketing/industries';
import { ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Industries — supply chain OS by sector',
  description:
    'SupplierAdvisor® for food & beverage, agriculture, manufacturing, distribution, public sector, and multi-entity groups. Sector-ready workflows on one verified network.',
  keywords: [
    'supply chain by industry',
    'food beverage ERP',
    'agriculture supply chain',
    'manufacturing software',
    'distribution software',
    'public sector procurement',
    'SupplierAdvisor industries',
  ],
  openGraph: {
    title: 'Industries · SupplierAdvisor®',
    description:
      'Sector-ready depth on one OS — food, ag, manufacturing, distribution, public sector, multi-entity.',
    url: 'https://www.supplieradvisor.com/industries',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  alternates: { canonical: 'https://www.supplieradvisor.com/industries' },
  robots: { index: true, follow: true },
};

export default function IndustriesIndexPage() {
  return (
    <div className="min-h-dvh bg-[#f8fafc] text-slate-900">
      <LandingNav />
      <main className="mx-auto max-w-screen-2xl px-4 py-16 sm:px-6 lg:px-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00b4d8]">
          Industries
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">
          Sector-ready depth on one OS
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          Same verified network and modules — messaging and workflows tuned for
          how you buy, make, ship, and prove.
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((ind) => (
            <Link
              key={ind.slug}
              href={`/industries/${ind.slug}`}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-[#00b4d8]/40 hover:shadow-md"
            >
              <h2 className="text-xl font-black text-slate-900">{ind.name}</h2>
              <p className="mt-2 text-sm text-slate-600 line-clamp-3">
                {ind.subhead}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#00b4d8]">
                Explore <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
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
