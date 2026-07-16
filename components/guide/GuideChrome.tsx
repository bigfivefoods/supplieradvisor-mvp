'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  MapPin,
  Target,
  Users,
} from 'lucide-react';
import type { GuideSection } from '@/lib/guide/curriculum';
import { ProcessFlow } from '@/components/guide/ProcessFlow';
import { PrinciplesGrid } from '@/components/guide/GuideDiagrams';

export function GuideShell({ children }: { children: React.ReactNode }) {
  return <div className="sa-page max-w-5xl mx-auto pb-16">{children}</div>;
}

export function GuideHero({
  eyebrow,
  title,
  titleAccent,
  description,
}: {
  eyebrow: string;
  title: string;
  titleAccent?: string;
  description: string;
}) {
  return (
    <header className="mb-8">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400 mb-2">
        {eyebrow}
      </p>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 leading-[1.1]">
        {title}
        {titleAccent ? (
          <>
            {' '}
            <span className="text-[#00b4d8]">{titleAccent}</span>
          </>
        ) : null}
      </h1>
      <p className="mt-3 text-sm sm:text-base text-neutral-600 leading-relaxed max-w-2xl">
        {description}
      </p>
    </header>
  );
}

export function SectionTraining({
  section,
  prev,
  next,
}: {
  section: GuideSection;
  prev?: { slug: string; title: string };
  next?: { slug: string; title: string };
}) {
  return (
    <GuideShell>
      <Link
        href="/dashboard/guide"
        className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-[#0077b6] mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 text-[#00b4d8] group-hover:-translate-x-0.5 transition-transform" />
        All modules
      </Link>

      <GuideHero
        eyebrow="Training module"
        title={section.title}
        titleAccent="how-to"
        description={section.tagline}
      />

      <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-sky-50/80 to-cyan-50 p-5 sm:p-6 mb-8 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0077b6] mb-2">
          Why this module exists
        </p>
        <p className="text-sm text-slate-700 leading-relaxed">{section.purpose}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {section.who.map((w) => (
            <span
              key={w}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white border border-cyan-100 text-slate-700"
            >
              <Users className="w-3 h-3 text-[#00b4d8]" />
              {w}
            </span>
          ))}
        </div>
      </div>

      {section.principles && section.principles.length > 0 && (
        <PrinciplesGrid principles={section.principles} />
      )}

      {section.outcomes && section.outcomes.length > 0 && (
        <div className="mb-10 rounded-3xl border border-violet-100 bg-violet-50/40 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-violet-600" />
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-violet-800/80">
              Outcomes after this module
            </h2>
          </div>
          <ul className="grid sm:grid-cols-2 gap-2">
            {section.outcomes.map((o) => (
              <li
                key={o}
                className="flex gap-2 text-sm text-violet-950"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-violet-600 mt-0.5" />
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-400 mb-3">
        Process flow diagram
      </h2>
      <div className="mb-10">
        <ProcessFlow nodes={section.flow} title="Critical path" />
      </div>

      <h2 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-400 mb-3">
        How to apply — step by step
      </h2>
      <div className="space-y-4 mb-10">
        {section.processes.map((p, i) => (
          <article
            key={p.name}
            className="rounded-3xl border border-neutral-200 bg-white overflow-hidden shadow-sm"
          >
            <div className="px-5 py-4 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="text-[10px] font-black text-[#00b4d8] mr-2">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="inline text-base font-bold text-slate-900">
                  {p.name}
                </h3>
              </div>
              {p.href && (
                <Link
                  href={p.href}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0077b6] hover:underline"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Open in app
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-neutral-600 mb-3 leading-relaxed">
                {p.summary}
              </p>
              <ol className="space-y-2">
                {p.steps.map((s, j) => (
                  <li key={j} className="flex gap-3 text-sm text-slate-800">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#00b4d8]/10 text-[10px] font-black text-[#00b4d8]">
                      {j + 1}
                    </span>
                    <span className="leading-relaxed pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
              {p.tip && (
                <div className="mt-4 flex gap-2 rounded-2xl border border-amber-100 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-950">
                  <Lightbulb className="w-4 h-4 shrink-0 text-amber-600" />
                  <p className="leading-relaxed">
                    <strong>Tip:</strong> {p.tip}
                  </p>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {section.concepts && section.concepts.length > 0 && (
        <>
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-400 mb-3">
            Key terms
          </h2>
          <dl className="grid sm:grid-cols-2 gap-3 mb-10">
            {section.concepts.map((c) => (
              <div
                key={c.term}
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-3"
              >
                <dt className="text-xs font-bold text-[#0077b6]">{c.term}</dt>
                <dd className="text-xs text-neutral-600 mt-1 leading-relaxed">
                  {c.meaning}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <h2 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-400 mb-3">
        Done when
      </h2>
      <ul className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-5 space-y-2.5 mb-10">
        {section.checklist.map((c) => (
          <li key={c} className="flex gap-2.5 text-sm text-emerald-950">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            {c}
          </li>
        ))}
      </ul>

      {section.related && section.related.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-400 mb-3">
            Related training
          </h2>
          <div className="flex flex-wrap gap-2">
            {section.related.map((slug) => (
              <Link
                key={slug}
                href={`/dashboard/guide/${slug}`}
                className="text-xs font-bold rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-[#00b4d8] hover:text-[#0077b6]"
              >
                {slug.replace(/-/g, ' ')}
              </Link>
            ))}
          </div>
        </div>
      )}

      <nav className="flex flex-col sm:flex-row gap-3 justify-between">
        {prev ? (
          <Link
            href={`/dashboard/guide/${prev.slug}`}
            className="flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 hover:border-[#00b4d8]/40 transition-colors"
          >
            <div className="text-[10px] font-bold uppercase text-neutral-400">
              Previous
            </div>
            <div className="text-sm font-semibold text-slate-800 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> {prev.title}
            </div>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
        {next ? (
          <Link
            href={`/dashboard/guide/${next.slug}`}
            className="flex-1 rounded-2xl border border-cyan-100 bg-[#00b4d8]/5 px-4 py-3 hover:border-[#00b4d8] transition-colors text-right"
          >
            <div className="text-[10px] font-bold uppercase text-[#0077b6]">
              Next
            </div>
            <div className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1">
              {next.title} <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        ) : (
          <Link
            href="/dashboard/guide"
            className="flex-1 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-right"
          >
            <div className="text-[10px] font-bold uppercase text-emerald-700">
              Complete
            </div>
            <div className="text-sm font-semibold text-emerald-900">
              Back to guide home
            </div>
          </Link>
        )}
      </nav>
    </GuideShell>
  );
}
