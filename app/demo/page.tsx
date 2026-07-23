'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import LandingNav from '@/components/marketing/LandingNav';
import {
  OpsMock,
  SrmMock,
  AccountingMock,
  SheqMock,
  QualityMock,
  ManufacturingMock,
  InventoryMock,
  NetworkMock,
  ProductMockShell,
  ModuleGallery,
} from '@/components/marketing/ProductMocks';
import { COMPANY_TRIAL_DAYS } from '@/lib/billing/company-subscription';

const DEMOS = [
  { id: 'ops', label: 'Operations', Mock: OpsMock, gallery: 'ops' },
  { id: 'srm', label: 'Suppliers', Mock: SrmMock, gallery: 'srm' },
  { id: 'inv', label: 'Inventory', Mock: InventoryMock, gallery: 'inv' },
  { id: 'mfg', label: 'Manufacturing', Mock: ManufacturingMock, gallery: 'mfg' },
  { id: 'fin', label: 'Finance', Mock: AccountingMock, gallery: 'fin' },
  { id: 'sheq', label: 'SHEQ', Mock: SheqMock, gallery: 'sheq' },
  { id: 'qa', label: 'Quality', Mock: QualityMock, gallery: 'qa' },
  { id: 'net', label: 'Network', Mock: NetworkMock, gallery: 'net' },
] as const;

export default function InteractiveDemoPage() {
  const [active, setActive] = useState(0);
  const current = DEMOS[active];
  const Mock = current.Mock;

  return (
    <div className="min-h-dvh bg-[#f8fafc] text-slate-900">
      <LandingNav />
      <main className="mx-auto max-w-screen-2xl px-4 py-12 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00b4d8]">
              Interactive demo
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Click through the OS — no signup
            </h1>
            <p className="mt-2 max-w-xl text-slate-600">
              Live product mocks for core modules. When you&apos;re ready, start
              your {COMPANY_TRIAL_DAYS}-day free trial with real data.
            </p>
          </div>
          <Link
            href="/onboarding?type=business"
            className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-6 py-3 text-sm font-bold text-white hover:bg-[#0099b8]"
          >
            Start free trial <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {DEMOS.map((d, i) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setActive(i)}
              className={`rounded-full border px-3.5 py-2 text-xs font-bold transition-all sm:text-sm ${
                i === active
                  ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Play className="h-4 w-4 text-[#00b4d8]" />
                  {current.label}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Demo · read-only mock
                </span>
              </div>
              <ProductMockShell>
                <Mock />
              </ProductMockShell>
            </div>
          </div>
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-black text-slate-900">What you&apos;re seeing</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                UI fidelity matches the live app chrome — telemetry, workboards,
                and process steps. Data is sample only.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                <li>· Switch modules with the pills above</li>
                <li>· Three equal-height scenes below</li>
                <li>· Trial unlocks your real company data</li>
              </ul>
              <Link
                href="/onboarding?type=business"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#00b4d8] py-3 text-sm font-bold text-white hover:bg-[#0099b8]"
              >
                Create company workspace
              </Link>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">Also explore</h3>
              <div className="mt-3 flex flex-col gap-2 text-sm font-semibold">
                <Link href="/#compare" className="text-[#0077b6] hover:underline">
                  Compare vs Excel / Xero / ERP
                </Link>
                <Link href="/#roi" className="text-[#0077b6] hover:underline">
                  ROI calculator
                </Link>
                <Link href="/industries" className="text-[#0077b6] hover:underline">
                  Industry pages
                </Link>
                <Link href="/directory" className="text-[#0077b6] hover:underline">
                  Company directory
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">
            Scene gallery · {current.label}
          </h3>
          <ModuleGallery moduleId={current.gallery} />
        </div>
      </main>
    </div>
  );
}
