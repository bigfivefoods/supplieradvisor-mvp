'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { GoldenPathSnapshot, GoldenStep } from '@/lib/schools/golden-path';

type Props = {
  companyId: number;
  compact?: boolean;
};

export default function GoldenPathStrip({ companyId, compact }: Props) {
  const [path, setPath] = useState<GoldenPathSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/schools/ops?companyId=${companyId}&view=path`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const data = await res.json();
      if (res.ok && data.path) setPath(data.path as GoldenPathSnapshot);
    } catch {
      /* soft */
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !path) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-cyan-500/25 dark:bg-gradient-to-br dark:from-[#061825] dark:via-[#0b2f44] dark:to-[#0a3d3a] dark:text-cyan-100/80">
        <Loader2 className="h-4 w-4 animate-spin text-[#00b4d8] dark:text-cyan-300" />{' '}
        Loading programme path…
      </div>
    );
  }
  if (!path) return null;

  // Light: soft tint. Dark: deep → bright gradient (no pale/white cards).
  const healthRing =
    path.health === 'green'
      ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-400/30 dark:bg-gradient-to-br dark:from-[#052e16] dark:via-[#065f46] dark:to-[#10b981]/55'
      : path.health === 'red'
        ? 'border-rose-200 bg-rose-50/70 dark:border-rose-400/30 dark:bg-gradient-to-br dark:from-[#2a0a14] dark:via-[#9f1239] dark:to-[#fb7185]/50'
        : 'border-amber-200 bg-amber-50/70 dark:border-amber-400/30 dark:bg-gradient-to-br dark:from-[#1c1003] dark:via-[#b45309] dark:to-[#fbbf24]/45';

  const pathLabel =
    path.role === 'agency'
      ? 'Golden path · Menu · catalogue · compliance · DBE'
      : path.role === 'isp'
        ? 'Golden path · School PO → procure → deliver · SP'
        : 'Golden path · Stock vs menu → PO → receive → serve · School';

  return (
    <div
      className={`mb-4 rounded-2xl border px-3 py-3 dark:shadow-[0_10px_28px_-12px_rgba(0,0,0,0.55)] ${healthRing}`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/85">
          {pathLabel}
        </p>
        <Link
          href={path.nextHref}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#0077b6] dark:text-cyan-200 dark:hover:text-cyan-100"
        >
          Next: {path.nextLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {path.steps.map((s, i) => (
          <StepChip
            key={s.id}
            step={s}
            compact={compact}
            showArrow={i < path.steps.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function StepChip({
  step,
  compact,
  showArrow,
}: {
  step: GoldenStep;
  compact?: boolean;
  showArrow: boolean;
}) {
  const cls =
    step.state === 'done'
      ? 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-300/40 dark:bg-gradient-to-br dark:from-emerald-950 dark:via-emerald-800 dark:to-emerald-500/70 dark:text-emerald-50'
      : step.state === 'active'
        ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm dark:border-cyan-300/50 dark:bg-gradient-to-br dark:from-cyan-600 dark:via-sky-500 dark:to-teal-400 dark:text-slate-950 dark:shadow-cyan-400/25'
        : step.state === 'blocked'
          ? 'border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-300/40 dark:bg-gradient-to-br dark:from-rose-950 dark:via-rose-800 dark:to-rose-500/70 dark:text-rose-50'
          : 'border-slate-200 bg-white text-slate-500 dark:border-cyan-500/20 dark:bg-gradient-to-br dark:from-[#0b1e33]/90 dark:via-[#0c3a4f]/70 dark:to-[#0a4a4a]/50 dark:text-cyan-100/75';

  return (
    <>
      <Link
        href={step.href}
        className={`min-w-[4.5rem] shrink-0 rounded-xl border px-2.5 py-1.5 ${cls}`}
        title={step.detail || step.label}
      >
        <p className="text-[10px] font-black uppercase tracking-wide">
          {step.short}
        </p>
        {!compact ? (
          <p className="max-w-[5.5rem] truncate text-[10px] opacity-90 dark:opacity-95">
            {step.detail || step.label}
          </p>
        ) : null}
      </Link>
      {showArrow ? (
        <span className="shrink-0 self-center text-xs text-slate-300 dark:text-cyan-200/50">
          →
        </span>
      ) : null}
    </>
  );
}
