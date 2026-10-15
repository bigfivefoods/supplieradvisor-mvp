'use client';

import { useState } from 'react';
import { ConstructionInstallPrompt } from '@/components/construction/ConstructionInstall';
import { ConstructionProgress, ConstructionStatusPill } from '@/components/construction/ConstructionUi';
import type { PortalScreen } from '@/lib/construction/portal-screen';

const TABS: Record<PortalScreen['kind'], string[]> = {
  client: ['Overview', 'Programme', 'Money', 'Variations', 'Snags'],
  contractor: ['Today', 'Programme', 'Claims', 'Snags'],
  public: ['Projects', 'Programme'],
};

export function PortalApp({
  screen,
  onPay,
  onClaim,
}: {
  screen: PortalScreen;
  onPay?: (paymentId: string) => void;
  onClaim?: (paymentId: string) => void;
}) {
  const tabs = TABS[screen.kind];
  const [tab, setTab] = useState(tabs[0]);
  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]" data-testid={`portal-${screen.kind}`}>
      <header className="sticky top-0 z-20 border-b border-[#e2e8f0] bg-[#00b4d8] text-[#0f172a]">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide">ConstructionAdvisor®</p>
            <h1 className="text-lg font-black leading-tight">{screen.headline}</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-lg space-y-3 px-4 py-4 pb-28">
        <ConstructionInstallPrompt />
        {screen.site ? (
          <section className="rounded-3xl border border-[#e2e8f0] bg-white p-4 shadow-sm" data-testid="portal-site">
            <p className="text-sm font-black">{screen.site.code} · {screen.site.name}</p>
            <p className="text-sm text-slate-700">{screen.site.address}</p>
            <p className="text-sm text-slate-700">{screen.site.manager} {screen.site.phone}</p>
          </section>
        ) : null}
        {tab === 'Overview' || tab === 'Projects' || tab === 'Package' || tab === 'Today' ? (
          <section className="space-y-2" data-testid="portal-overview">
            {screen.projects.map((project) => (
              <article key={project.id} className="rounded-3xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-black">{project.code} · {project.name}</h2>
                  <ConstructionStatusPill status={project.status} />
                </div>
                <div className="mt-2"><ConstructionProgress planned={project.plannedPct} actual={project.actualPct} /></div>
              </article>
            ))}
            {screen.projects.length === 0 ? <p className="text-sm text-slate-600">No projects on this link.</p> : null}
          </section>
        ) : null}
        {tab === 'Programme' ? (
          <ol className="space-y-2" data-testid="portal-programme">
            {screen.activities.map((row) => (
              <li key={row.id} className="rounded-3xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                <p className="font-black">{row.activity}</p>
                <ConstructionStatusPill status={row.status} />
                <div className="mt-2"><ConstructionProgress planned={row.plannedPct} actual={row.actualPct} /></div>
              </li>
            ))}
          </ol>
        ) : null}
        {tab === 'Money' || tab === 'Claims' ? (
          <ul className="space-y-2" data-testid="portal-money">
            {screen.payments.map((row) => (
              <li key={row.id} className="rounded-3xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                <p className="font-black">{row.number} · {row.title}</p>
                <p className="text-sm tabular-nums">{row.amountLabel} as entered</p>
                <ConstructionStatusPill status={row.status} />
                {screen.kind === 'client' && onPay ? (
                  <button type="button" data-testid="portal-pay" className="mt-3 inline-flex min-h-11 items-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a]" onClick={() => onPay(row.id)}>Record payment</button>
                ) : null}
                {screen.kind === 'contractor' && onClaim ? (
                  <button type="button" data-testid="portal-claim" className="mt-3 inline-flex min-h-11 items-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a]" onClick={() => onClaim(row.id)}>Issue claim</button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {tab === 'Variations' ? (
          <ul className="space-y-2" data-testid="portal-variations">
            {screen.variations.map((row) => (
              <li key={row.id} className="rounded-3xl border border-[#e2e8f0] bg-white p-4 text-sm shadow-sm">
                <p className="font-black">{row.number} · {row.title}</p>
                <p>{row.days} days</p>
                <ConstructionStatusPill status={row.status} />
              </li>
            ))}
          </ul>
        ) : null}
        {tab === 'Snags' ? (
          <ul className="space-y-2" data-testid="portal-snags">
            {screen.snags.map((row) => (
              <li key={row.id} className="rounded-3xl border border-[#e2e8f0] bg-white p-4 text-sm shadow-sm">
                <p className="font-black">{row.item}</p>
                <p>{row.location}</p>
                <ConstructionStatusPill status={row.status} />
              </li>
            ))}
          </ul>
        ) : null}
        {tab === 'Required' ? (
          <ul className="space-y-2" data-testid="portal-required">
            {screen.required.map((row) => (
              <li key={row.id} className="rounded-3xl border border-[#e2e8f0] bg-white p-4 text-sm shadow-sm">
                <p className="font-black">{row.title}</p>
                <ConstructionStatusPill status={row.status} />
              </li>
            ))}
          </ul>
        ) : null}
        {tab === 'Documents' ? (
          <ul className="space-y-2" data-testid="portal-documents">
            {screen.documents.map((row) => (
              <li key={row.id} className="rounded-3xl border border-[#e2e8f0] bg-white p-4 text-sm shadow-sm">
                <p className="font-black">{row.number} · {row.title}</p>
                <p>Rev {row.revision || '—'}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e2e8f0] bg-white" data-testid="portal-nav" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex max-w-lg">
          {tabs.map((name) => (
            <button key={name} type="button" className={`min-h-11 flex-1 text-xs font-black ${tab === name ? 'text-[#0f172a]' : 'text-slate-500'}`} onClick={() => setTab(name)}>
              {name}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
