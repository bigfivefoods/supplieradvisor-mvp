'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import {
  PROCESS_STAGES,
  type ProcessRole,
  type ReadinessCheck,
} from '@/lib/schools/process';

type Props = {
  role?: ProcessRole;
  checks?: ReadinessCheck[];
  score?: number;
  compact?: boolean;
};

/** Visual NSNP journey for principals — stage chips + readiness score. */
export default function NsnpProcessRail({
  role = 'school',
  checks = [],
  score,
  compact,
}: Props) {
  const byStage = new Map<string, { done: number; total: number }>();
  for (const c of checks) {
    // map check ids to stages roughly
    const stage =
      c.id === 'profile' ||
      c.id === 'photo' ||
      c.id === 'agency' ||
      c.id === 'packaging'
        ? 'setup'
        : c.id === 'learners' || c.id === 'verify'
          ? 'register'
          : c.id === 'menu' ||
              c.id === 'calendar' ||
              c.id === 'recipes' ||
              c.id === 'approved'
            ? 'catalogue'
            : c.id === 'isp' || c.id === 'isp_sla' || c.id === 'orders'
              ? 'supply'
              : c.id === 'stock' ||
                  c.id === 'kitchen' ||
                  c.id === 'cover' ||
                  c.id === 'kitchen_safety'
                ? 'kitchen'
                : c.id === 'serve' || c.id === 'serve_day'
                  ? 'serve'
                  : c.id === 'claims' || c.id === 'prizes' || c.id === 'audit'
                    ? 'fund'
                    : c.id === 'compliance' || c.id === 'surveys'
                      ? 'quality'
                      : 'setup';
    const cur = byStage.get(stage) || { done: 0, total: 0 };
    cur.total += 1;
    if (c.done) cur.done += 1;
    byStage.set(stage, cur);
  }

  const schoolStages = PROCESS_STAGES.filter((s) =>
    role === 'agency'
      ? ['govern', 'catalogue', 'supply', 'fund'].includes(s.id)
      : !['govern'].includes(s.id) || s.id === 'fund'
  ).filter((s) =>
    role === 'school'
      ? !['govern'].includes(s.id)
      : true
  );

  const stages =
    role === 'agency'
      ? PROCESS_STAGES.filter((s) =>
          ['setup', 'catalogue', 'supply', 'govern', 'fund'].includes(s.id)
        )
      : PROCESS_STAGES.filter(
          (s) => s.id !== 'govern' // school sees improve via hub
        );

  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white dark:border-cyan-500/25 dark:bg-gradient-to-br dark:from-[#061825] dark:via-[#0b2f44] dark:to-[#0a3d3a] dark:shadow-[0_10px_28px_-12px_rgba(0,0,0,0.55)] ${compact ? 'p-3' : 'p-4'}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6] dark:text-cyan-300">
            {role === 'agency' ? 'DBE operating process' : 'NSNP golden path'}
          </p>
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {role === 'agency'
              ? 'Approve · Catalogue · CoA register · Claims'
              : 'Setup → Kitchen safety → Feed → Fund'}
          </p>
        </div>
        {typeof score === 'number' ? (
          <div className="text-right">
            <p className="text-2xl font-black tabular-nums text-slate-900 dark:text-cyan-100">
              {score}%
            </p>
            <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-cyan-200/60">
              Ready
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {stages.map((st, i) => {
          const prog = byStage.get(st.id);
          const complete =
            prog && prog.total > 0 && prog.done === prog.total;
          const partial = prog && prog.done > 0 && !complete;
          return (
            <div
              key={st.id}
              className={`min-w-[4.5rem] shrink-0 rounded-2xl border px-2.5 py-2 ${
                complete
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-300/35 dark:bg-gradient-to-br dark:from-emerald-950 dark:via-emerald-800 dark:to-emerald-500/60'
                  : partial
                    ? 'border-sky-200 bg-sky-50 dark:border-cyan-300/35 dark:bg-gradient-to-br dark:from-sky-950 dark:via-cyan-800 dark:to-cyan-400/50'
                    : 'border-slate-100 bg-slate-50 dark:border-cyan-500/15 dark:bg-gradient-to-br dark:from-[#0b1e33]/90 dark:to-[#0c3a4f]/50'
              }`}
              title={st.label}
            >
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/55">
                {i + 1}
              </p>
              <p className="text-[11px] font-bold leading-tight text-slate-800 dark:text-white">
                {st.short.replace(/^\d+ · /, '')}
              </p>
            </div>
          );
        })}
      </div>

      {checks.length > 0 && !compact ? (
        <ul className="mt-3 space-y-1.5">
          {checks.slice(0, 8).map((c) => (
            <li key={c.id}>
              <Link
                href={c.href}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-cyan-950/40"
              >
                {c.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Circle
                    className={`h-4 w-4 shrink-0 ${c.required ? 'text-amber-500 dark:text-amber-300' : 'text-slate-300 dark:text-cyan-700'}`}
                  />
                )}
                <span
                  className={`flex-1 ${c.done ? 'text-slate-500 dark:text-cyan-100/55' : 'font-semibold text-slate-800 dark:text-white'}`}
                >
                  {c.label}
                </span>
                {!c.done ? (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-cyan-300/50" />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
