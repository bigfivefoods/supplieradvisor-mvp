'use client';

import Link from 'next/link';
import { ArrowRight, ArrowDown } from 'lucide-react';

const BEFORE = [
  'Excel / Sheets',
  'Email POs',
  'Xero / Sage',
  'WhatsApp ops',
  'Separate WMS',
  'Standalone CRM',
  'SHEQ PDF packs',
  'HR folder + payroll bureau',
];

const AFTER = [
  'Network & trust',
  'SRM + CRM + POs',
  'Inventory · lots · holds',
  'Make · ship · fulfill',
  'Finance + bank + BS',
  'SHEQ · HACCP · CAPA',
  'People · payroll · org',
  'Intelligence + SAM',
];

export default function ReplaceStackDiagram() {
  return (
    <section
      id="stack"
      className="scroll-mt-20 border-t border-slate-200 bg-white py-20 sm:py-28"
    >
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00b4d8]">
            Replace your stack
          </p>
          <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 sm:text-5xl">
            Eight tools fighting each other.
            <span className="mt-2 block text-[#00b4d8]">One operating system.</span>
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Stop reconciling truth across tabs, inboxes, and bureaux. Run trade,
            stock, quality, money, and people in one membership-scoped workspace.
          </p>
        </div>

        <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-8">
          {/* Before */}
          <div className="rounded-3xl border border-rose-100 bg-gradient-to-b from-rose-50/80 to-white p-6 sm:p-8 shadow-sm">
            <div className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-rose-600">
              Before · fragmented
            </div>
            <div className="grid grid-cols-2 gap-2">
              {BEFORE.map((t) => (
                <div
                  key={t}
                  className="rounded-xl border border-rose-100/80 bg-white px-3 py-2.5 text-center text-[12px] font-semibold text-slate-700 shadow-sm"
                >
                  {t}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-rose-800/80">
              Duplicate data · version wars · no holds · no network · audit pain
            </p>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="hidden lg:flex h-14 w-14 items-center justify-center rounded-full bg-[#00b4d8] text-white shadow-lg shadow-cyan-200/60">
              <ArrowRight className="h-6 w-6" />
            </div>
            <div className="flex lg:hidden h-12 w-12 items-center justify-center rounded-full bg-[#00b4d8] text-white">
              <ArrowDown className="h-5 w-5" />
            </div>
          </div>

          {/* After */}
          <div className="rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50/90 to-white p-6 sm:p-8 shadow-md shadow-emerald-100/50 ring-1 ring-emerald-100">
            <div className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
              After · SupplierAdvisor®
            </div>
            <div className="grid grid-cols-2 gap-2">
              {AFTER.map((t) => (
                <div
                  key={t}
                  className="rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-center text-[12px] font-semibold text-slate-800 shadow-sm"
                >
                  {t}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-emerald-900/80">
              One company · one COA · one organogram · verified edges
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-6 py-3 text-sm font-bold text-white hover:bg-[#0099b8]"
          >
            Try interactive demo <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#compare"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-800 hover:border-[#00b4d8]"
          >
            Compare stacks
          </a>
        </div>
      </div>
    </section>
  );
}
