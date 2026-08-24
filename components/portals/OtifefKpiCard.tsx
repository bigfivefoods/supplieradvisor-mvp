'use client';

import { otifefBand } from '@/lib/suppliers/types';
import type { OtifefMetrics } from '@/lib/suppliers/types';
import {
  OTIFEF_FORMULA,
  OTIFEF_STEPS,
  otifefExplainFor,
} from '@/lib/portals/otifef-explain';

function pct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${Math.round(Number(n))}%`;
}

export function OtifefKpiCard({
  metrics,
  kind,
  title,
}: {
  metrics?: OtifefMetrics | null;
  kind: 'customer' | 'supplier';
  title?: string;
}) {
  const ot = metrics || {
    overall: 0,
    onTime: 0,
    inFull: 0,
    errorFree: 0,
    totalPOs: 0,
    supplierCount: 0,
  };
  const band = otifefBand(ot.overall || 0);
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <div className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
              {title || 'OTIFEF'}
            </p>
            <p className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">
              {pct(ot.overall)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
              {otifefExplainFor(kind)}
              {ot.totalPOs
                ? ` · ${ot.totalPOs} delivered order${ot.totalPOs === 1 ? '' : 's'}`
                : ' · no delivered orders in this window yet'}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${band.className}`}
          >
            {band.label}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ['On time', ot.onTime],
            ['In full', ot.inFull],
            ['Error-free', ot.errorFree],
          ].map(([label, v]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-slate-100 bg-slate-50 px-2 py-2 dark:border-white/10 dark:bg-black/30"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {label}
              </div>
              <div className="text-lg font-black tabular-nums text-slate-900 dark:text-white">
                {pct(v as number)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-black/30">
        <p className="font-mono text-[11px] font-bold text-[#0077b6]">
          {OTIFEF_FORMULA}
        </p>
        <ul className="mt-2 space-y-1.5 text-[12px] leading-snug text-slate-600 dark:text-neutral-300">
          {OTIFEF_STEPS.map((s) => (
            <li key={s.label}>
              <span className="font-bold text-slate-800 dark:text-white">
                {s.label}.
              </span>{' '}
              {s.body}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
