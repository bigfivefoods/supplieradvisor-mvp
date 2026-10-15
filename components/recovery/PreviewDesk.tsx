'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { RECOVER_DEMO_BANNER } from '@/lib/recovery/brand';
import { recovergraphNavSteps } from '@/lib/recovery/nav';
import { SAMPLE_ILLUSTRATION, sampleDesk } from '@/lib/recovery/sample-desk';
import { RecoverCreditors, RecoverMandates } from './RecoverBooks';
import { RecoverCommand } from './RecoverCommand';
import { RecoverPortals } from './RecoverPortals';
import { RecoverQueue } from './RecoverQueue';
import { RecoverTeam } from './RecoverTeam';
import { SamplePortalBoard } from './RecoverPreviews';
import { RecoverPreviewProvider } from './useRecoverDesk';

const PreviewRoleContext = createContext<PreviewRole>('owner');

export type PreviewRole = 'owner' | 'agent' | 'client';

function readRole(value: string | null): PreviewRole {
  if (value === 'agent' || value === 'worker') return 'agent';
  if (value === 'client') return 'client';
  return 'owner';
}

function ClientSample() {
  return (
    <div className="grid gap-4" data-testid="recover-preview-client">
      <div
        data-testid="recover-banner-demo"
        role="status"
        className="rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-white px-4 py-3 text-sm font-medium leading-relaxed text-slate-900 shadow-sm"
      >
        {RECOVER_DEMO_BANNER}
      </div>
      <p className="text-sm font-black text-[#0f172a]">Illustration · sample data</p>
      <SamplePortalBoard kind="creditor" />
      <SamplePortalBoard kind="debtor" />
      <SamplePortalBoard kind="attorney" />
    </div>
  );
}

export function PreviewShell({ children }: { children: ReactNode }) {
  const path = usePathname() || '/preview/recovergraph';
  const [role, setRole] = useState<PreviewRole>('owner');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRole(readRole(params.get('role')));
    setReady(true);
  }, [path]);

  const desk = useMemo(() => sampleDesk(role === 'agent' ? 'agent' : 'owner'), [role]);
  const steps = recovergraphNavSteps();
  const query = `role=${role}`;

  return (
    <PreviewRoleContext.Provider value={role}>
    <RecoverPreviewProvider
      desk={desk}
      illustration={SAMPLE_ILLUSTRATION}
      hrefBase={`/preview/recovergraph?${query}`}
    >
      <div
        className="min-h-screen bg-[#f8fafc] text-[#0f172a]"
        data-book-ready={ready ? '1' : '0'}
        data-testid="recover-preview"
      >
        <div className="border-b border-[#e2e8f0] bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-3 py-3">
            <p className="text-xs font-black uppercase tracking-wide text-[#0f172a]">
              RecoverAdvisor® Sample
            </p>
            <p className="text-xs font-bold text-slate-600">Illustration · sample data</p>
            {(
              [
                ['owner', 'Owner'],
                ['agent', 'Agent'],
                ['client', 'Client'],
              ] as const
            ).map(([item, label]) => (
              <a
                key={item}
                className={`inline-flex min-h-10 items-center rounded-full px-3 text-xs font-black ${
                  role === item ? 'bg-[#00b4d8] text-[#0f172a]' : 'bg-white text-slate-700 ring-1 ring-slate-200'
                }`}
                href={`${path}?role=${item}`}
              >
                {label}
              </a>
            ))}
          </div>
          <nav
            aria-label="Sample sections"
            data-testid="recover-preview-nav"
            className="mx-auto flex max-w-6xl flex-wrap gap-2 px-3 pb-3"
          >
            {steps.map((step) => {
              const root = '/dashboard/recovergraph';
              const href = step.href.startsWith(root)
                ? `/preview/recovergraph${step.href.slice(root.length)}?${query}`
                : step.href;
              return (
                <a
                  key={step.href}
                  href={href}
                  className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-full bg-white px-3 text-xs font-bold text-slate-800 ring-1 ring-slate-200"
                >
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">{step.section}</span>
                  <span>{step.name}</span>
                </a>
              );
            })}
          </nav>
        </div>
        <div className="mx-auto max-w-6xl px-3 py-4">
          {ready ? (
            <div className="sa-page">{children}</div>
          ) : (
            <div className="h-40 animate-pulse rounded-3xl bg-slate-100 motion-reduce:animate-none" />
          )}
        </div>
      </div>
    </RecoverPreviewProvider>
    </PreviewRoleContext.Provider>
  );
}

export function PreviewDesk({ view }: { view: string }) {
  const role = useContext(PreviewRoleContext);
  if (role === 'client') return <ClientSample />;
  if (view === 'queue') return <RecoverQueue />;
  if (view === 'creditors') return <RecoverCreditors />;
  if (view === 'mandates') return <RecoverMandates />;
  if (view === 'team') return <RecoverTeam />;
  if (view === 'portals') return <RecoverPortals />;
  return <RecoverCommand />;
}

export function RecoverSampleApp({
  role,
  hrefBase,
}: {
  role: PreviewRole;
  hrefBase: string;
}) {
  const desk = useMemo(() => sampleDesk(role === 'agent' ? 'agent' : 'owner'), [role]);
  return (
    <RecoverPreviewProvider desk={desk} illustration={SAMPLE_ILLUSTRATION} hrefBase={hrefBase}>
      <div className="min-h-screen bg-[#f8fafc] px-3 py-4 text-[#0f172a]" data-testid={`recover-pwa-${role}`}>
        <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
          RecoverAdvisor® · Illustration · sample data
        </p>
        <div className="sa-page">{role === 'client' ? <ClientSample /> : <RecoverCommand />}</div>
      </div>
    </RecoverPreviewProvider>
  );
}
