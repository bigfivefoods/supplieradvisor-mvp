'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Shield,
  Sparkles,
  Building2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  BILLING_TERMS,
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
  formatZar,
} from '@/lib/billing/company-subscription';
import { FOUNDING_FREE_COMPANY_LIMIT } from '@/lib/billing/lifetime';

const FEATURES = [
  'Unlimited team users per company',
  'Full ERP — procurement, CRM, finance, inventory',
  'Quality, manufacturing & distribution modules',
  'On-chain verification & supplier network',
  'Invoices, quotes & bank tools',
  'Prepaid annual discounts up to 30%',
  `First ${FOUNDING_FREE_COMPANY_LIMIT} companies — free for life`,
];

export default function Pricing() {
  const router = useRouter();

  return (
    <div className="pl-0 pr-6 sm:pr-12 py-12 bg-[#f8fafc] min-h-[70vh]">
      <Breadcrumb />
      <h1 className="text-5xl sm:text-6xl font-black tracking-[-2px] sm:tracking-[-3px] text-[#00b4d8] mb-4">
        Pricing
      </h1>
      <p className="text-slate-600 text-lg max-w-2xl mb-12">
        One simple company plan. Start free for {COMPANY_TRIAL_DAYS} days — then
        R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR} per month. No per-user fees.
      </p>

      <div className="max-w-4xl mx-auto grid gap-8 lg:grid-cols-5 items-stretch">
        <div className="lg:col-span-3 card p-8 sm:p-12 text-center relative overflow-hidden">
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 border border-sky-200 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-800 mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            Company plan
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-slate-900">
            Full SupplierAdvisor access
          </h2>
          <p className="text-5xl sm:text-6xl font-black text-[#00b4d8]">
            {COMPANY_TRIAL_DAYS}-day free trial
          </p>
          <p className="text-xl sm:text-2xl text-slate-600 mt-4">
            Then from{' '}
            <strong className="text-slate-900">
              R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}
            </strong>{' '}
            per company per month
          </p>
          <p className="text-slate-500 mt-6 text-sm sm:text-base">
            Unlimited users · Full ERP · Save up to 30% prepaid
          </p>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2 text-left">
            {BILLING_TERMS.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-3"
              >
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {t.label}
                </div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {formatZar(t.payZar)}
                </div>
                {t.discountPercent > 0 ? (
                  <div className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                    −{t.discountPercent}% · save {formatZar(t.savingsZar)}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    list / month
                  </div>
                )}
              </div>
            ))}
          </div>

          <ul className="mt-8 text-left space-y-2.5 max-w-md mx-auto">
            {FEATURES.map((f) => (
              <li key={f} className="flex gap-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => router.push('/onboarding')}
            className="btn-primary w-full py-5 sm:py-6 mt-10 text-lg sm:text-xl inline-flex items-center justify-center gap-2"
          >
            Start {COMPANY_TRIAL_DAYS}-day free trial
            <ArrowRight className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/my-business/billing')}
            className="mt-3 w-full py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 inline-flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            Manage billing in My Business
          </button>
          <p className="mt-4 text-[11px] text-slate-500 flex items-center justify-center gap-1">
            <Shield className="w-3 h-3" />
            No card required for trial · cancel anytime
          </p>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="card p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Building2 className="w-4 h-4 text-[#00b4d8]" />
              How it works
            </div>
            <ol className="mt-4 space-y-3 text-sm text-slate-600 list-decimal list-inside">
              <li>Register your company (free trial starts automatically).</li>
              <li>
                Use the full platform for {COMPANY_TRIAL_DAYS} days with no
                charge.
              </li>
              <li>
                Subscribe in{' '}
                <strong className="text-slate-800">My Business → Billing</strong>{' '}
                — monthly or prepaid multi-year via Paystack.
              </li>
              <li>
                Save 15% (1 year), 25% (2 years), or 30% (3 years) when you pay
                upfront.
              </li>
            </ol>
          </div>
          <div className="card p-6 bg-gradient-to-br from-sky-50 to-white border-sky-100">
            <div className="text-4xl font-black text-slate-900">
              R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}
              <span className="text-base font-semibold text-slate-500">
                /mo
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              List monthly rate. Prepaid terms discount the full period total —
              e.g. 3 years for {formatZar(BILLING_TERMS.find((t) => t.id === '3y')!.payZar)}.
            </p>
          </div>
          <div className="card p-6 bg-gradient-to-br from-violet-50 to-amber-50 border-violet-100">
            <div className="text-sm font-bold uppercase tracking-wide text-violet-800">
              Founding partners
            </div>
            <p className="mt-2 text-sm text-slate-700">
              The first <strong>{FOUNDING_FREE_COMPANY_LIMIT}</strong> companies
              on SupplierAdvisor receive <strong>lifetime free access</strong> —
              no card, no monthly fee. After that, standard trial + R
              {COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/mo applies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
