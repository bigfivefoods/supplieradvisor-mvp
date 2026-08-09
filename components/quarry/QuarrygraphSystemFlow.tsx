'use client';

/**
 * End-to-end Quarrygraph® process:
 * Sites → Reserves → Production → Plant → Stock → Dispatch → Sold & compliant
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronDown,
  HardHat,
  Mountain,
  Scale,
  ShieldCheck,
  Truck,
} from 'lucide-react';

type Props = { defaultCollapsed?: boolean };

const CHAIN = [
  { label: 'Sites & permits', sub: 'Pits · rights · EMP' },
  { label: 'Reserves', sub: 'Survey · grade' },
  { label: 'Production plan', sub: 'Blast · load' },
  { label: 'Plant & stock', sub: 'Crush · piles' },
  { label: 'Dispatch', sub: 'Weighbridge · ticket' },
  { label: 'Sold & proven', sub: 'QA · customer' },
];

const PHASES = [
  {
    title: '1 · Sites, faces & compliance',
    steps: [
      { t: 'Register pits / faces', h: '/dashboard/quarrygraph/sites' },
      { t: 'Mining right · WUL · EMP', h: '/dashboard/quarrygraph/compliance' },
      { t: 'Products & grades', h: '/dashboard/quarrygraph/products' },
    ],
  },
  {
    title: '2 · Reserves & production plan',
    steps: [
      { t: 'Reserve estimates', h: '/dashboard/quarrygraph/reserves' },
      { t: 'Sequence & daily allocation', h: '/dashboard/quarrygraph/production' },
      { t: 'Blast logs', h: '/dashboard/quarrygraph/production' },
    ],
  },
  {
    title: '3 · Crushing, stock & dispatch',
    steps: [
      { t: 'Plant runs', h: '/dashboard/quarrygraph/plant' },
      { t: 'Stockpiles', h: '/dashboard/quarrygraph/plant' },
      { t: 'Weighbridge tickets', h: '/dashboard/quarrygraph/dispatch' },
    ],
  },
  {
    title: '4 · Ops cost, quality & reports',
    steps: [
      { t: 'Fleet & fuel', h: '/dashboard/quarrygraph/fleet' },
      { t: 'Labour rates', h: '/dashboard/quarrygraph/labour' },
      { t: 'Lab QA · slice & dice', h: '/dashboard/quarrygraph/report' },
    ],
  },
];

export default function QuarrygraphSystemFlow({
  defaultCollapsed = false,
}: Props) {
  const [open, setOpen] = useState(!defaultCollapsed);

  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-6"
      id="quarrygraph-system-flow"
    >
      <div className="bg-gradient-to-r from-stone-800 via-amber-900 to-orange-700 px-5 py-4 text-white">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-left min-w-0 flex-1"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              Full quarry OS — process design
            </p>
            <h2 className="text-lg sm:text-xl font-black mt-0.5 leading-tight">
              Sites → Reserves → Production → Plant → Dispatch → Sold & compliant
            </h2>
            <p className="text-sm text-white/90 mt-1.5 max-w-3xl leading-snug">
              Shared site master feeds reserves and production; plant and
              stockpiles feed the weighbridge; quality and permits sit next to
              every tonne sold.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-white/25 shrink-0"
          >
            {open ? 'Hide' : 'Show'} full process
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {open ? (
        <div className="p-4 sm:p-6 space-y-8">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {CHAIN.map((n, i) => (
              <div key={n.label} className="contents">
                <div className="rounded-2xl border border-amber-100 bg-amber-50/60 px-3 py-2 min-w-[6.5rem] text-center">
                  <p className="text-xs font-black text-slate-900">{n.label}</p>
                  <p className="text-[10px] text-slate-500 font-semibold">
                    {n.sub}
                  </p>
                </div>
                {i < CHAIN.length - 1 ? (
                  <ArrowRight className="w-4 h-4 text-slate-300 hidden sm:block" />
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {[
              {
                icon: Mountain,
                t: 'Quarry office',
                b: 'Sites, reserves, production plan, permits, reports',
              },
              {
                icon: HardHat,
                t: 'Plant & pit ops',
                b: 'Blasts, crushing, stockpiles, fleet, labour rates',
              },
              {
                icon: Scale,
                t: 'Dispatch & trade',
                b: 'Weighbridge tickets, customers, destinations, QA',
              },
            ].map((c) => (
              <div
                key={c.t}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
              >
                <c.icon className="w-5 h-5 text-amber-800 mb-2" />
                <p className="text-sm font-black">{c.t}</p>
                <p className="text-[12px] text-slate-600 mt-1">{c.b}</p>
              </div>
            ))}
          </div>

          {PHASES.map((ph) => (
            <div key={ph.title}>
              <h4 className="text-sm font-black text-slate-900 mb-2">
                {ph.title}
              </h4>
              <div className="flex flex-col sm:flex-row gap-2">
                {ph.steps.map((s) => (
                  <Link
                    key={s.t}
                    href={s.h}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold hover:border-amber-300 hover:bg-amber-50/40"
                  >
                    {s.t}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              <h3 className="text-sm font-black text-emerald-950">
                Guardrails
              </h3>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[12px] text-slate-700">
              <p>One site code across reserves, blasts, plant and dispatch.</p>
              <p>Dispatch can deduct stockpile balance when ticketed.</p>
              <p>Permits auto-flag expiring / expired from dates.</p>
              <p>Labour stores rate + cost for field profitability.</p>
              <p>QA pass/fail sits next to product and site.</p>
              <p>Production dates from sequence + daily t allocation.</p>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-snug flex gap-2">
            <Truck className="w-5 h-5 text-amber-800 shrink-0" />
            <span>
              <strong>One sentence:</strong> Register pits and products → survey
              reserves → plan blasts and daily tonnes → crush to stockpiles →
              weighbridge dispatch with QA and valid permits → report cost and
              yield by product.
            </span>
          </p>
        </div>
      ) : null}
    </section>
  );
}
