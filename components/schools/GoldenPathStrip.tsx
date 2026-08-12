'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { GoldenPathSnapshot, GoldenStep } from '@/lib/schools/golden-path';

type Props = {
  companyId: number;
  compact?: boolean;
};

/**
 * Programme golden path strip.
 * Light: soft pastel tints. Dark: deep → bright colour gradients
 * (globals.css remaps light pastel utilities; explicit dark: classes for chips).
 */
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
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-sky-50 px-4 py-3 text-sm text-slate-600 dark:border-cyan-400/35 dark:bg-gradient-to-br dark:from-[#042f2e] dark:via-[#0e7490] dark:to-[#22d3ee] dark:text-cyan-50">
        <Loader2 className="h-4 w-4 animate-spin text-[#00b4d8] dark:text-cyan-100" />{' '}
        Loading programme path…
      </div>
    );
  }
  if (!path) return null;

  // Light soft tint. Dark: deep → bright (no pale grey / white slabs).
  const healthRing =
    path.health === 'green'
      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/40 dark:bg-gradient-to-br dark:from-[#022c22] dark:via-[#047857] dark:to-[#34d399] dark:shadow-[0_10px_28px_-12px_rgba(16,185,129,0.35)]'
      : path.health === 'red'
        ? 'border-rose-200 bg-rose-50 dark:border-rose-400/40 dark:bg-gradient-to-br dark:from-[#4c0519] dark:via-[#be123c] dark:to-[#fb7185] dark:shadow-[0_10px_28px_-12px_rgba(244,63,94,0.35)]'
        : 'border-amber-200 bg-amber-50 dark:border-amber-400/40 dark:bg-gradient-to-br dark:from-[#451a03] dark:via-[#b45309] dark:to-[#fbbf24] dark:shadow-[0_10px_28px_-12px_rgba(245,158,11,0.35)]';

  const pathLabel =
    path.role === 'agency'
      ? 'Golden path · Menu · catalogue · compliance · DBE'
      : path.role === 'isp'
        ? 'Golden path · School PO → procure → deliver · SP'
        : 'Golden path · Stock vs menu → PO → receive → serve · School';

  return (
    <div className={`mb-4 rounded-2xl border px-3 py-3 ${healthRing}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-white">
          {pathLabel}
        </p>
        <Link
          href={path.nextHref}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#0077b6] dark:text-white dark:underline dark:decoration-white/40 dark:underline-offset-2 dark:hover:text-cyan-50"
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
      ? 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-300/50 dark:bg-gradient-to-br dark:from-emerald-950 dark:via-emerald-700 dark:to-emerald-400 dark:text-white'
      : step.state === 'active'
        ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm dark:border-cyan-200/60 dark:bg-gradient-to-br dark:from-cyan-700 dark:via-sky-500 dark:to-teal-300 dark:text-slate-950 dark:shadow-cyan-400/30'
        : step.state === 'blocked'
          ? 'border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-300/50 dark:bg-gradient-to-br dark:from-rose-950 dark:via-rose-700 dark:to-rose-400 dark:text-white'
          : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-cyan-300/30 dark:bg-gradient-to-br dark:from-[#0b1e33] dark:via-[#0c4a6e] dark:to-[#0891b2] dark:text-cyan-50';

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
          <p className="max-w-[5.5rem] truncate text-[10px] opacity-95">
            {step.detail || step.label}
          </p>
        ) : null}
      </Link>
      {showArrow ? (
        <span className="shrink-0 self-center text-xs text-slate-300 dark:text-white/60">
          →
        </span>
      ) : null}
    </>
  );
}
