'use client';

import { Building2, CheckCircle2, Factory, Landmark, Leaf, ShoppingBag, Truck } from 'lucide-react';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
} from '@/lib/billing/company-subscription';

/** Operating contexts — not customer logos, and not a claim that these sectors are signed. */
const SEGMENTS = [
  { name: 'Food & beverage', icon: ShoppingBag },
  { name: 'Agri & inputs', icon: Leaf },
  { name: 'Manufacturing', icon: Factory },
  { name: 'Distribution', icon: Truck },
  { name: 'Public sector', icon: Landmark },
  { name: 'Multi-entity groups', icon: Building2 },
];

const DELIVERED = [
  'Company workspace for the trade loop: network, purchase orders, invoices, inventory lots, manufacturing, distribution, finance, SHEQ, and quality holds.',
  'Trust layer on that same workspace: company verification, OTIFEF scoring, peer ratings, and RIAD on the trading relationship.',
  'Free SA Member account for gym, clinic, hire, and shop. Members are not charged a SupplierAdvisor® platform fee.',
  `${COMPANY_TRIAL_DAYS}-day company trial, then from R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month. Unlimited team users on the company plan.`,
  'Self-serve industry packs for the sectors named on this page.',
  'Optional on-chain PO escrow when a specific trade needs it. It is not required on every order.',
];

const PLANNED = [
  'A hosted product film is not published here. Until it is, the interactive demo is a click-through of sample screens.',
];

const NOT_INSTANT = [
  'Government and public-programme workspaces, including SchoolAdvisor®, open after a SupplierAdvisor® admin approves the request. The tools are in the product; instant self-serve is not.',
  'Bespoke process design for a group is scoped on a demo. It is not included in the published company price.',
];

export default function SocialProofStrip() {
  return (
    <section
      id="proof"
      className="sa-anchor border-t border-slate-200 bg-white py-14 dark:border-neutral-800 dark:bg-black sm:py-16"
    >
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-neutral-400">
            Proof, without invented numbers
          </p>
          <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 dark:text-white sm:text-4xl">
            What is delivered, and what is not
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-neutral-300">
            SupplierAdvisor® does not publish customer counts, savings claims, or live score
            averages on this page. The points below are product facts. Pictures elsewhere are
            sample screens.
          </p>
        </div>

        <p className="mb-4 text-center text-sm font-semibold text-slate-700 dark:text-neutral-200">
          Built for these operating contexts
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {SEGMENTS.map((s) => (
            <div
              key={s.name}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 sm:text-sm"
            >
              <s.icon className="h-3.5 w-3.5 shrink-0 text-[#00b4d8]" aria-hidden />
              <span>{s.name}</span>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-[#f8fafc] p-6 dark:border-neutral-800 dark:bg-neutral-950 sm:p-8">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Delivered</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">
              In the product a company can open on the trial.
            </p>
            <ul className="mt-5 space-y-3">
              {DELIVERED.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-relaxed text-slate-700 dark:text-neutral-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <div className="flex flex-col gap-4">
            <article className="rounded-3xl border border-amber-200 bg-amber-50/70 p-6 dark:border-amber-900/50 dark:bg-amber-950/30 sm:p-8">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Planned</h3>
              <p className="mt-1 text-sm text-slate-700 dark:text-neutral-200">
                Not shipped as a finished piece of this page.
              </p>
              <ul className="mt-5 space-y-3">
                {PLANNED.map((item) => (
                  <li key={item} className="text-sm leading-relaxed text-slate-800 dark:text-neutral-100">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950 sm:p-8">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Not instant self-serve</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">
                These paths exist. They are not a toggle you switch on alone.
              </p>
              <ul className="mt-5 space-y-3">
                {NOT_INSTANT.map((item) => (
                  <li key={item} className="text-sm leading-relaxed text-slate-700 dark:text-neutral-200">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
