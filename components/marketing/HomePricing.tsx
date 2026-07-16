'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Shield,
  Sparkles,
  Building2,
  Users,
  Zap,
  Globe2,
  CreditCard,
  Clock,
  Gift,
  Link2,
  Network,
} from 'lucide-react';
import {
  BILLING_TERMS,
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
  formatZar,
  type BillingTerm,
} from '@/lib/billing/company-subscription';
import { FOUNDING_FREE_COMPANY_LIMIT } from '@/lib/billing/lifetime';
import {
  REFERRAL_LEVEL_LABELS,
  REFERRAL_LEVEL_RATES_PCT,
  REFERRAL_SCALE_SCENARIO_COUNTS,
  REFERRAL_TOTAL_CAP_PCT,
  referralChainScaleScenario,
  referralRatesSummary,
} from '@/lib/billing/supply-chain-referral';

const INCLUDED = [
  'Unlimited team users per company',
  'Procurement, CRM, finance & inventory',
  'Quality, manufacturing & distribution',
  'On-chain verification & trade network',
  'Quotes, invoices & bank tools',
  'Secure Paystack billing in ZAR',
];

const HIGHLIGHTS = [
  {
    icon: Clock,
    title: `${COMPANY_TRIAL_DAYS}-day free trial`,
    body: 'Full platform access. No card required to start.',
  },
  {
    icon: Building2,
    title: 'One flat company fee',
    body: 'No per-seat pricing. Invite your whole team.',
  },
  {
    icon: Zap,
    title: 'Prepaid multi-year savings',
    body: '15% for 1 year · 25% for 2 years · 30% for 3 years.',
  },
  {
    icon: Globe2,
    title: 'Built for African trade',
    body: 'ZAR billing, local verification, network commerce.',
  },
];

function termCta(t: BillingTerm): string {
  if (t.id === 'monthly') return 'Start monthly';
  if (t.id === '3y') return 'Lock in 3 years';
  if (t.id === '2y') return 'Choose 2 years';
  return 'Choose 1 year';
}

/** Round to cents for display */
function feeZar(base: number, ratePct: number): number {
  return Math.round(((base * ratePct) / 100) * 100) / 100;
}

export default function HomePricing() {
  const annual = BILLING_TERMS.find((t) => t.id === '1y')!;
  const best = BILLING_TERMS.find((t) => t.id === '3y')!;
  const exampleBase = COMPANY_SUBSCRIPTION_MONTHLY_ZAR;
  const exampleFees = REFERRAL_LEVEL_RATES_PCT.map((rate) => ({
    rate,
    amount: feeZar(exampleBase, rate),
  }));
  const exampleTotal = exampleFees.reduce((s, f) => s + f.amount, 0);
  const scaleScenarios = REFERRAL_SCALE_SCENARIO_COUNTS.map((count) =>
    referralChainScaleScenario(count, COMPANY_SUBSCRIPTION_MONTHLY_ZAR)
  );

  return (
    <div id="pricing" className="scroll-mt-20 border-t border-slate-200 bg-[#f8fafc] text-slate-900">
      {/* Pricing intro */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,180,216,0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 20%, rgba(251,191,36,0.12), transparent 50%)',
            }}
          />
          <div className="relative mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10 pt-14 sm:pt-20 pb-10 sm:pb-14 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-800 mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Simple company pricing
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-[-1.5px] sm:tracking-[-2px] text-slate-900 max-w-3xl mx-auto leading-[1.08]">
              One plan. Full platform.
              <span className="block text-[#00b4d8] mt-1">
                {COMPANY_TRIAL_DAYS} days free, then from R
                {COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/mo
              </span>
            </h2>
            <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Unlimited users per company. No per-seat fees. Pay monthly or
              prepay and save up to <strong className="text-slate-800">30%</strong>{' '}
              — secure checkout with Paystack in South African Rand.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/onboarding?type=business"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#00b4d8] to-[#0077b6] px-7 py-3.5 text-base font-black text-white shadow-xl shadow-sky-200/50 hover:opacity-95 transition"
              >
                Start {COMPANY_TRIAL_DAYS}-day free trial
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#tiers"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-base font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Compare tiers
              </a>
              <a
                href="#referral"
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-3.5 text-base font-bold text-emerald-900 hover:bg-emerald-100/80 transition"
              >
                <Gift className="w-4 h-4" />
                Referral fees
              </a>
            </div>
            <p className="mt-4 text-xs text-slate-500 inline-flex items-center gap-1.5 justify-center">
              <Shield className="w-3.5 h-3.5" />
              No card required for trial · Cancel anytime · First{' '}
              {FOUNDING_FREE_COMPANY_LIMIT} companies free for life
            </p>
          </div>
        </section>

        {/* Pricing tiers */}
        <section
          id="tiers"
          className="scroll-mt-20 mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10 pb-16 sm:pb-20"
        >
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Choose your billing tier
            </h2>
            <p className="mt-2 text-slate-600 text-sm sm:text-base max-w-xl mx-auto">
              Same full product on every tier. Longer prepaid terms unlock bigger
              discounts off the R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month list rate.
            </p>
          </div>

          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {BILLING_TERMS.map((t) => {
              const featured = t.id === '1y';
              const bestValue = t.id === '3y';
              return (
                <div
                  key={t.id}
                  className={`relative flex flex-col rounded-[1.75rem] border bg-white p-6 sm:p-7 shadow-sm transition hover:shadow-md ${
                    featured
                      ? 'border-[#00b4d8] ring-2 ring-[#00b4d8]/25 xl:-translate-y-1 shadow-sky-100/80'
                      : bestValue
                        ? 'border-amber-200 bg-gradient-to-b from-amber-50/80 to-white'
                        : 'border-slate-200'
                  }`}
                >
                  {(featured || bestValue) && (
                    <div
                      className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow ${
                        bestValue
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                          : 'bg-gradient-to-r from-[#00b4d8] to-[#0077b6]'
                      }`}
                    >
                      {bestValue ? 'Best value' : 'Most popular'}
                    </div>
                  )}

                  <div className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                    {t.label}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-black tracking-tight text-slate-900">
                      {formatZar(t.payZar)}
                    </span>
                    <span className="text-sm font-semibold text-slate-500">
                      {t.months === 1 ? '/mo' : ' prepaid'}
                    </span>
                  </div>

                  {t.discountPercent > 0 ? (
                    <div className="mt-2 space-y-0.5">
                      <div className="text-sm text-slate-500 line-through">
                        {formatZar(t.listZar)} list
                      </div>
                      <div className="inline-flex items-center rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                        Save {t.discountPercent}% · {formatZar(t.savingsZar)}
                      </div>
                      <div className="text-xs text-slate-500 pt-1">
                        ~{formatZar(Math.round(t.effectiveMonthlyZar))}/mo effective
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-500">
                      Flexible month-to-month · list rate
                    </div>
                  )}

                  <ul className="mt-5 space-y-2 flex-1">
                    <li className="flex gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      {t.months === 1
                        ? '1 month access'
                        : `${t.months} months access`}
                    </li>
                    <li className="flex gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      Full ERP for one company
                    </li>
                    <li className="flex gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      Unlimited users
                    </li>
                    {t.discountPercent > 0 && (
                      <li className="flex gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        {t.discountPercent}% prepaid discount
                      </li>
                    )}
                  </ul>

                  <Link
                    href="/onboarding?type=business"
                    className={`mt-6 w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black transition ${
                      featured
                        ? 'bg-gradient-to-r from-[#00b4d8] to-[#0077b6] text-white shadow-lg shadow-sky-200/40'
                        : bestValue
                          ? 'bg-slate-900 text-white hover:bg-slate-800'
                          : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {termCta(t)}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            After trial, subscribe in{' '}
            <Link
              href="/dashboard/my-business/billing"
              className="font-semibold text-[#00b4d8] hover:underline"
            >
              My Business → Billing
            </Link>{' '}
            and pick any tier. Early renewals extend your access period.
          </p>
        </section>

        {/* What's included */}
        <section className="border-y border-slate-200/80 bg-white">
          <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10 py-14 sm:py-16">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                  Everything included
                </h2>
                <p className="mt-3 text-slate-600 leading-relaxed">
                  Every tier is the same product — the full SupplierAdvisor supply-chain
                  operating system for your company workspace.
                </p>
                <ul className="mt-6 grid sm:grid-cols-2 gap-3">
                  {INCLUDED.map((f) => (
                    <li
                      key={f}
                      className="flex gap-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-2xl px-3.5 py-3"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {HIGHLIGHTS.map((h) => (
                  <div
                    key={h.title}
                    className="rounded-[1.5rem] border border-slate-200 bg-[#f8fafc] p-5"
                  >
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-[#00b4d8]">
                      <h.icon className="w-5 h-5" />
                    </div>
                    <h3 className="mt-3 font-bold text-slate-900">{h.title}</h3>
                    <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                      {h.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Founding + how it works */}
        <section className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10 py-14 sm:py-16">
          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-[2rem] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-amber-50 p-7 sm:p-9">
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 border border-violet-200 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-800">
                <Users className="w-3.5 h-3.5" />
                Founding partners
              </div>
              <h2 className="mt-4 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                First {FOUNDING_FREE_COMPANY_LIMIT} companies — free for life
              </h2>
              <p className="mt-3 text-slate-700 leading-relaxed max-w-xl">
                Early companies on SupplierAdvisor receive complimentary lifetime
                access. After the founding cohort fills, standard trial + paid tiers
                apply from R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month.
              </p>
              <Link
                href="/onboarding?type=business"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-900 text-white font-bold text-sm px-5 py-3 hover:bg-slate-800 transition"
              >
                Claim your free lifetime slot
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-7 sm:p-8">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <CreditCard className="w-4 h-4 text-[#00b4d8]" />
                How billing works
              </div>
              <ol className="mt-5 space-y-4 text-sm text-slate-600">
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-black text-sky-800">
                    1
                  </span>
                  <span>
                    Register your company — trial starts automatically for{' '}
                    {COMPANY_TRIAL_DAYS} days.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-black text-sky-800">
                    2
                  </span>
                  <span>
                    Use the full platform with your team (unlimited users).
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-black text-sky-800">
                    3
                  </span>
                  <span>
                    Pick a tier in Billing — monthly or prepaid multi-year via
                    Paystack.
                  </span>
                </li>
              </ol>
              <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 text-xs text-slate-600">
                Popular: {annual.label} at {formatZar(annual.payZar)} (−15%).
                Best value: {best.label} at {formatZar(best.payZar)} (−30%).
              </div>
            </div>
          </div>
        </section>

        {/* Supply-chain referral programme */}
        <section
          id="referral"
          className="scroll-mt-20 border-y border-slate-200/80 bg-gradient-to-b from-emerald-50/40 via-white to-white"
        >
          <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10 py-14 sm:py-16">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-900 mb-4">
                <Network className="w-3.5 h-3.5" />
                Paid to do good
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                A system that pays you to build trust
              </h2>
              <p className="mt-3 text-slate-600 text-sm sm:text-base leading-relaxed">
                Invite real trading partners. Help them run clean ops. When they
                pay for SupplierAdvisor, you earn a share of their{' '}
                <strong className="text-slate-800">platform subscription</strong>{' '}
                — not product sales. Up to{' '}
                <strong className="text-slate-800">
                  {REFERRAL_TOTAL_CAP_PCT}%
                </strong>{' '}
                across three levels ({referralRatesSummary()}). Good behaviour —
                verified partners, on-time delivery, quality holds that work —
                is what the network rewards.
              </p>
            </div>

            {/* Process */}
            <div className="grid md:grid-cols-3 gap-4 mb-10">
              {[
                {
                  step: '1',
                  icon: Link2,
                  title: 'Invite good partners',
                  body: 'Share your referral link from Billing, or invite suppliers, customers, and partners you actually trade with. First invite wins (first-touch).',
                },
                {
                  step: '2',
                  icon: Building2,
                  title: 'They do the work',
                  body: `They register (or claim your invite), run a free trial, then subscribe — monthly or prepaid multi-year from R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/mo. You earn when they pay, not when they merely sign up.`,
                },
                {
                  step: '3',
                  icon: Gift,
                  title: 'You get paid',
                  body: 'A share of their subscription credits to your company. Request payout after review — pending → approved → paid. Be good: bring real companies that stay.',
                },
              ].map((s) => (
                <div
                  key={s.step}
                  className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-900">
                      {s.step}
                    </span>
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-[#00b4d8]">
                      <s.icon className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="mt-4 font-bold text-slate-900">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Scale: 10 / 50 / 200 at L1, L2, L3 down the chain */}
            <div className="mb-10 rounded-[1.75rem] border border-emerald-200/80 bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Scale down the chain: 10 · 50 · 200 companies
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed max-w-2xl">
                    What it could mean for your business if that many companies{' '}
                    <strong className="text-slate-800">below you</strong> each pay
                    the list rate of{' '}
                    <strong className="text-slate-800">
                      {formatZar(COMPANY_SUBSCRIPTION_MONTHLY_ZAR)}/mo
                    </strong>
                    . Depth matters: L1 is a company you invited; L2 is someone they
                    invited; L3 is one hop further. Rates:{' '}
                    {referralRatesSummary()}.
                  </p>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">
                  Illustrative · not a guarantee
                </p>
              </div>

              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full min-w-[36rem] text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="py-3 pr-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Companies below you
                      </th>
                      {scaleScenarios.map((s) => (
                        <th
                          key={s.count}
                          className="py-3 px-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700"
                        >
                          {s.count}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(
                      [
                        {
                          level: 0 as const,
                          title: `L1 · ${REFERRAL_LEVEL_RATES_PCT[0]}%`,
                          hint: 'You invited them directly',
                          tone: 'text-emerald-800 bg-emerald-50/50',
                        },
                        {
                          level: 1 as const,
                          title: `L2 · ${REFERRAL_LEVEL_RATES_PCT[1]}%`,
                          hint: 'Invited by your referral',
                          tone: 'text-sky-900 bg-sky-50/40',
                        },
                        {
                          level: 2 as const,
                          title: `L3 · ${REFERRAL_LEVEL_RATES_PCT[2]}%`,
                          hint: 'One more level deeper',
                          tone: 'text-violet-900 bg-violet-50/40',
                        },
                      ] as const
                    ).map((row) => (
                      <tr key={row.level} className={row.tone}>
                        <td className="py-3.5 pr-3 align-top">
                          <div className="font-bold text-slate-900">{row.title}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {row.hint}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                            {formatZar(
                              scaleScenarios[0].levels[row.level].perCompanyMonthly
                            )}
                            /co · mo
                          </div>
                        </td>
                        {scaleScenarios.map((s) => {
                          const cell = s.levels[row.level];
                          return (
                            <td
                              key={`${s.count}-L${row.level + 1}`}
                              className="py-3.5 px-2 text-center align-top"
                            >
                              <div className="text-base sm:text-lg font-black tabular-nums text-slate-900">
                                {formatZar(cell.monthlyZar)}
                                <span className="text-[10px] font-bold text-slate-500">
                                  /mo
                                </span>
                              </div>
                              <div className="text-[11px] font-semibold tabular-nums text-slate-600 mt-0.5">
                                {formatZar(cell.annualZar)}/yr
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {/* Total L1 + L2 + L3 for each scale column */}
                    <tr className="border-t-2 border-emerald-300 bg-emerald-100/70">
                      <td className="py-4 pr-3 align-top">
                        <div className="font-black text-emerald-950">
                          Total after L3
                        </div>
                        <div className="text-[11px] text-emerald-900/80 mt-0.5 leading-snug">
                          If you have that many paying at{' '}
                          <strong>each</strong> level (L1 + L2 + L3 stacked)
                        </div>
                      </td>
                      {scaleScenarios.map((s) => (
                        <td
                          key={`total-${s.count}`}
                          className="py-4 px-2 text-center align-top"
                        >
                          <div className="text-lg sm:text-xl font-black tabular-nums text-emerald-950">
                            {formatZar(s.totalMonthlyZar)}
                            <span className="text-[10px] font-bold text-emerald-800">
                              /mo
                            </span>
                          </div>
                          <div className="text-sm font-bold tabular-nums text-emerald-900 mt-0.5">
                            {formatZar(s.totalAnnualZar)}/yr
                          </div>
                          <div className="text-[10px] text-emerald-800/70 mt-1">
                            L1+L2+L3 × {s.count}
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-5 grid sm:grid-cols-3 gap-3">
                {scaleScenarios.map((s) => (
                  <div
                    key={`total-card-${s.count}`}
                    className="rounded-2xl border border-emerald-300 bg-gradient-to-b from-emerald-50 to-white px-4 py-4 text-center shadow-sm"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      {s.count} at each level · you could earn
                    </div>
                    <div className="mt-1.5 text-2xl font-black tabular-nums text-emerald-950">
                      {formatZar(s.totalMonthlyZar)}
                      <span className="text-sm font-bold text-emerald-800">/mo</span>
                    </div>
                    <div className="text-sm font-bold tabular-nums text-emerald-900">
                      {formatZar(s.totalAnnualZar)}/yr
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500 leading-snug">
                      = {formatZar(s.levels[0].monthlyZar)} L1 +{' '}
                      {formatZar(s.levels[1].monthlyZar)} L2 +{' '}
                      {formatZar(s.levels[2].monthlyZar)} L3
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-500 leading-relaxed">
                <strong className="text-slate-700">Total after L3</strong> assumes{' '}
                {scaleScenarios.map((s) => s.count).join(' / ')} companies paying at
                L1 <em>and</em> the same number at L2 <em>and</em> at L3 — the full
                stack under you. Real networks mix depths; rows always add. L1 is
                strongest per company — invite partners who stay so L2 and L3 grow
                under you.
              </p>
            </div>

            {/* Fees + example */}
            <div className="grid lg:grid-cols-2 gap-5 lg:gap-6 items-stretch">
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
                <h3 className="text-lg font-black text-slate-900">
                  Referral fee split
                </h3>
                <p className="mt-1.5 text-sm text-slate-600">
                  Of every qualifying subscription payment by a company in your
                  chain:
                </p>
                <ul className="mt-5 space-y-3">
                  {REFERRAL_LEVEL_RATES_PCT.map((rate, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {REFERRAL_LEVEL_LABELS[i]}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {i === 0
                            ? 'Company you invited directly'
                            : i === 1
                              ? 'Company invited by your referral'
                              : 'One more level deeper'}
                        </div>
                      </div>
                      <div className="text-2xl font-black text-emerald-700 tabular-nums">
                        {rate}%
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                  <span className="font-semibold text-emerald-950">
                    Combined cap
                  </span>
                  <span className="font-black text-emerald-900">
                    {REFERRAL_TOTAL_CAP_PCT}% max
                  </span>
                </div>
                <p className="mt-4 text-xs text-slate-500 leading-relaxed">
                  Separate from sales-contractor product commission (personal
                  sales only). Referral fees apply only to company platform
                  subscription payments.
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50/50 p-6 sm:p-8 shadow-sm">
                <h3 className="text-lg font-black text-slate-900">
                  Example
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  <strong className="text-slate-800">You</strong> invite{' '}
                  <strong className="text-slate-800">Company A</strong>. They
                  invite <strong className="text-slate-800">Company B</strong>.
                  B invites <strong className="text-slate-800">Company C</strong>
                  . When <strong className="text-slate-800">C</strong> pays a
                  monthly subscription of{' '}
                  <strong className="text-slate-800">
                    {formatZar(exampleBase)}
                  </strong>
                  :
                </p>

                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-2.5">Who earns</th>
                        <th className="px-4 py-2.5">Level</th>
                        <th className="px-4 py-2.5 text-right">Fee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          Company B
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          L1 · {REFERRAL_LEVEL_RATES_PCT[0]}%
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums">
                          {formatZar(exampleFees[0].amount)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          Company A
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          L2 · {REFERRAL_LEVEL_RATES_PCT[1]}%
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums">
                          {formatZar(exampleFees[1].amount)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          You
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          L3 · {REFERRAL_LEVEL_RATES_PCT[2]}%
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums">
                          {formatZar(exampleFees[2].amount)}
                        </td>
                      </tr>
                      <tr className="bg-emerald-50/80">
                        <td
                          colSpan={2}
                          className="px-4 py-3 font-bold text-slate-900"
                        >
                          Total shared (of {formatZar(exampleBase)})
                        </td>
                        <td className="px-4 py-3 text-right font-black text-emerald-900 tabular-nums">
                          {formatZar(exampleTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="mt-4 text-xs text-slate-600 leading-relaxed">
                  If you invited C directly, you would earn L1 (
                  {formatZar(exampleFees[0].amount)}) instead. Prepaid terms use
                  the same percentages on the amount actually paid (e.g.{' '}
                  {formatZar(annual.payZar)} for 1 year).
                </p>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                  Copy your link in{' '}
                  <Link
                    href="/dashboard/my-business/billing"
                    className="font-semibold text-[#0077b6] hover:underline"
                  >
                    My Business → Billing
                  </Link>{' '}
                  after you create a company.
                </p>
              </div>
            </div>
          </div>
        </section>


    </div>
  );
}
