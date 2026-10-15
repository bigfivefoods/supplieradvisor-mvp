'use client';

import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { ConstructiongraphRequired } from '@/components/construction/ConstructiongraphShell';
import { OwnerApp, WorkersApp, newPhotoNote, newTimeEntry } from '@/components/construction/RoleApps';
import { ConstructionError, ConstructionLoading } from '@/components/construction/ConstructionUi';
import { useConstructionDesk } from '@/components/construction/desk';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import { constructionAppRole } from '@/lib/construction/pwa-roles';

function SignedInApp() {
  const desk = useConstructionDesk();
  const app = constructionAppRole(desk.role);
  if (desk.state === 'loading') return <ConstructionLoading testId="work-loading" />;
  if (desk.state === 'error') return <ConstructionError testId="work-error" onRetry={desk.handlers.retry} />;
  const siteId = desk.store.sites.find((row) => row.status === 'on_site')?.id || desk.store.sites[0]?.id;
  if (app === 'workers') {
    return (
      <div data-testid="work-app">
        <WorkersApp
          store={desk.store}
          siteId={desk.role === 'site_manager' ? undefined : siteId}
          seeMoney={desk.role === 'site_manager' && Boolean(desk.store.settings.workers_see_money)}
          onLogTime={(minutes, note) => {
            void desk.handlers.merge({ time_entries: [newTimeEntry(siteId || '', minutes, note)] });
          }}
          onPhotoNote={(caption) => {
            void desk.handlers.merge({ photos: [newPhotoNote(siteId || '', caption)] });
          }}
        />
      </div>
    );
  }
  return (
    <div data-testid="work-app">
      <OwnerApp
        store={desk.store}
        officeHref="/dashboard/constructiongraph"
        onToggleWorkersMoney={(next) => {
          void desk.handlers.run({ action: 'set_workers_money', workersSeeMoney: next });
        }}
      />
    </div>
  );
}

export default function WorkConstructionPage() {
  const { ready, authenticated, login } = usePrivy();
  const { role, loading } = useCompanyRole();
  if (!ready || loading) {
    return <p className="p-6 text-sm">Opening ConstructionAdvisor®…</p>;
  }
  if (!authenticated) {
    return (
      <main className="mx-auto max-w-md bg-[#f8fafc] p-6 text-[#0f172a]">
        <h1 className="text-2xl font-black">ConstructionAdvisor®</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to open the owner app or the workers app.</p>
        <button type="button" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a]" data-primary="1" onClick={() => login()}>
          Sign in
        </button>
        <p className="mt-4 text-sm">
          <Link className="font-bold text-[#0f172a]" href="/preview/constructiongraph/work?role=owner">Open the sample owner app</Link>
        </p>
        <p className="mt-2 text-sm">
          <Link className="font-bold text-[#0f172a]" href="/preview/constructiongraph/work?role=workers">Open the sample workers app</Link>
        </p>
      </main>
    );
  }
  if (constructionAppRole(role) === 'none') {
    return <main className="p-6 text-sm font-bold">Not available for your role.</main>;
  }
  return (
    <ConstructiongraphRequired>
      <SignedInApp />
    </ConstructiongraphRequired>
  );
}
