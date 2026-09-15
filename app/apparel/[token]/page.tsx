'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { ApparelPortalView } from '@/lib/apparel/apparelgraph';

function zar(n: number) {
  return `R ${Number(n || 0).toLocaleString('en-ZA')}`;
}

export default function ApparelPortalPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token || '');
  const [view, setView] = useState<ApparelPortalView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      const res = await fetch(
        `/api/public/apparelgraph?token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Portal not found');
        return;
      }
      setView(data.view || null);
    })();
  }, [token]);

  if (error) {
    return (
      <div className="min-h-dvh bg-cyan-50 px-4 py-16 text-center">
        <h1 className="text-xl font-black">Apparel portal</h1>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="min-h-dvh bg-cyan-50 px-4 py-16 text-center text-sm text-slate-500">
        Loading ApparelAdvisor®…
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-cyan-50 text-slate-900">
      <header className="border-b border-cyan-200 bg-cyan-950 text-white px-4 py-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">
          ApparelAdvisor® · Wholesale PWA
        </p>
        <h1 className="text-2xl font-black mt-1">{view.companyName}</h1>
        <p className="text-sm text-cyan-100 mt-1">
          {view.season || 'Range'} · {view.lines.length} SKUs
          {view.blocked ? ' · ship hold' : ''}
        </p>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {view.sheets.map((s) => (
          <div key={s.number} className="rounded-2xl border border-cyan-200 bg-white p-4 text-sm">
            <b>{s.number}</b> · {s.title} · {s.status}
          </div>
        ))}
        {view.lines.map((row, i) => (
          <section
            key={`${row.style}-${row.colour}-${row.size}-${i}`}
            className="rounded-2xl border border-cyan-200 bg-white p-4 text-sm"
          >
            <h2 className="font-black">
              {row.style} · {row.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {row.colour} · {row.size} · ATS {row.ats} · planned {row.planned} · landed{' '}
              {zar(row.cost)}
            </p>
          </section>
        ))}
        <p className="text-[11px] text-slate-500 text-center pb-8">
          Add this page to your home screen for the ApparelAdvisor® PWA.
        </p>
      </main>
    </div>
  );
}
