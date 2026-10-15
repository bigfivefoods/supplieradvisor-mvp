'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { MODULE_NAV } from '@/lib/chrome/module-nav';
import { applyConstructionAction } from '@/lib/construction/actions';
import {
  addDaysIso,
  applyPaymentAction,
  emptyConstructiongraphStore,
  hydrateConstructiongraphStore,
  mintConstructionToken,
  upsertPortal,
  type ConstructiongraphStore,
} from '@/lib/construction/constructiongraph';
import { sastToday } from '@/lib/construction/format';
import { publicConstructionView, type PortalKind } from '@/lib/construction/portal-screen';
import { capabilitiesFor, type ConstructionRole } from '@/lib/construction/roles';
import { sampleConstructionStore } from '@/lib/construction/sample-book';
import type { DeskProps } from '@/components/construction/desk';
import { PortalApp } from '@/components/construction/PortalApp';
import { CommandView } from '@/components/construction/views/CommandView';
import { ClientsView, QuotesView, ProjectsView, SubcontractorsView } from '@/components/construction/views/RegisterViews';
import { ProgrammeView, VariationsView, DiaryView, SafetyView } from '@/components/construction/views/OpsViews';
import { PaymentsView, CertificatesView, CostsView } from '@/components/construction/views/MoneyViews';
import { DocumentsView, HandoverView, MaterialsView, PortalDeskView, ReportsView } from '@/components/construction/views/AssureViews';

const KEY = 'constructiongraph-preview-v1';

type PreviewApi = DeskProps & {
  ready: boolean;
  setStore: (store: ConstructiongraphStore) => void;
};

const PreviewContext = createContext<PreviewApi | null>(null);

function readRole(value: string | null): ConstructionRole {
  if (value === 'site_manager' || value === 'office' || value === 'viewer' || value === 'owner') return value;
  return 'owner';
}

export function PreviewShell({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<ConstructiongraphStore>(() => sampleConstructionStore());
  const [role, setRole] = useState<ConstructionRole>('owner');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reset = params.get('reset') === '1';
    if (reset) localStorage.removeItem(KEY);
    setRole(readRole(params.get('role')));
    if (params.get('empty') === '1') {
      setStore(emptyConstructiongraphStore());
    } else if (!reset) {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        try {
          setStore(hydrateConstructiongraphStore(JSON.parse(raw)));
        } catch {
          setStore(sampleConstructionStore());
        }
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(KEY, JSON.stringify(store));
  }, [ready, store]);

  const caps = useMemo(() => capabilitiesFor(role), [role]);
  const api = useMemo<PreviewApi>(() => {
    const handlers: DeskProps['handlers'] = {
      retry: () => setStore(sampleConstructionStore()),
      merge: async (patch) => {
        const result = applyConstructionAction(store, { action: 'merge', store: patch }, role);
        if (!result.ok) throw new Error(result.error);
        setStore(result.store);
      },
      run: async (body) => {
        const action = String(body.action || '');
        if (action === 'seed_demo') {
          if (role !== 'owner') throw new Error('Not available for your role');
          const next = sampleConstructionStore();
          setStore(next);
          return { success: true, store: next };
        }
        if (action === 'payment') {
          if (!caps.canCertify) throw new Error('Not available for your role');
          const verb = body.verb === 'pay' ? 'pay' : 'certify';
          const result = applyPaymentAction(store, {
            paymentId: String(body.paymentId || ''),
            action: verb,
            actor: 'staff',
            date: sastToday(),
          });
          if (!result.ok) throw new Error(result.error);
          setStore(result.store);
          return { success: true };
        }
        if (action.startsWith('ensure_')) {
          if (role !== 'owner') throw new Error('Not available for your role');
          const token = mintConstructionToken();
          const days = body.expiresIn == null ? null : Number(body.expiresIn);
          const expires_at = days ? addDaysIso(sastToday(), days) : null;
          const kind: PortalKind =
            action === 'ensure_client_portal'
              ? 'client'
              : action === 'ensure_contractor_portal'
                ? 'contractor'
                : action === 'ensure_subcontractor_portal'
                  ? 'subcontractor'
                  : 'public';
          const next = upsertPortal(store, {
            token,
            kind,
            client_id: body.clientId ? String(body.clientId) : null,
            site_id: body.siteId ? String(body.siteId) : null,
            subcontractor_id: body.subcontractorId ? String(body.subcontractorId) : null,
            label: kind,
            created_at: new Date().toISOString(),
            expires_at,
            token_hint: token.slice(-4),
            legacy: false,
          });
          setStore(next);
          const path = `/preview/constructiongraph/portal?kind=${kind}&token=${encodeURIComponent(token)}`;
          return { issued: { id: token, kind, token, path, hint: token.slice(-4) } };
        }
        if (action === 'revoke_portal') {
          if (role !== 'owner') throw new Error('Not available for your role');
          const id = String(body.id || '');
          setStore({
            ...store,
            portals: store.portals.map((row) => (row.id === id ? { ...row, revoked_at: new Date().toISOString() } : row)),
          });
          return { success: true };
        }
        const result = applyConstructionAction(store, body, role);
        if (!result.ok) {
          if (result.needsConfirm) return { needsConfirm: true, error: result.error };
          throw new Error(result.error);
        }
        setStore(result.store);
        return { success: true, store: result.store };
      },
    };
    return {
      store,
      role,
      caps,
      state: 'ready',
      handlers,
      badge: 'Sample',
      hrefBase: '/preview/constructiongraph',
      ready,
      setStore,
    };
  }, [caps, ready, role, store]);

  const steps = MODULE_NAV.find((mod) => mod.id === 'constructiongraph')?.steps || [];
  return (
    <PreviewContext.Provider value={api}>
      <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]" data-book-ready={ready ? '1' : '0'} data-testid="construction-preview">
        <div className="border-b border-[#e2e8f0] bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-3 py-2">
            <p className="text-xs font-black uppercase tracking-wide text-[#0077b6]">ConstructionAdvisor® sample</p>
            {(['owner', 'site_manager', 'office'] as const).map((item) => (
              <a key={item} className={`inline-flex min-h-10 items-center rounded-full px-3 text-xs font-black ${role === item ? 'bg-[#00b4d8] text-[#0f172a]' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`} href={`/preview/constructiongraph?role=${item}`}>
                {item === 'site_manager' ? 'Site manager' : item === 'office' ? 'Office' : 'Owner'}
              </a>
            ))}
          </div>
          <nav aria-label="Sample sections" data-testid="preview-sidebar" className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-3 pb-3">
            {steps.map((step) => {
              const root = '/dashboard/constructiongraph';
              const href = step.href.startsWith(root)
                ? `/preview/constructiongraph${step.href.slice(root.length)}`
                : step.href;
              return (
                <a key={step.href} href={href} className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-white px-3 text-xs font-bold text-slate-800 ring-1 ring-slate-200">
                  <span className="text-[10px] uppercase text-slate-500">{step.section}</span>
                  <span className="ml-1">{step.name}</span>
                </a>
              );
            })}
          </nav>
        </div>
        <div className="mx-auto max-w-6xl px-3 py-4">{children}</div>
      </div>
    </PreviewContext.Provider>
  );
}

export function usePreviewDesk(): PreviewApi {
  const value = useContext(PreviewContext);
  if (!value) throw new Error('Preview desk is only available on the sample');
  return value;
}

const VIEWS: Record<string, (props: DeskProps) => ReactNode> = {
  '': (props) => <CommandView {...props} />,
  clients: (props) => <ClientsView {...props} />,
  quotes: (props) => <QuotesView {...props} />,
  sites: (props) => <ProjectsView {...props} />,
  programme: (props) => <ProgrammeView {...props} />,
  diary: (props) => <DiaryView {...props} />,
  subcontractors: (props) => <SubcontractorsView {...props} />,
  materials: (props) => <MaterialsView {...props} />,
  payments: (props) => <PaymentsView {...props} />,
  variations: (props) => <VariationsView {...props} />,
  certificates: (props) => <CertificatesView {...props} />,
  costs: (props) => <CostsView {...props} />,
  safety: (props) => <SafetyView {...props} />,
  drawings: (props) => <DocumentsView {...props} />,
  handover: (props) => <HandoverView {...props} />,
  reports: (props) => <ReportsView {...props} />,
  portal: (props) => <PortalDeskView {...props} />,
};

export function PreviewDesk({ view }: { view: string }) {
  const desk = usePreviewDesk();
  const params = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
  const kind = params?.get('kind') as PortalKind | null;
  if (view === 'portal' && kind && desk.ready) {
    const token = params?.get('token') || desk.store.portals.find((row) => row.kind === kind)?.token || '';
    const screen = token ? publicConstructionView(desk.store, token, 'ConstructionAdvisor®') : null;
    if (!screen) return <p className="text-sm font-bold">This sample link is not available.</p>;
    return (
      <PortalApp
        screen={screen}
        onPay={
          screen.kind === 'client'
            ? (paymentId) => {
                const result = applyPaymentAction(desk.store, { paymentId, action: 'pay', actor: 'client', date: sastToday(), portal: desk.store.portals.find((row) => row.token === token) });
                if (result.ok) desk.setStore(result.store);
              }
            : undefined
        }
        onClaim={
          screen.kind === 'contractor'
            ? (paymentId) => {
                const result = applyPaymentAction(desk.store, { paymentId, action: 'claim', actor: 'contractor', date: sastToday(), portal: desk.store.portals.find((row) => row.token === token) });
                if (result.ok) desk.setStore(result.store);
              }
            : undefined
        }
      />
    );
  }
  const render = VIEWS[view] || VIEWS[''];
  return <>{render(desk)}</>;
}

export function PreviewWork() {
  const desk = usePreviewDesk();
  return (
    <div data-testid="work-app">
      <DiaryView {...desk} />
      <nav data-testid="work-nav" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white">
        <a className="inline-flex min-h-11 flex-1 items-center justify-center text-xs font-black" href="/preview/constructiongraph/work">Today</a>
        <a className="inline-flex min-h-11 flex-1 items-center justify-center text-xs font-black" href="/preview/constructiongraph/diary">Diary</a>
        <a className="inline-flex min-h-11 flex-1 items-center justify-center text-xs font-black" href="/preview/constructiongraph/handover">Snags</a>
        <a className="inline-flex min-h-11 flex-1 items-center justify-center text-xs font-black" href="/preview/constructiongraph/safety">Safety</a>
        <a className="inline-flex min-h-11 flex-1 items-center justify-center text-xs font-black" href="/preview/constructiongraph/programme">Programme</a>
      </nav>
    </div>
  );
}
