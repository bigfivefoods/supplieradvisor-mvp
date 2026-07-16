'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Compass,
  Layers,
  Sparkles,
  Shield,
  Bot,
} from 'lucide-react';
import {
  GUIDE_SECTIONS,
  SYSTEM_OVERVIEW,
  OS_PRINCIPLES,
} from '@/lib/guide/curriculum';
import { ProcessFlow, SystemPillars } from '@/components/guide/ProcessFlow';
import {
  LayerStackDiagram,
  TradeLoopDiagram,
  MoneyFlowDiagram,
  PrinciplesGrid,
  ModuleMapStrip,
} from '@/components/guide/GuideDiagrams';
import { GuideHero, GuideShell } from '@/components/guide/GuideChrome';
import { MODULE_NAV } from '@/lib/chrome/module-nav';

export default function SystemGuideHome() {
  return (
    <GuideShell>
      <GuideHero
        eyebrow="System how-to guide · full training academy"
        title="Master the supply-chain OS"
        titleAccent="module by module"
        description="A complete, practical handbook for SupplierAdvisor® — system story, design principles, architecture diagrams, trade loops, and every module with process flows, step-by-step how-tos, and live app links."
      />

      {/* Hero story */}
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-100 bg-gradient-to-br from-white via-sky-50/90 to-cyan-50 p-6 sm:p-8 mb-10 shadow-sm">
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[#00b4d8]/15 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#0077b6] mb-4">
            <GraduationCap className="w-3.5 h-3.5" />
            Start here · system story
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
            {SYSTEM_OVERVIEW.title}
          </h2>
          <p className="text-sm text-neutral-600 mb-6 max-w-2xl leading-relaxed">
            {SYSTEM_OVERVIEW.subtitle}
          </p>
          <ProcessFlow
            nodes={SYSTEM_OVERVIEW.masterFlow}
            title="Master value chain (every day)"
          />
        </div>
      </section>

      {/* Architecture stack */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-[#00b4d8]" />
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-400">
            Architecture layers
          </h2>
        </div>
        <LayerStackDiagram layers={SYSTEM_OVERVIEW.layers} />
      </section>

      {/* OS principles */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-[#00b4d8]" />
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-400">
            Operating principles
          </h2>
        </div>
        <p className="text-sm text-slate-600 mb-4 max-w-2xl">
          These rules apply across every module. Learn them once — they prevent
          80% of “why is this empty?” support moments.
        </p>
        <PrinciplesGrid principles={OS_PRINCIPLES} title="" />
      </section>

      {/* Pillars */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-[#00b4d8]" />
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-400">
            Six pillars of the OS
          </h2>
        </div>
        <SystemPillars items={SYSTEM_OVERVIEW.pillars} />
      </section>

      {/* Trade + money diagrams */}
      <section className="mb-10 space-y-4">
        <h2 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-400">
          Critical system diagrams
        </h2>
        <TradeLoopDiagram />
        <MoneyFlowDiagram />
      </section>

      {/* Golden path CTA */}
      <section className="mb-10">
        <Link
          href="/dashboard/guide/golden-path"
          className="block rounded-[2rem] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-6 sm:p-7 shadow-sm hover:border-violet-300 hover:shadow-md transition group"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-violet-800 mb-3">
            New companies · activation
          </div>
          <h2 className="text-xl font-black text-slate-900 group-hover:text-[#0077b6] transition">
            Get live in 3 days
          </h2>
          <p className="text-sm text-slate-600 mt-1.5 max-w-xl leading-relaxed">
            Golden path: profile → team → partners → first trade → rate →
            billing. Dashboard checklist auto-ticks. Founding free cohort for
            the earliest companies.
          </p>
          <span className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold text-violet-800">
            Open walkthrough <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
      </section>

      {/* How to use */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <Compass className="w-4 h-4 text-[#00b4d8]" />
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-400">
            How to use this guide
          </h2>
        </div>
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6 text-sm text-neutral-600 leading-relaxed space-y-2">
          <p>
            <strong className="text-slate-800">1. Internalise the system story</strong>{' '}
            — master flow, layers, and principles above.
          </p>
          <p>
            <strong className="text-slate-800">2. Train one module deeply</strong>{' '}
            — principles → flow diagram → step-by-step → Open in app → checklist.
          </p>
          <p>
            <strong className="text-slate-800">3. Practice the trade loop</strong>{' '}
            — buyer PO from supplier catalogue ↔ seller inbound accept ↔ OTIFEF ↔
            rate.
          </p>
          <p>
            <strong className="text-slate-800">4. Use the process rail + SAM</strong>{' '}
            — sticky verbs match this curriculum; SAM chips adapt per page.
          </p>
          <p>
            <strong className="text-slate-800">5. Measure “Done when”</strong> — every
            module ends with a graduation checklist.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <Link
            href="/dashboard/guide/sam"
            className="inline-flex items-center gap-1.5 font-bold text-[#0077b6] hover:underline"
          >
            <Bot className="w-3.5 h-3.5" />
            SAM AI coach training
          </Link>
          <Link
            href="/dashboard/guide/suppliers"
            className="font-bold text-slate-600 hover:underline"
          >
            Suppliers · catalogue PO
          </Link>
          <Link
            href="/dashboard/guide/customers"
            className="font-bold text-slate-600 hover:underline"
          >
            Customers · inbound
          </Link>
        </div>
      </section>

      {/* Module map strip */}
      <section className="mb-8">
        <ModuleMapStrip
          items={GUIDE_SECTIONS.map((s) => ({
            slug: s.slug,
            title: s.title,
            tagline: s.tagline,
          }))}
        />
      </section>

      {/* Training modules grid */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-[#00b4d8]" />
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-400">
            All training modules ({GUIDE_SECTIONS.length})
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
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-[#00b4d8]/10 border border-cyan-100 flex items-center justify-center text-[#0077b6] group-hover:bg-[#00b4d8] group-hover:text-white transition-colors shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black text-neutral-400 tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0077b6] truncate">
                        {s.title}
                      </h3>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-[#00b4d8] mt-1 shrink-0" />
                </div>
                <p className="mt-3 text-xs text-neutral-500 leading-relaxed">
                  {s.tagline}
                </p>
                {s.principles && s.principles.length > 0 && (
                  <p className="mt-2 text-[10px] font-semibold text-slate-400">
                    {s.principles.length} principles · {s.processes.length}{' '}
                    how-tos · {s.flow.length}-step flow
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-1">
                  {s.flow.slice(0, 6).map((f) => (
                    <span
                      key={f.id}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-50 border border-neutral-100 text-neutral-600"
                    >
                      {f.label}
                    </span>
                  ))}
                  {s.flow.length > 6 && (
                    <span className="text-[10px] text-neutral-400 px-1">
                      +{s.flow.length - 6}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mt-12 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-6 text-center">
        <p className="text-sm font-bold text-slate-800">
          Train with a second tab open on live data
        </p>
        <p className="text-xs text-neutral-500 mt-1 max-w-lg mx-auto leading-relaxed">
          Use a demo company. Follow Open in app from each how-to. Ask SAM when
          stuck. When you finish Suppliers + Customers, you understand the core
          of the OS.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard/guide/golden-path"
            className="btn-primary !py-2 !px-4 text-xs"
          >
            Start golden path
          </Link>
          <Link
            href="/dashboard/guide/suppliers"
            className="btn-secondary !py-2 !px-4 text-xs"
          >
            Suppliers deep dive
          </Link>
        </div>
      </div>
    </GuideShell>
  );
}
