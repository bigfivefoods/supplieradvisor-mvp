'use client';

import Link from 'next/link';
import { ArrowRight, Award, Brain, Sparkles, Users2 } from 'lucide-react';

export default function SuperCubeStory() {
  return (
    <section
      id="super-cube"
      className="scroll-mt-20 border-t border-slate-200 bg-gradient-to-b from-white via-violet-50/40 to-white py-20 sm:py-28"
    >
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-600">
              Super-Cube® · leadership
            </p>
            <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 sm:text-4xl md:text-5xl">
              Software for the chain.
              <span className="mt-2 block text-violet-600">
                Development for the humans who run it.
              </span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">
              Super-Cube® is a doctoral leadership model embedded in the product —
              so teams grow decision quality alongside OTIFEF, cost centres, and
              compliance. Pair it with SAM (Grok) for in-app how-to.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Leadership development inside the same workspace as ops',
                'Intelligence pulse across network, supply, demand, and finance',
                'Guide curriculum for every module — ramp without a manual',
              ].map((t) => (
                <li key={t} className="flex gap-2 text-sm text-slate-700">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/onboarding?type=business"
                className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 text-sm font-bold text-white hover:bg-violet-700"
              >
                Join the network <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-6 py-3 text-sm font-bold text-violet-900 hover:border-violet-400"
              >
                See product demo
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
            {[
              {
                icon: Award,
                t: 'Doctoral Super-Cube®',
                b: 'A structured model for leaders who compound better decisions under complexity.',
              },
              {
                icon: Brain,
                t: 'Enterprise intelligence',
                b: 'Pulse, forecasts, and scorecards wired to the same data as POs and stock.',
              },
              {
                icon: Users2,
                t: 'Team that can operate',
                b: 'Roles, guide chapters, and SAM answers — fewer hero accounts, more bench strength.',
              },
              {
                icon: Sparkles,
                t: 'Press & purpose',
                b: 'Africa-ready trade with ethical sourcing, food impact, and transparent networks.',
              },
            ].map((c) => (
              <div
                key={c.t}
                className="rounded-3xl border border-violet-100 bg-white p-6 shadow-sm"
              >
                <c.icon className="mb-3 h-5 w-5 text-violet-600" />
                <h3 className="font-bold text-slate-900">{c.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.b}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
