'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Compass,
  Layers,
} from 'lucide-react';
import {
  GUIDE_SECTIONS,
  SYSTEM_OVERVIEW,
} from '@/lib/guide/curriculum';
import { ProcessFlow, SystemPillars } from '@/components/guide/ProcessFlow';
import { GuideHero, GuideShell } from '@/components/guide/GuideChrome';
import { MODULE_NAV } from '@/lib/chrome/module-nav';

export default function SystemGuideHome() {
  return (
    <GuideShell>
      <GuideHero
        eyebrow="System how-to guide · training"
        title="Learn the platform"
        titleAccent="end to end"
        description="A practical training path for every module and critical process — with flow diagrams, step-by-step how-tos, and links that open the real workbenches."
      />

      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-100 bg-gradient-to-br from-white via-sky-50/90 to-cyan-50 p-6 sm:p-8 mb-10 shadow-sm">
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[#00b4d8]/15 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#0077b6] mb-4">
            <GraduationCap className="w-3.5 h-3.5" />
            Start here
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
            {SYSTEM_OVERVIEW.title}
          </h2>
          <p className="text-sm text-neutral-600 mb-6 max-w-2xl leading-relaxed">
            {SYSTEM_OVERVIEW.subtitle}
          </p>
          <ProcessFlow nodes={SYSTEM_OVERVIEW.masterFlow} title="Master value chain" />
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-[#00b4d8]" />
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-400">
            Five pillars
          </h2>
        </div>
        <SystemPillars items={SYSTEM_OVERVIEW.pillars} />
      </section>

      <section className="mb-10">
        <Link
          href="/dashboard/guide/golden-path"
          className="block rounded-[2rem] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-6 sm:p-7 shadow-sm hover:border-violet-300 hover:shadow-md transition group"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-violet-800 mb-3">
            New companies
          </div>
          <h2 className="text-xl font-black text-slate-900 group-hover:text-[#0077b6] transition">
            Get live in 3 days
          </h2>
          <p className="text-sm text-slate-600 mt-1.5 max-w-xl leading-relaxed">
            Golden path training: profile → team → partners → first trade → rate
            → billing. The dashboard checklist auto-ticks as you work.
          </p>
          <span className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold text-violet-800">
            Open walkthrough <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
      </section>

      <section className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <Compass className="w-4 h-4 text-[#00b4d8]" />
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-400">
            How to use this guide
          </h2>
        </div>
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6 text-sm text-neutral-600 leading-relaxed space-y-2">
          <p>
            <strong className="text-slate-800">1. Read the system story</strong> — the master flow
            above is the mental model for every day.
          </p>
          <p>
            <strong className="text-slate-800">2. Train one module</strong> — open a card below;
            follow the process diagram, then do the steps in the live app via Open in app.
          </p>
          <p>
            <strong className="text-slate-800">3. Tick “Done when”</strong> — each module ends with a
            short checklist so training is measurable.
          </p>
          <p>
            <strong className="text-slate-800">4. Use the process rail</strong> — after training,
            the sticky top bar shows the same critical verbs for the module you are in.
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-[#00b4d8]" />
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-400">
            Training modules
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {GUIDE_SECTIONS.map((s, i) => {
            const nav = MODULE_NAV.find((m) => m.id === s.moduleId);
            const Icon = nav?.icon || BookOpen;
            return (
              <Link
                key={s.slug}
                href={`/dashboard/guide/${s.slug}`}
                className="group rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-[#00b4d8]/50 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#00b4d8]/10 border border-cyan-100 flex items-center justify-center text-[#0077b6] group-hover:bg-[#00b4d8] group-hover:text-white transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-neutral-400 tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0077b6]">
                        {s.title}
                      </h3>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-[#00b4d8] mt-1 shrink-0" />
                </div>
                <p className="mt-3 text-xs text-neutral-500 leading-relaxed">{s.tagline}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {s.flow.slice(0, 5).map((f) => (
                    <span
                      key={f.id}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-50 border border-neutral-100 text-neutral-600"
                    >
                      {f.label}
                    </span>
                  ))}
                  {s.flow.length > 5 && (
                    <span className="text-[10px] text-neutral-400 px-1">+{s.flow.length - 5}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <p className="mt-10 text-center text-[11px] text-neutral-400">
        Tip: keep Guide open in a second tab while you practice on real data in a demo company.
      </p>
    </GuideShell>
  );
}
