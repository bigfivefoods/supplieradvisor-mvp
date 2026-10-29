'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { MODULE_NAV } from '@/lib/chrome/module-nav';

const SCREENS: Record<string, string> = {
  '/dashboard/fitgraph': '/preview/fitgraph/collections',
  '/dashboard/fitgraph/collections': '/preview/fitgraph/collections',
  '/dashboard/fitgraph/debit-orders': '/preview/fitgraph/debit-orders',
  '/dashboard/fitgraph/billing-runs': '/preview/fitgraph/billing-runs',
  '/dashboard/fitgraph/netcash': '/preview/fitgraph/netcash',
};

export function PreviewFrame({ screen, children }: { screen: string; children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  const steps = MODULE_NAV.find((mod) => mod.id === 'fitgraph')?.steps || [];
  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2 md:hidden">
        <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-2 font-bold" aria-expanded={menu} onClick={() => setMenu((value) => !value)}>
          {menu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          GymAdvisor®
        </button>
        <p className="text-xs font-bold text-slate-500">Sample</p>
      </div>
      <div className="md:grid md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className={`${menu ? 'block' : 'hidden'} border-slate-200 bg-white md:sticky md:top-0 md:block md:h-screen md:overflow-auto md:border-r`}>
          <p className="px-4 pt-4 text-xs font-black uppercase tracking-wide text-[#0077b6]">GymAdvisor®</p>
          <ul className="space-y-1 p-3">
            {steps.map((step) => {
              const href = SCREENS[step.href] || '/preview/fitgraph/collections';
              const active = step.href.endsWith(screen) || (screen === 'collections' && step.href.endsWith('/collections'));
              return (
                <li key={step.href}>
                  <Link href={href} className={`flex min-h-11 items-center rounded-2xl px-3 text-sm font-bold ${active ? 'bg-[#00b4d8] text-[#0f172a]' : 'text-slate-800'}`}>
                    {step.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>
        <main className="min-w-0 px-4 py-5 sm:px-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Sample gym · Harbour Athletic · not a live debit</p>
          {children}
        </main>
      </div>
    </div>
  );
}
