'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { RECOVER_DEMO_BANNER } from '@/lib/recovery/brand';
import { recovergraphNavSteps, recoverSidebarSteps } from '@/lib/recovery/nav';
import { blankDesk, illustrationFor, sampleDesk } from '@/lib/recovery/sample-desk';
import { RecoverCreditors, RecoverMandates } from './RecoverBooks';
import { RecoverCommand } from './RecoverCommand';
import { RecoverPortals } from './RecoverPortals';
import { RecoverQueue } from './RecoverQueue';
import { RecoverTeam } from './RecoverTeam';
import { ClientAccount } from './RecoverPreviews';
import { RecoverPreviewProvider, useRecoverIllustration } from './useRecoverDesk';

const PreviewRoleContext = createContext<PreviewRole>('owner');

export type PreviewRole = 'owner' | 'agent' | 'client';

function readRole(value: string | null): PreviewRole {
  if (value === 'agent' || value === 'worker') return 'agent';
  if (value === 'client') return 'client';
  return 'owner';
}

function ClientSample() {
  const picture = useRecoverIllustration();
  return (
    <div className="grid gap-4" data-testid="recover-preview-client">
      <div
        data-testid="recover-banner-demo"
        role="status"
        className="rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-white px-4 py-3 text-sm font-medium leading-relaxed text-slate-900 shadow-sm"
      >
        {RECOVER_DEMO_BANNER}
      </div>
      {picture ? <ClientAccount picture={picture} /> : null}
    </div>
  );
}

type BookMode = 'sample' | 'empty' | 'pending' | 'nav';

function readBook(value: string | null): BookMode {
  if (value === 'empty' || value === 'pending' || value === 'nav') return value;
  return 'sample';
}

function NavSheet() {
  const steps = recoverSidebarSteps('owner', null, recovergraphNavSteps());
  return (
    <div data-testid="recover-preview-nav" className="mx-auto max-w-sm rounded-3xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0077b6]">RecoverAdvisor®</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight">Navigation</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        The sidebar group for an owner. No accounts yet.
      </p>
      <ul className="mt-4 space-y-2">
        {steps.map((step) => {
          const root = '/dashboard/recovergraph';
          const href = step.href.startsWith(root)
            ? `/preview/recovergraph${step.href.slice(root.length)}?book=empty&role=owner`
            : step.href;
          return (
            <li key={step.href}>
              <a
                href={href}
                className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-3"
              >
                <span>
                  <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">{step.section}</span>
                  <span className="block text-sm font-black text-[#0f172a]">{step.name}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PreviewShell({ children }: { children: ReactNode }) {
  const path = usePathname() || '/preview/recovergraph';
  const [role, setRole] = useState<PreviewRole>('owner');
  const [book, setBook] = useState<BookMode>('sample');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRole(readRole(params.get('role')));
    setBook(readBook(params.get('book')));
    setReady(true);
  }, [path]);

  const deskRole = role === 'agent' ? 'agent' : 'owner';
  const desk = useMemo(() => {
    if (book === 'pending') return blankDesk('pending', deskRole);
    if (book === 'empty' || book === 'nav') return blankDesk('empty', deskRole);
    return sampleDesk(deskRole);
  }, [book, deskRole]);
  const picture = useMemo(() => {
    if (book !== 'sample') return null;
    return illustrationFor(role === 'client' ? 'client' : role === 'agent' ? 'agent' : 'owner');
  }, [book, role]);
  const steps = recovergraphNavSteps();
  const query = book === 'sample' ? `role=${role}` : `role=${role}&book=${book}`;

  return (
    <PreviewRoleContext.Provider value={role}>
    <RecoverPreviewProvider
      desk={desk}
      illustration={picture}
      hrefBase={`/preview/recovergraph?${query}`}
    >
      <div
        className="min-h-screen bg-[#f8fafc] text-[#0f172a]"
        data-book-ready={ready ? '1' : '0'}
        data-testid="recover-preview"
      >
        <div className="border-b border-[#e2e8f0] bg-white">
          <div className="mx-auto flex h-12 max-w-6xl flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap px-3">
            <p className="shrink-0 text-xs font-black uppercase tracking-wide text-[#0f172a]">
              {book === 'sample' ? 'RecoverAdvisor® Sample' : 'RecoverAdvisor®'}
            </p>
            <p className="shrink-0 text-xs font-bold text-slate-600">
              {book === 'sample' ? 'Illustration · sample data' : 'No accounts yet'}
            </p>
            {(
              [
                ['owner', 'Owner'],
                ['agent', 'Agent'],
                ['client', 'Client'],
              ] as const
            ).map(([item, label]) => (
              <a
                key={item}
                className={`inline-flex h-9 shrink-0 items-center rounded-full px-3 text-xs font-black ${
                  role === item ? 'bg-[#00b4d8] text-[#0f172a]' : 'bg-white text-slate-700 ring-1 ring-slate-200'
                }`}
                href={`${path}?role=${item}${book === 'sample' ? '' : `&book=${book}`}`}
              >
                {label}
              </a>
            ))}
            <nav aria-label="Sample sections" data-testid="recover-preview-nav" className="flex shrink-0 items-center gap-2">
            {steps.map((step) => {
              const root = '/dashboard/recovergraph';
              const href = step.href.startsWith(root)
                ? `/preview/recovergraph${step.href.slice(root.length)}?${query}`
                : step.href;
              return (
                <a
                  key={step.href}
                  href={href}
                  className="inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white px-3 text-xs font-bold text-slate-800 ring-1 ring-slate-200"
                >
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">{step.section}</span>
                  <span>{step.name}</span>
                </a>
              );
            })}
            </nav>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-3 py-4">
          {ready ? (
            book === 'nav' ? <NavSheet /> : <div className="sa-page">{children}</div>
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

const LAUNCH_COPY = {
  owner: {
    title: 'The whole book',
    body: 'Queues, creditor books, and team workload will open in this app.',
  },
  agent: {
    title: 'Your queue',
    body: 'Only the accounts assigned to you will open in this app.',
  },
  client: {
    title: 'Your accounts',
    body: 'Only your own accounts will open in this app.',
  },
} as const;

export function RecoverLaunching({ role }: { role: PreviewRole }) {
  const copy = LAUNCH_COPY[role];
  return (
    <main
      className="min-h-screen bg-[#f8fafc] px-4 py-8 text-[#0f172a]"
      data-testid={`recover-pwa-${role}`}
    >
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0077b6]">RecoverAdvisor®</p>
      <h1 className="mt-3 text-3xl font-black tracking-tight">{copy.title}</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">{copy.body}</p>
      <p className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a]">
        Launching soon
      </p>
    </main>
  );
}
