'use client';

import { Building2, Factory, Landmark, Leaf, ShoppingBag, Truck } from 'lucide-react';

/** Industry / segment “logos” as branded tiles (no false third-party marks). */
const SEGMENTS = [
  { name: 'Food & beverage', icon: ShoppingBag },
  { name: 'Agri & inputs', icon: Leaf },
  { name: 'Manufacturing', icon: Factory },
  { name: 'Distribution', icon: Truck },
  { name: 'Public sector', icon: Landmark },
  { name: 'Multi-entity groups', icon: Building2 },
];

const METRICS = [
  { value: '14+', label: 'systems in one OS' },
  { value: '3', label: 'markets: B2B · B2G · B2C' },
  { value: '30d', label: 'full-platform trial' },
  { value: '1', label: 'workspace per company' },
  { value: '0', label: 'spreadsheet silos required' },
  { value: '∞', label: 'team seats on the company plan' },
];

export default function SocialProofStrip() {
  return (
    <section
      id="proof"
      className="scroll-mt-20 border-t border-slate-200 bg-white py-14 sm:py-16"
    >
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
        <p className="mb-6 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
          Built for operators across sectors
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {SEGMENTS.map((s) => (
            <div
              key={s.name}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm sm:text-sm"
            >
              <s.icon className="h-3.5 w-3.5 text-[#00b4d8]" />
              {s.name}
            </div>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {METRICS.map((m) => (
            <div
              key={m.label}
              className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-sky-50/40 px-3 py-4 text-center shadow-sm"
            >
              <div className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                {m.value}
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase leading-snug tracking-wider text-slate-500 sm:text-[11px]">
                {m.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
