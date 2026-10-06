'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowRight, CheckCircle2, Layers, Users2 } from 'lucide-react';
import { COMPANY_TRIAL_DAYS } from '@/lib/billing/company-subscription';

const ProductVideo = dynamic(() => import('@/components/marketing/ProductVideo'), {
  ssr: false,
});
const HomePricing = dynamic(() => import('@/components/marketing/HomePricing'), {
  ssr: false,
});
const ComparePlatforms = dynamic(
  () => import('@/components/marketing/ComparePlatforms'),
  { ssr: false }
);
const RoiCalculator = dynamic(() => import('@/components/marketing/RoiCalculator'), {
  ssr: false,
});
const SecurityStrip = dynamic(() => import('@/components/marketing/SecurityStrip'), {
  ssr: false,
});

const CORE_MODULES = [
  {
    name: 'Operations',
    body: 'Plan and execute purchasing, receiving, and fulfilment from one chain of proof.',
  },
  {
    name: 'Inventory',
    body: 'Track lots, holds, availability, and movement with the same IDs finance closes on.',
  },
  {
    name: 'CRM & SRM',
    body: 'Manage customer and supplier relationships with scorecards linked to transactions.',
  },
] as const;

const INDUSTRY_LINKS = [
  { href: '/industries/fitness-gyms', label: 'GymAdvisor®' },
  { href: '/industries/medical-practices', label: 'Medical practices' },
  { href: '/industries/hire-rental', label: 'HireAdvisor®' },
  { href: '/industries/retail-shop', label: 'RetailAdvisor®' },
] as const;

export default function HomeBelowFold() {
  return (
    <>
      <section id="video" className="sa-anchor border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-screen-2xl px-4 py-12 sm:px-6 lg:px-10">
          <ProductVideo />
        </div>
      </section>

      <section id="why-join" className="sa-anchor border-t border-slate-200 bg-[#f8fafc]">
        <div className="mx-auto max-w-screen-2xl px-4 py-14 sm:px-6 lg:px-10">
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Why teams pick SupplierAdvisor
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              'One operating system instead of disconnected point tools.',
              'Verified counterparties and process evidence in the same workspace.',
              'Company operations and member experiences share one trusted graph.',
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700"
              >
                <p className="inline-flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="modules" className="sa-anchor border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-screen-2xl px-4 py-14 sm:px-6 lg:px-10">
          <div className="max-w-3xl">
            <p className="sa-text-brand-on-light text-xs font-black uppercase tracking-[0.2em]">Core OS</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Start with a focused module set
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Home now keeps the module story concise: operations, inventory, and relationship management are
              the launch path. Sector and industry depth is available on dedicated pages where each Advisor can
              be evaluated without inflating home-page complexity.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {CORE_MODULES.map((module) => (
              <article key={module.name} className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  {module.name}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{module.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="packaging" className="sa-anchor border-t border-slate-200 bg-[#f8fafc]">
        <div className="mx-auto grid max-w-screen-2xl gap-4 px-4 py-14 sm:px-6 lg:grid-cols-3 lg:px-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="sa-text-brand-on-light inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
              <Layers className="h-3.5 w-3.5" />
              Core
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Always-on OS modules for trade, operations, assurance, and finance.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="sa-text-brand-on-light inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
              <Layers className="h-3.5 w-3.5" />
              Sector
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Manufacturing, distribution, and container workflows for how you make and move.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="sa-text-brand-on-light inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
              <Layers className="h-3.5 w-3.5" />
              Industry
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Advisor-specific depth lives in /industries so each vertical can be reviewed in context.
            </p>
          </div>
        </div>
      </section>

      <section id="industries" className="sa-anchor border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-screen-2xl px-4 py-14 sm:px-6 lg:px-10">
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Industry Advisors have dedicated pages
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
            Browse full vertical workflows on the industries hub instead of loading every Advisor on home.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {INDUSTRY_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-slate-200 bg-[#f8fafc] px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="mt-6">
            <Link
              href="/industries"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Explore all industries
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section id="member-app" className="sa-anchor border-t border-slate-200 bg-[#f8fafc]">
        <div className="mx-auto max-w-screen-2xl px-4 py-14 sm:px-6 lg:px-10">
          <div className="rounded-3xl border border-sky-200 bg-white p-6 sm:p-8">
            <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#0077b6]">
              <Users2 className="h-4 w-4" />
              SA Member
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              One free wallet for bookings, check-ins, and payment proof
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              Keep the B2C story visible on home without loading the full feature grid. People can create a
              free SA Member account, while businesses keep operational and member touchpoints on one graph.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/me"
                className="sa-btn-brand inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:bg-[#22d3ee]"
              >
                Open SA Member
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/join"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                Start {COMPANY_TRIAL_DAYS}-day company trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      <HomePricing />
      <ComparePlatforms />
      <RoiCalculator />
      <SecurityStrip />
    </>
  );
}
