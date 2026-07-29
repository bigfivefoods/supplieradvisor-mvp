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
      c.id === 'profile' || c.id === 'photo' || c.id === 'agency'
        ? 'setup'
        : c.id === 'learners' || c.id === 'verify'
          ? 'register'
          : c.id === 'menu' ||
              c.id === 'calendar' ||
              c.id === 'recipes' ||
              c.id === 'approved'
            ? 'catalogue'
            : c.id === 'isp'
              ? 'supply'
              : c.id === 'stock' || c.id === 'kitchen' || c.id === 'cover'
                ? 'kitchen'
                : c.id === 'serve'
                  ? 'serve'
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
      className={`rounded-3xl border border-slate-200 bg-white ${compact ? 'p-3' : 'p-4'}`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
            {role === 'agency' ? 'DBE operating process' : 'NSNP golden path'}
          </p>
          <p className="text-sm font-black text-slate-900">
            {role === 'agency'
              ? 'Approve · Catalogue · Oversight · Fund'
              : 'Setup → Feed → Fund → Improve'}
          </p>
        </div>
        {typeof score === 'number' ? (
          <div className="text-right">
            <p className="text-2xl font-black tabular-nums text-slate-900">
              {score}%
            </p>
            <p className="text-[10px] font-bold uppercase text-slate-400">
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
              className={`shrink-0 rounded-2xl border px-2.5 py-2 min-w-[4.5rem] ${
                complete
                  ? 'border-emerald-200 bg-emerald-50'
                  : partial
                    ? 'border-sky-200 bg-sky-50'
                    : 'border-slate-100 bg-slate-50'
              }`}
              title={st.label}
            >
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                {i + 1}
              </p>
              <p className="text-[11px] font-bold text-slate-800 leading-tight">
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
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-50 text-sm"
              >
                {c.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Circle
                    className={`w-4 h-4 shrink-0 ${c.required ? 'text-amber-500' : 'text-slate-300'}`}
                  />
                )}
                <span
                  className={`flex-1 ${c.done ? 'text-slate-500' : 'font-semibold text-slate-800'}`}
                >
                  {c.label}
                </span>
                {!c.done ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
