'use client';

import { ChevronRight } from 'lucide-react';
import type { FlowNode } from '@/lib/guide/curriculum';

const TONES: Record<NonNullable<FlowNode['tone']>, string> = {
  cyan: 'border-cyan-200 bg-gradient-to-br from-cyan-50 to-white text-cyan-950',
  emerald: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-950',
  amber: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-950',
  violet: 'border-violet-200 bg-gradient-to-br from-violet-50 to-white text-violet-950',
  rose: 'border-rose-200 bg-gradient-to-br from-rose-50 to-white text-rose-950',
  slate: 'border-slate-200 bg-gradient-to-br from-slate-50 to-white text-slate-900',
};

/**
 * Horizontal process flowchart — training-friendly, no external diagram lib.
 */
export function ProcessFlow({
  nodes,
  title,
}: {
  nodes: FlowNode[];
  title?: string;
}) {
  return (
    <div className="rounded-3xl border border-cyan-100/80 bg-white p-4 sm:p-6 shadow-sm">
      {title && (
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400 mb-3">
          {title}
        </p>
      )}
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {nodes.map((n, i) => (
          <div key={n.id} className="flex items-center shrink-0">
            <div
              className={`min-w-[7.5rem] max-w-[9.5rem] rounded-2xl border px-3 py-3 shadow-sm ${
                TONES[n.tone || 'cyan']
              }`}
            >
              <div className="text-[10px] font-black uppercase tracking-wider opacity-60 mb-0.5">
                {String(i + 1).padStart(2, '0')}
              </div>
              <div className="text-sm font-black tracking-tight leading-tight">{n.label}</div>
              {n.hint && (
                <div className="text-[11px] mt-1 opacity-70 leading-snug font-medium">{n.hint}</div>
              )}
            </div>
            {i < nodes.length - 1 && (
              <ChevronRight
                className="w-5 h-5 text-neutral-300 mx-0.5 sm:mx-1 shrink-0"
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Vertical swim for master system story */
export function SystemPillars({
  items,
}: {
  items: Array<{ title: string; body: string }>;
}) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((p, i) => (
        <div
          key={p.title}
          className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-[#00b4d8]/40 transition-colors"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#00b4d8]/10 text-[11px] font-black text-[#00b4d8]">
              {i + 1}
            </span>
            <h3 className="text-sm font-bold text-slate-900">{p.title}</h3>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">{p.body}</p>
        </div>
      ))}
    </div>
  );
}
