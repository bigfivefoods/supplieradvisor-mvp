'use client';

/**
 * Priority 1 — School "Today" board: what to do in the next 10 minutes.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sun,
} from 'lucide-react';

type TodayCard = {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'done';
  title: string;
  detail?: string;
  href: string;
  cta: string;
  count?: number;
};

type Board = {
  date: string;
  cards: TodayCard[];
  summary?: Record<string, number | boolean | null>;
  next?: TodayCard | null;
};

export default function SchoolTodayBoard({
  companyId,
}: {
  companyId: number;
}) {
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/schools/ops?companyId=${companyId}&view=today`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setBoard(data.board || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const severityClass = (s: string) => {
    if (s === 'critical') return 'border-rose-200 bg-rose-50 text-rose-950';
    if (s === 'high') return 'border-amber-200 bg-amber-50 text-amber-950';
    if (s === 'medium') return 'border-sky-200 bg-sky-50 text-sky-950';
    if (s === 'done') return 'border-emerald-200 bg-emerald-50 text-emerald-950';
    return 'border-slate-200 bg-white text-slate-900';
  };

  return (
    <section className="mb-6 rounded-3xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-amber-50 via-white to-sky-50">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Today · next 10 minutes
            </p>
            <h2 className="text-base font-black text-slate-900">
              {board?.date
                ? `School board · ${board.date}`
                : 'School board'}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
        </div>
      ) : error ? (
        <p className="px-5 py-6 text-sm text-rose-700">{error}</p>
      ) : (
        <>
          {board?.summary ? (
            <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-slate-50">
              {[
                {
                  l: 'Urgent',
                  v: board.summary.urgent ?? 0,
                },
                {
                  l: 'To receive',
                  v: board.summary.awaiting_receive ?? 0,
                },
                {
                  l: 'Serve today',
                  v: board.summary.serve_today ? 'Yes' : 'No',
                },
                {
                  l: 'Stock risk',
                  v: board.summary.stock_risk ?? 0,
                },
              ].map((k) => (
                <div
                  key={k.l}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <p className="text-[10px] font-bold uppercase text-slate-400">
                    {k.l}
                  </p>
                  <p className="text-lg font-black tabular-nums">{k.v}</p>
                </div>
              ))}
            </div>
          ) : null}

          {board?.next && board.next.severity !== 'done' ? (
            <div className="px-5 py-4 border-b border-slate-50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
                Do this next
              </p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black text-slate-900">
                    {board.next.title}
                  </p>
                  {board.next.detail ? (
                    <p className="text-sm text-slate-600 mt-0.5">
                      {board.next.detail}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={board.next.href}
                  className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1 min-h-[44px]"
                >
                  {board.next.cta} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : null}

          <ul className="divide-y divide-slate-50 max-h-[28rem] overflow-y-auto">
            {(board?.cards || []).map((c) => (
              <li key={c.id}>
                <Link
                  href={c.href}
                  className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50/80 ${severityClass(
                    c.severity
                  )}`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    {c.severity === 'done' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 opacity-70" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{c.title}</p>
                      {c.detail ? (
                        <p className="text-xs opacity-80 mt-0.5">{c.detail}</p>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-xs font-bold underline-offset-2 hover:underline shrink-0">
                    {c.cta} →
                  </span>
                </Link>
              </li>
            ))}
            {!board?.cards?.length ? (
              <li className="px-5 py-8 text-center text-sm text-slate-500">
                Nothing urgent — check kitchen stock or raise a PO when needed.
              </li>
            ) : null}
          </ul>
        </>
      )}
    </section>
  );
}
