import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import LandingNav from '@/components/marketing/LandingNav';
import {
  getIndustry,
  industrySlugs,
  relatedIndustries,
} from '@/lib/marketing/industries';
import SiteFooter from '@/components/marketing/SiteFooter';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
} from '@/lib/billing/company-subscription';
import { INDUSTRY_PACK_MONTHLY_ZAR } from '@/lib/product/packaging-constants';
import { industryJsonLd, jsonLdString } from '@/lib/seo/jsonld';
import { marketingMetadata } from '@/lib/seo/metadata';
import { industryShareCard } from '@/lib/seo/share-cards';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return industrySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ind = getIndustry(slug);
  if (!ind) return { title: 'Industry' };
  return {
    ...marketingMetadata({
      path: `/industries/${ind.slug}`,
      title: ind.name,
      description: ind.metaDescription || ind.subhead,
      image: industryShareCard(ind),
    }),
    title: ind.name,
  };
}

export default async function IndustryDetailPage({ params }: Props) {
  const { slug } = await params;
  const ind = getIndustry(slug);
  if (!ind) notFound();

  const related = relatedIndustries(ind.slug);
  const showPackPrice = Boolean(ind.pack) && ind.slug !== 'public-sector';

  return (
    <div className="min-h-dvh bg-[#f8fafc] text-slate-900">
      <LandingNav />
      <main className="mx-auto max-w-screen-2xl px-4 py-14 sm:px-6 lg:px-10">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
          <Link href="/" className="font-semibold text-[#0077b6] hover:underline">
            Home
          </Link>
          <span aria-hidden="true"> / </span>
          <Link href="/industries" className="font-semibold text-[#0077b6] hover:underline">
            Industries
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-slate-700">{ind.name}</span>
        </nav>
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00b4d8]">
          {ind.pack ? `${ind.pack} · ${ind.name}` : ind.name}
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
          {ind.headline}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
          {ind.subhead}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/onboarding?type=business"
            className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-6 py-3 text-sm font-bold text-white hover:bg-[#0099b8]"
          >
            Start {COMPANY_TRIAL_DAYS}-day free trial{' '}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-800"
          >
            Interactive demo
          </Link>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-rose-100 bg-white p-6 sm:p-8">
            <h2 className="text-lg font-black text-slate-900">
              What gets in the way for {ind.name}?
            </h2>
            <ul className="mt-4 space-y-3">
              {ind.pains.map((p) => (
                <li key={p} className="flex gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-emerald-100 bg-white p-6 sm:p-8">
            <h2 className="text-lg font-black text-slate-900">
              What does SupplierAdvisor® change for {ind.name}?
            </h2>
            <ul className="mt-4 space-y-3">
              {ind.wins.map((w) => (
                <li key={w} className="flex gap-2 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-black text-slate-900">
            Which modules are named for {ind.name}?
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {ind.modules.map((m) => (
              <span
                key={m}
                className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-900"
              >
                {m}
              </span>
            ))}
          </div>
          <p className="mt-6 text-sm text-slate-500">
            {COMPANY_TRIAL_DAYS}-day trial, then from R
            {COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month. Unlimited team seats per
            company. Enable only the packs you need from Company → Modules.
          </p>
          {showPackPrice ? (
            <p className="mt-2 text-sm text-slate-500">
              {ind.pack} is an industry pack at +R{INDUSTRY_PACK_MONTHLY_ZAR}
              /month on that company plan.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/#modules-industry"
              className="text-sm font-bold text-[#0077b6] hover:underline"
            >
              See Industry modules on the home page →
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-bold text-slate-600 hover:underline"
            >
              Pricing
            </Link>
          </div>
        </div>

        {related.length ? (
          <div className="mt-12">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Related
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {related.map((other) => (
                <Link
                  key={other.slug}
                  href={`/industries/${other.slug}`}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#00b4d8]"
                >
                  {other.name}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(industryJsonLd(ind)) }}
      />
    </div>
  );
}
