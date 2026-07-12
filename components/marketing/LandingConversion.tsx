'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  X,
  ShieldCheck,
  Star,
  Link2,
  Fingerprint,
  HardHat,
  Package,
  Truck,
  AlertTriangle,
  Lock,
  FileCheck,
  Users,
  Zap,
} from 'lucide-react';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
} from '@/lib/billing/company-subscription';
import { FOUNDING_FREE_COMPANY_LIMIT } from '@/lib/billing/lifetime';

const DEMO_STEPS = [
  {
    id: 'connect',
    title: 'Connect',
    label: 'Handshake',
    icon: Users,
    headline: 'Verified counterparties',
    body: 'Invite or discover a partner. Accept a trading handshake. Certificates and verification status travel with the relationship.',
    metric: 'OTIFEF ready',
    detail: 'Network edge live',
  },
  {
    id: 'trade',
    title: 'Trade',
    label: 'Raise PO',
    icon: Truck,
    headline: 'PO with optional escrow',
    body: 'Raise a purchase order. Attach docs. When capital is at risk, attach on-chain escrow — without forcing crypto on every deal.',
    metric: 'Escrow optional',
    detail: 'PO · docs · terms',
  },
  {
    id: 'inspect',
    title: 'Inspect',
    label: 'QA fail',
    icon: Package,
    headline: 'Lot fails inspection',
    body: 'Incoming or in-process QA fails. The lot is held. Shipping is blocked until disposition — compliance as a control, not a PDF.',
    metric: 'Ship blocked',
    detail: 'Hold on lot',
  },
  {
    id: 'sheq',
    title: 'SHEQ',
    label: 'NCR + CAPA',
    icon: HardHat,
    headline: 'Auto NCR & CAPA',
    body: 'Failed inspection raises a nonconformance and draft CAPA. Incidents and hazards sit in the same SHEQ tower as food safety.',
    metric: 'ISO-ready loop',
    detail: 'Close the loop',
  },
] as const;

export function FoundingBanner({
  usedSlots,
  loading,
}: {
  usedSlots: number | null;
  loading?: boolean;
}) {
  const used = usedSlots ?? 0;
  const remaining = Math.max(0, FOUNDING_FREE_COMPANY_LIMIT - used);
  const pct = Math.min(
    100,
    Math.round((used / FOUNDING_FREE_COMPANY_LIMIT) * 100)
  );

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-amber-50 p-5 sm:p-7 shadow-sm">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-300/20 blur-2xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-violet-800">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            Founding partners
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            First {FOUNDING_FREE_COMPANY_LIMIT} companies — free for life
          </h3>
          <p className="mt-1.5 text-sm text-slate-600 max-w-xl">
            Early operators get complimentary lifetime access. After that: {COMPANY_TRIAL_DAYS}
            -day trial, then from R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/mo (save up to 30% prepaid).
          </p>
          <div className="mt-4 max-w-md">
            <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-600">
              <span>
                {loading
                  ? 'Counting network…'
                  : `${used} of ${FOUNDING_FREE_COMPANY_LIMIT} slots claimed`}
              </span>
              <span className="text-violet-800">
                {loading ? '—' : `${remaining} left`}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white border border-violet-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00b4d8] to-violet-500 transition-all duration-700"
                style={{ width: `${loading ? 8 : Math.max(pct, 4)}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <Link
            href="/onboarding?type=business"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            Claim a free slot <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-800 hover:border-violet-300"
          >
            View pricing
          </Link>
        </div>
      </div>
    </div>
  );
}

export function InteractiveTrustDemo() {
  const [step, setStep] = useState(0);
  const current = DEMO_STEPS[step];
  const Icon = current.icon;

  return (
    <div
      id="demo"
      className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden"
    >
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8]">
            60-second story
          </div>
          <div className="text-sm font-bold text-slate-900">
            How trust blocks risk — without a demo call
          </div>
        </div>
        <span className="text-[11px] font-semibold text-slate-500">
          Step {step + 1} of {DEMO_STEPS.length}
        </span>
      </div>

      <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 px-3 py-2 sm:px-4">
        {DEMO_STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(i)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${
              i === step
                ? 'bg-[#00b4d8] text-white shadow-sm'
                : i < step
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                  : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {i < step ? '✓ ' : `${i + 1}. `}
            {s.title}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-0">
        <div className="p-5 sm:p-8">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-[#00b4d8]">
            <Icon className="h-5 w-5" />
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
            {current.label}
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
            {current.headline}
          </h3>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-6">
            {current.body}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
            >
              Back
            </button>
            {step < DEMO_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#00b4d8] px-5 py-2 text-sm font-bold text-white hover:bg-[#0099b8]"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <Link
                href="/onboarding?type=business"
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800"
              >
                Run this on your company <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>

        <div className="border-t lg:border-t-0 lg:border-l border-slate-100 bg-gradient-to-br from-slate-50 to-sky-50/50 p-5 sm:p-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Live control state
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Simulated
              </span>
            </div>
            <div className="space-y-2">
              {DEMO_STEPS.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-all ${
                    i === step
                      ? 'border-[#00b4d8] bg-sky-50 shadow-sm'
                      : i < step
                        ? 'border-emerald-100 bg-emerald-50/50'
                        : 'border-slate-100 bg-slate-50/50 opacity-60'
                  }`}
                >
                  <span className="font-semibold text-slate-800">{s.title}</span>
                  <span
                    className={`text-[10px] font-bold uppercase ${
                      i < step
                        ? 'text-emerald-700'
                        : i === step
                          ? 'text-[#0077b6]'
                          : 'text-slate-400'
                    }`}
                  >
                    {i < step ? 'Done' : i === step ? s.metric : 'Queued'}
                  </span>
                </div>
              ))}
            </div>
            {step >= 2 && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>QA hold active</strong> — outbound ship blocked until lot disposition
                  and CAPA progress.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OtifefCard() {
  const scores = [
    { k: 'On-time', v: 96 },
    { k: 'In-full', v: 94 },
    { k: 'Error-free', v: 98 },
  ];
  const overall = 96;

  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 sm:p-6 h-full shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Star className="h-5 w-5 text-amber-500 fill-amber-400" />
        <h3 className="font-black text-slate-900">Supplier ratings · OTIFEF</h3>
      </div>
      <p className="text-sm text-slate-600 mb-5">
        Every delivery scores On-Time, In-Full, Error-Free — peer ratings and RIAD risk that follow
        the trading edge.
      </p>
      <div className="flex items-end gap-4 mb-5">
        <div>
          <div className="text-4xl font-black tabular-nums text-slate-900">{overall}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Composite
          </div>
        </div>
        <div className="flex gap-0.5 pb-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`h-4 w-4 ${n <= 5 ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`}
            />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {scores.map((s) => (
          <div key={s.k}>
            <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
              <span>{s.k}</span>
              <span>{s.v}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00b4d8] to-emerald-400"
                style={{ width: `${s.v}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TraceOnchainCard() {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 sm:p-6 h-full shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="h-5 w-5 text-[#00b4d8]" />
        <h3 className="font-black text-slate-900">Traceability + on-chain</h3>
      </div>
      <p className="text-sm text-slate-600 mb-5">
        Lot pedigree for recall drills. Optional product passports and PO escrow when authenticity
        or capital must be proven.
      </p>
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {['Farm lot', 'Plant', 'DC', 'Store', 'Passport'].map((n, i) => (
          <span key={n} className="inline-flex items-center gap-1">
            <span className="rounded-lg border border-cyan-100 bg-sky-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-800">
              {n}
            </span>
            {i < 4 && <span className="text-slate-300 text-xs">→</span>}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5">
          <Fingerprint className="h-4 w-4 text-emerald-700 mb-1" />
          <div className="text-xs font-bold text-emerald-900">On-chain ready</div>
          <div className="text-[10px] text-emerald-800/80">Escrow · passports</div>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-700 mb-1" />
          <div className="text-xs font-bold text-amber-950">Hold gates</div>
          <div className="text-[10px] text-amber-900/80">Ship blocked on fail</div>
        </div>
      </div>
    </div>
  );
}

export function ComparisonTable() {
  const rows = [
    {
      feature: 'Verified trading network',
      sheets: false,
      erp: 'Partial',
      sa: true,
    },
    {
      feature: 'OTIFEF supplier ratings',
      sheets: false,
      erp: false,
      sa: true,
    },
    {
      feature: 'QA hold blocks ship',
      sheets: false,
      erp: 'Add-on',
      sa: true,
    },
    {
      feature: 'SHEQ NCR/CAPA + incidents',
      sheets: false,
      erp: 'Separate tool',
      sa: true,
    },
    {
      feature: 'Lot traceability / recall',
      sheets: false,
      erp: 'Partial',
      sa: true,
    },
    {
      feature: 'On-chain escrow / passport',
      sheets: false,
      erp: false,
      sa: true,
    },
    {
      feature: 'Finance + management P&L',
      sheets: 'Manual',
      erp: true,
      sa: true,
    },
    {
      feature: 'One light UI for ops teams',
      sheets: false,
      erp: false,
      sa: true,
    },
  ] as const;

  const cell = (v: boolean | string) => {
    if (v === true)
      return (
        <span className="inline-flex items-center justify-center text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
        </span>
      );
    if (v === false)
      return (
        <span className="inline-flex items-center justify-center text-slate-300">
          <X className="h-4 w-4" />
        </span>
      );
    return <span className="text-[11px] font-semibold text-slate-500">{v}</span>;
  };

  return (
    <div
      id="compare"
      className="rounded-[2rem] border border-slate-200 bg-white overflow-hidden shadow-sm"
    >
      <div className="px-5 sm:px-8 py-6 border-b border-slate-100">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8] mb-2">
          Compare
        </p>
        <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Spreadsheets vs generic ERP vs SupplierAdvisor®
        </h3>
        <p className="mt-2 text-sm text-slate-600 max-w-2xl">
          Built for operators who need trust and throughput in the same system — not another
          disconnected compliance portal.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
              <th className="px-4 sm:px-6 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
                Capability
              </th>
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">
                Spreadsheets
              </th>
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">
                Generic ERP
              </th>
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-[#0077b6] text-center bg-sky-50/80">
                SupplierAdvisor
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.feature} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 sm:px-6 py-3 font-semibold text-slate-800">{r.feature}</td>
                <td className="px-3 py-3 text-center">{cell(r.sheets)}</td>
                <td className="px-3 py-3 text-center">{cell(r.erp)}</td>
                <td className="px-3 py-3 text-center bg-sky-50/40">{cell(r.sa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SecurityStrip() {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-slate-950 text-white p-6 sm:p-8">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-cyan-300/90 mb-2">
            <Lock className="h-3.5 w-3.5" />
            Enterprise trust
          </div>
          <h3 className="text-xl sm:text-2xl font-black tracking-tight">
            Built for multi-company groups that care about access & audit
          </h3>
          <p className="mt-2 text-sm text-white/60 max-w-xl">
            Membership-scoped workspaces, role-based modules, activity audit trails, and
            POPIA-aware data practices — so finance, SHEQ, and trade stay under control.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          {[
            { icon: Users, t: 'RBAC roles' },
            { icon: FileCheck, t: 'Audit log' },
            { icon: ShieldCheck, t: 'Company verify' },
            { icon: Lock, t: 'Scoped tenancy' },
          ].map((i) => (
            <div
              key={i.t}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center"
            >
              <i.icon className="h-4 w-4 text-cyan-300 mx-auto mb-1.5" />
              <div className="text-[11px] font-bold text-white/90">{i.t}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MultiEntityCase() {
  return (
    <div className="rounded-[1.75rem] border border-cyan-100 bg-gradient-to-br from-white via-sky-50/60 to-cyan-50 p-6 sm:p-8">
      <div className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8] mb-2">
        Multi-entity pattern
      </div>
      <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-2">
        One group. Many companies. Shared discipline.
      </h3>
      <p className="text-sm text-slate-600 leading-relaxed mb-5 max-w-2xl">
        Run Foods, Direct, Access, and regional entities as separate workspaces — each with its
        own books, lots, and SHEQ — while the network still shows verified companies trading
        together. Built for African multi-brand operators, not single-tenant silos.
      </p>
      <div className="flex flex-wrap gap-2">
        {['Entity A · Foods', 'Entity B · Direct', 'Entity C · Access', 'Entity D · Region'].map(
          (e) => (
            <span
              key={e}
              className="rounded-full border border-white bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm"
            >
              {e}
            </span>
          )
        )}
      </div>
    </div>
  );
}

export function DemoCta() {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
      <div>
        <h3 className="text-lg font-black text-slate-900">Want a guided walkthrough?</h3>
        <p className="text-sm text-slate-600 mt-1">
          Book a 20-minute demo — we&apos;ll map your supply chain onto the OS (trade, stock,
          SHEQ, finance).
        </p>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        <a
          href="mailto:connect@supplieradvisor.com?subject=Demo%20request%20%E2%80%94%20SupplierAdvisor"
          className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-5 py-3 text-sm font-bold text-white hover:bg-[#0099b8]"
        >
          Email for demo <ArrowRight className="h-4 w-4" />
        </a>
        <a
          href="https://wa.me/27825814215?text=Hi%20—%20I'd%20like%20a%20SupplierAdvisor%20demo"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-800 hover:border-emerald-300"
        >
          WhatsApp
        </a>
      </div>
    </div>
  );
}
