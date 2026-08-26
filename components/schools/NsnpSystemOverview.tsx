'use client';

/**
 * High-level SchoolAdvisor system overview — sits ABOVE the E2E process.
 * Benefits for DBE, schools, service providers and children.
 * Default closed. A4 landscape + portrait downloads.
 */
import { useState } from 'react';
import { ChevronDown, Download, Landmark, Building2, Truck, Users } from 'lucide-react';
import {
  NSNP_SYSTEM_OVERVIEW,
  nsnpSystemOverviewPdfUrl,
  type OverviewAudienceId,
} from '@/lib/schools/nsnp-system-overview';

const ICONS: Record<OverviewAudienceId, typeof Landmark> = {
  dbe: Landmark,
  school: Building2,
  sp: Truck,
  children: Users,
};

const TONE: Record<
  OverviewAudienceId,
  { card: string; kicker: string; swatch: string }
> = {
  dbe: {
    card: 'border-sky-200 bg-sky-50/70 dark:border-cyan-700 dark:bg-sky-950/40',
    kicker: 'text-sky-800 dark:text-sky-300',
    swatch: 'bg-sky-500',
  },
  school: {
    card: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-950/40',
    kicker: 'text-emerald-800 dark:text-emerald-300',
    swatch: 'bg-emerald-500',
  },
  sp: {
    card: 'border-amber-200 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/40',
    kicker: 'text-amber-800 dark:text-amber-300',
    swatch: 'bg-amber-500',
  },
  children: {
    card: 'border-rose-200 bg-rose-50/70 dark:border-rose-700 dark:bg-rose-950/40',
    kicker: 'text-rose-800 dark:text-rose-300',
    swatch: 'bg-rose-500',
  },
};

export default function NsnpSystemOverview({
  defaultCollapsed = true,
}: {
  defaultCollapsed?: boolean;
}) {
  const copy = NSNP_SYSTEM_OVERVIEW;
  const [open, setOpen] = useState(!defaultCollapsed);

  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-4 dark:border-cyan-500/25 dark:bg-gradient-to-br dark:from-[#061825] dark:via-[#0b2f44] dark:to-[#0a3d3a]"
      aria-label="SchoolAdvisor system overview — benefits for DBE, schools, service providers and children"
      id="nsnp-system-overview"
    >
      <div className="bg-gradient-to-r from-[#023e8a] via-[#0077b6] to-[#00b4d8] px-5 py-4 text-white">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-left min-w-0 flex-1"
            aria-expanded={open}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              System overview — why this OS
            </p>
            <h2 className="text-lg sm:text-xl font-black mt-0.5 leading-tight">
              {copy.headline}
            </h2>
            <p className="text-sm text-white/90 mt-1.5 max-w-3xl leading-snug">
              {copy.promise}
            </p>
          </button>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={nsnpSystemOverviewPdfUrl('landscape', { download: true })}
              className="inline-flex items-center gap-1.5 rounded-full bg-white text-[#0077b6] px-3.5 py-2 text-xs font-bold shadow-sm hover:bg-sky-50"
              title="Download A4 landscape system overview"
            >
              <Download className="w-3.5 h-3.5" />
              Landscape
            </a>
            <a
              href={nsnpSystemOverviewPdfUrl('portrait', { download: true })}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/90 text-[#0077b6] px-3.5 py-2 text-xs font-bold shadow-sm border border-white/40 hover:bg-sky-50"
              title="Download A4 portrait system overview"
            >
              <Download className="w-3.5 h-3.5" />
              Portrait
            </a>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-white/25"
            >
              {open ? 'Hide' : 'Show'} overview
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  open ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div className="p-4 sm:p-6 space-y-5">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {copy.audiences.map((a) => {
              const Icon = ICONS[a.id];
              const tone = TONE[a.id];
              return (
                <div
                  key={a.id}
                  className={`rounded-2xl border p-4 flex flex-col ${tone.card}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${tone.swatch}`}
                      aria-hidden
                    />
                    <p
                      className={`text-[10px] font-black uppercase tracking-wider ${tone.kicker}`}
                    >
                      {a.kicker}
                    </p>
                  </div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    {a.title}
                  </h3>
                  <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug mt-1">
                    {a.promise}
                  </p>
                  <ul className="mt-3 space-y-2.5 flex-1">
                    {a.benefits.map((b) => (
                      <li key={b.title}>
                        <p className="text-xs font-black text-slate-900 dark:text-white">
                          {b.title}
                        </p>
                        <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug">
                          {b.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 dark:border-cyan-800 dark:bg-sky-950/40">
            {copy.closer}
          </p>
        </div>
      ) : null}
    </section>
  );
}
