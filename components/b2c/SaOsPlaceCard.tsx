'use client';

import Link from 'next/link';
import { ChevronRight, Sparkles } from 'lucide-react';
import { SaOfficialLogo } from '@/components/brand/SaOfficialLogo';
import { SA_OS_DEMO_PATH } from '@/lib/b2c/sa-os-demo';
import { COMPANY_TRIAL_DAYS } from '@/lib/billing/company-subscription';

export function SaOsPlaceCard({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <Link
        href={SA_OS_DEMO_PATH}
        className="flex items-center gap-3 rounded-2xl border border-cyan-200 bg-gradient-to-r from-[#0077b6] via-[#00b4d8] to-[#0c4a6e] p-3 text-white shadow-sm active:scale-[0.99]"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
          <SaOfficialLogo title="SupplierAdvisor" className="sa-logo-on-dark h-7 w-auto" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black">SupplierAdvisor</span>
          <span className="block truncate text-[11px] text-white/80">
            Business OS demo · always first in Places
          </span>
        </span>
        <ChevronRight className="h-4 w-4 text-white/80" />
      </Link>
    );
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-cyan-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-[#0077b6] via-[#00b4d8] to-[#0c4a6e] px-4 py-4 text-white">
        <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/70">
          <Sparkles className="h-3.5 w-3.5" />
          Always on top
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <SaOfficialLogo title="SupplierAdvisor" className="sa-logo-on-dark h-8 w-auto" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black tracking-tight">
              SupplierAdvisor
            </h2>
            <p className="text-[12px] text-white/85">
              The OS behind this app · www.supplieradvisor.com
            </p>
          </div>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-white/90">
          You use SA Member free. Businesses run trade, gym, clinic, hire and
          finance on the same OS. Open the demo, tap through a real day, then
          start a {COMPANY_TRIAL_DAYS}-day trial for your company.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 p-3">
        <Link
          href={SA_OS_DEMO_PATH}
          className="inline-flex min-w-[8rem] flex-1 items-center justify-center gap-1 rounded-xl bg-[#0077b6] px-3 py-2.5 text-xs font-black text-white"
        >
          Open demo
        </Link>
        <Link
          href="/onboarding?lane=b2b"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-800"
        >
          Start a company
        </Link>
      </div>
    </article>
  );
}
