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
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading supply path…
      </div>
    );
  }
  if (!path) return null;

  const healthRing =
    path.health === 'green'
      ? 'border-emerald-200 bg-emerald-50/60'
      : path.health === 'red'
        ? 'border-rose-200 bg-rose-50/70'
        : 'border-amber-200 bg-amber-50/70';

  return (
    <div className={`mb-4 rounded-2xl border ${healthRing} px-3 py-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Golden path · {path.role === 'isp' ? 'SP' : path.role === 'agency' ? 'DBE' : 'School'}
        </p>
        <Link
          href={path.nextHref}
          className="text-xs font-bold text-[#0077b6] inline-flex items-center gap-1"
        >
          Next: {path.nextLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {path.steps.map((s, i) => (
          <StepChip key={s.id} step={s} compact={compact} showArrow={i < path.steps.length - 1} />
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
      ? 'border-emerald-300 bg-emerald-100 text-emerald-900'
      : step.state === 'active'
        ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm'
        : step.state === 'blocked'
          ? 'border-rose-300 bg-rose-100 text-rose-900'
          : 'border-slate-200 bg-white text-slate-500';

  return (
    <>
      <Link
        href={step.href}
        className={`shrink-0 rounded-xl border px-2.5 py-1.5 min-w-[4.5rem] ${cls}`}
        title={step.detail || step.label}
      >
        <p className="text-[10px] font-black uppercase tracking-wide">
          {step.short}
        </p>
        {!compact ? (
          <p className="text-[10px] opacity-90 truncate max-w-[5.5rem]">
            {step.detail || step.label}
          </p>
        ) : null}
      </Link>
      {showArrow ? (
        <span className="text-slate-300 self-center text-xs shrink-0">→</span>
      ) : null}
    </>
  );
}
