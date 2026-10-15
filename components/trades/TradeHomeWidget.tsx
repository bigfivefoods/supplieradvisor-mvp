'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatZar } from '@/lib/trades/tradegraph';
import { tradeReport, type Book } from '@/lib/trades/desk';

export function TradeHomeWidget() {
  const [label, setLabel] = useState('Open the job board');
  const [detail, setDetail] = useState('Quotes, Gantt, and the customer app.');

  useEffect(() => {
    const companyId = getSelectedCompanyId();
    if (!companyId) return;
    let cancelled = false;
    void fetch(`/api/trades/tradegraph?companyId=${companyId}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data: { store?: Book['store']; desk?: Book['desk'] }) => {
        if (cancelled || !data.store || !data.desk) return;
        const report = tradeReport({ store: data.store, desk: data.desk });
        setLabel(`${data.store.jobs.length} jobs · ${formatZar(report.outstanding_cents)} outstanding`);
        setDetail(`${data.store.settings.brand_name || 'TradeAdvisor®'} · win rate ${Math.round(report.win_rate * 100)}%`);
      })
      .catch(() => {
        /* The home page still links through when the book is unavailable. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#00b4d8]">TradeAdvisor®</p>
      <h2 className="mt-1 text-lg font-black">{label}</h2>
      <p className="text-sm text-slate-600">{detail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/dashboard/tradegraph" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]">Open TradeAdvisor®</Link>
        <Link href="/dashboard/tradegraph/board?new=1" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold">New job</Link>
        <Link href="/preview/tradegraph" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold">Sample book</Link>
      </div>
    </section>
  );
}
