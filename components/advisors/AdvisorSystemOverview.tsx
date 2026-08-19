'use client';

/**
 * High-level Advisor system overview — sits after the E2E process design.
 * Two columns: what the OS does for the business (Core + Advisor) and
 * for clients. Downloadable A4 one-pager.
 */
import { Download, Sparkles } from 'lucide-react';
import {
  advisorSystemOverview,
  advisorSystemOverviewPdfUrl,
  type AdvisorOverviewModule,
} from '@/lib/advisors/system-overview';

const ACCENT: Record<
  AdvisorOverviewModule,
  {
    hero: string;
    card: string;
    kicker: string;
    border: string;
  }
> = {
  medicalgraph: {
    hero: 'from-emerald-950 via-emerald-800 to-cyan-700',
    card: 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/40',
    kicker: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  physiograph: {
    hero: 'from-teal-950 via-teal-800 to-cyan-700',
    card: 'border-teal-200 bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/40',
    kicker: 'text-teal-800 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-800',
  },
  dentalgraph: {
    hero: 'from-sky-950 via-sky-800 to-cyan-700',
    card: 'border-sky-200 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/40',
    kicker: 'text-sky-800 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800',
  },
  psychiatrygraph: {
    hero: 'from-indigo-950 via-indigo-800 to-violet-700',
    card: 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/40',
    kicker: 'text-indigo-800 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
  },
  fitgraph: {
    hero: 'from-amber-950 via-amber-800 to-yellow-700',
    card: 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/40',
    kicker: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  hiregraph: {
    hero: 'from-violet-950 via-violet-800 to-fuchsia-700',
    card: 'border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/40',
    kicker: 'text-violet-800 dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-800',
  },
  retailgraph: {
    hero: 'from-orange-950 via-orange-800 to-amber-700',
    card: 'border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/40',
    kicker: 'text-orange-800 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
  },
};

export default function AdvisorSystemOverview({
  module,
}: {
  module: AdvisorOverviewModule;
}) {
  const copy = advisorSystemOverview(module);
  const a = ACCENT[module];
  const pdfHref = advisorSystemOverviewPdfUrl(module, { download: true });

  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-6 dark:border-neutral-800 dark:bg-neutral-950"
      aria-label={`${copy.brand} system overview`}
      id="advisor-system-overview"
    >
      <div className={`bg-gradient-to-r ${a.hero} px-5 py-4 text-white`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              System overview — why this OS
            </p>
            <h2 className="text-lg sm:text-xl font-black mt-0.5 leading-tight">
              {copy.headline}
            </h2>
            <p className="text-sm text-white/90 mt-1.5 max-w-3xl leading-snug">
              {copy.promise}
            </p>
          </div>
          <a
            href={pdfHref}
            className="inline-flex items-center gap-1.5 rounded-full bg-white text-slate-900 px-3.5 py-2 text-xs font-bold shadow-sm hover:bg-white/90 shrink-0"
            title="Download A4 one-pager"
          >
            <Download className="w-3.5 h-3.5" />
            One-pager PDF
          </a>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        <div className="grid lg:grid-cols-2 gap-4">
          <div className={`rounded-2xl border p-4 ${a.card}`}>
            <p className={`text-[10px] font-black uppercase tracking-wider ${a.kicker}`}>
              1 · Your business
            </p>
            <h3 className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
              Core OS + {copy.brand}
            </h3>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-3 mb-1.5">
              Core modules
            </p>
            <ul className="space-y-2">
              {copy.core.map((item) => (
                <li key={item.title}>
                  <p className="text-xs font-black text-slate-900 dark:text-white">
                    {item.title}
                  </p>
                  <p className="text-[12px] text-slate-600 dark:text-neutral-300 leading-snug">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-4 mb-1.5">
              {copy.brand}
            </p>
            <ul className="space-y-2">
              {copy.advisor.map((item) => (
                <li key={item.title}>
                  <p className="text-xs font-black text-slate-900 dark:text-white">
                    {item.title}
                  </p>
                  <p className="text-[12px] text-slate-600 dark:text-neutral-300 leading-snug">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-800 dark:bg-sky-950/30">
            <p className="text-[10px] font-black uppercase tracking-wider text-sky-800 dark:text-sky-300">
              2 · Your clients
            </p>
            <h3 className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
              What {copy.clientNoun} get
            </h3>
            <ul className="space-y-2.5 mt-3">
              {copy.clients.map((item) => (
                <li key={item.title}>
                  <p className="text-xs font-black text-slate-900 dark:text-white">
                    {item.title}
                  </p>
                  <p className="text-[12px] text-slate-600 dark:text-neutral-300 leading-snug">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-slate-500" />
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              How it enhances the business
            </h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {copy.enhance.map((item) => (
              <div
                key={item.title}
                className={`rounded-xl border bg-white px-3 py-2.5 dark:bg-neutral-950 ${a.border}`}
              >
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {item.title}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-neutral-400 mt-0.5 leading-snug">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            Money — who bills whom
          </p>
          <p className="text-sm text-slate-700 dark:text-emerald-50/90 mt-1 leading-snug">
            {copy.closer}
          </p>
        </div>
      </div>
    </section>
  );
}
