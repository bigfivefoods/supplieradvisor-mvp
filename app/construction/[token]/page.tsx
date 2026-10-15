'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { ConstructionPortalView } from '@/lib/construction/constructiongraph';

function zar(n: number) {
  return `R ${Number(n || 0).toLocaleString('en-ZA')}`;
}

export default function ConstructionPortalPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token || '');
  const [view, setView] = useState<ConstructionPortalView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetch(
      `/api/public/constructiongraph?token=${encodeURIComponent(token)}`,
      { cache: 'no-store' }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Portal not found');
      return;
    }
    setView(data.view || null);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: 'claim' | 'pay', paymentId: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/public/constructiongraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action, paymentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not update payment');
        return;
      }
      setError(null);
      setView(data.view || null);
    } finally {
      setSaving(false);
    }
  };

  if (error && !view) {
    return (
      <div className="min-h-dvh bg-stone-50 px-4 py-16 text-center">
        <h1 className="text-xl font-black">Construction portal</h1>
        <p className="mt-2 text-sm text-stone-600">{error}</p>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="min-h-dvh bg-stone-50 px-4 py-16 text-center text-sm text-stone-500">
        Loading ConstructionAdvisor®…
      </div>
    );
  }

  const kindLabel =
    view.kind === 'client'
      ? 'Client PWA'
      : view.kind === 'contractor'
        ? 'Contractor PWA'
        : 'Programme PWA';

  const subtitle =
    view.kind === 'client'
      ? `${view.clientName} · ${view.projects.length} project${view.projects.length === 1 ? '' : 's'}`
      : view.kind === 'contractor'
        ? `${view.projectCode} · ${view.projectName}`
        : `${view.projects.length} project${view.projects.length === 1 ? '' : 's'}`;

  const tiles =
    view.kind === 'client'
      ? [
          ['Contract', zar(view.projects.reduce((sum, row) => sum + row.contractValue, 0))],
          ['Certified', zar(view.projects.reduce((sum, row) => sum + row.certified, 0))],
          ['Paid', zar(view.projects.reduce((sum, row) => sum + row.paid, 0))],
          ['Outstanding', zar(view.projects.reduce((sum, row) => sum + row.outstanding, 0))],
        ]
      : view.kind === 'contractor'
        ? [
            [
              'Plan / actual',
              `${Math.round(view.projects[0]?.plannedPct || 0)}% / ${Math.round(view.projects[0]?.actualPct || 0)}%`,
            ],
            ['Open snags', String(view.openSnags.length)],
          ]
        : view.projects.slice(0, 4).map((project) => [
            project.code,
            `${Math.round(project.plannedPct)}% / ${Math.round(project.actualPct)}%`,
          ]);

  return (
    <div className="min-h-dvh bg-stone-50 text-slate-900">
      <header className="border-b border-stone-200 bg-stone-900 text-white px-4 py-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">
          ConstructionAdvisor® · {kindLabel}
        </p>
        <h1 className="text-2xl font-black mt-1">{view.companyName}</h1>
        <p className="text-sm text-stone-300 mt-1">{subtitle}</p>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {error}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          {tiles.map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-stone-200 bg-white p-3"
            >
              <div className="text-[10px] uppercase font-black text-amber-800">
                {label}
              </div>
              <div className="text-lg font-black">{value}</div>
            </div>
          ))}
        </div>

        {view.kind === 'client' && view.quotes.length ? (
          <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
            <h2 className="font-black">Quotes</h2>
            <div className="mt-2 space-y-1 text-xs">
              {view.quotes.map((q) => (
                <div key={q.id}>
                  <b>{q.number}</b> · {q.title} · {q.projectCode} · {q.status} ·{' '}
                  {zar(q.total)}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {view.projects.map((p) => (
          <section
            key={'siteId' in p ? p.siteId : p.code}
            className="rounded-2xl border border-stone-200 bg-white p-4 text-sm"
          >
            <h2 className="font-black">
              {p.code} · {p.name}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {'clientName' in p && p.clientName ? `${p.clientName} · ` : ''}
              {p.status}
            </p>
            {view.kind === 'client' && 'contractValue' in p ? (
              <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
                <div>Contract {zar(p.contractValue)}</div>
                <div>Certified {zar(p.certified)}</div>
                <div>Paid {zar(p.paid)}</div>
                <div>Due {zar(p.outstanding)}</div>
                <div>
                  Plan {Math.round(p.plannedPct)}% / actual {Math.round(p.actualPct)}%
                </div>
                <div>Open snags {p.openSnags}</div>
              </dl>
            ) : (
              <p className="mt-2 text-xs">
                Plan {Math.round(p.plannedPct)}% / actual {Math.round(p.actualPct)}%
                {'openSnags' in p ? ` · open snags ${p.openSnags}` : ''}
              </p>
            )}
          </section>
        ))}

        {view.kind !== 'public' && view.payments.length ? (
          <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
            <h2 className="font-black">Progress payments</h2>
            <div className="mt-2 space-y-3">
              {view.payments.map((row) => (
                <div key={row.id} className="border-t pt-2 text-xs">
                  <div className="font-bold">
                    {row.number} · {row.title} · {row.siteCode} · {row.status}
                  </div>
                  <div className="text-stone-500 mt-0.5">
                    claim {row.plannedClaimDate || '—'}
                    {row.claimedAt ? ` · issued ${row.claimedAt}` : ''} · pay{' '}
                    {row.plannedPayDate || '—'}
                    {view.kind === 'client' && row.paidAt ? ` · paid ${row.paidAt}` : ''} · planned{' '}
                    {zar(row.plannedAmount)}
                    {view.kind === 'client'
                      ? ` · certified ${zar(row.certifiedAmount || 0)} · paid ${zar(row.paidAmount || 0)}`
                      : ` · claimed ${zar(row.claimedAmount)}`}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {view.kind === 'contractor' &&
                    row.status !== 'paid' &&
                    !row.claimedAt ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void act('claim', row.id)}
                        className="rounded-lg bg-stone-800 text-white px-3 py-1.5 font-bold"
                      >
                        Issue claim
                      </button>
                    ) : null}
                    {view.kind === 'client' &&
                    row.status !== 'paid' &&
                    (row.claimedAt || row.certifiedAt) ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void act('pay', row.id)}
                        className="rounded-lg bg-amber-800 text-white px-3 py-1.5 font-bold"
                      >
                        Record payment
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {view.kind !== 'public' && view.activities.length ? (
          <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
            <h2 className="font-black">Programme plan vs actuals</h2>
            <div className="mt-2 space-y-1 text-xs">
              {view.activities.map((row) => (
                <div key={row.id}>
                  <b>{row.activity}</b> · {row.siteCode} · {row.plannedStart || '—'} →{' '}
                  {row.plannedEnd || '—'} · planned {row.plannedPct}% · actual{' '}
                  {row.actualPct}% · {row.status}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {view.kind === 'contractor' && view.openSnags.length ? (
          <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
            <h2 className="font-black">Open snags</h2>
            <div className="mt-2 space-y-1 text-xs">
              {view.openSnags.map((row) => (
                <div key={`${row.item}-${row.location}`}>
                  <b>{row.item}</b>
                  {row.location ? ` · ${row.location}` : ''} · {row.status}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <p className="text-[11px] text-stone-500 text-center pb-8">
          Add this page to your home screen for the ConstructionAdvisor® PWA.
        </p>
      </main>
    </div>
  );
}
