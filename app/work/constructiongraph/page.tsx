'use client';

import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { useState } from 'react';
import { DeskScreen } from '@/components/construction/DeskScreen';
import { ConstructionInstallPrompt } from '@/components/construction/ConstructionInstall';
import { DiaryView, ProgrammeView, SafetyView } from '@/components/construction/views/OpsViews';
import { HandoverView } from '@/components/construction/views/AssureViews';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import { constructionPwaCapabilities } from '@/lib/construction/pwa-roles';

function WorkTabs() {
  const [tab, setTab] = useState<'today' | 'diary' | 'snags' | 'safety' | 'programme'>('today');
  const View = tab === 'diary' ? DiaryView : tab === 'snags' ? HandoverView : tab === 'safety' ? SafetyView : tab === 'programme' ? ProgrammeView : DiaryView;
  return (
    <div data-testid="work-app">
      <ConstructionInstallPrompt />
      <DeskScreen View={View} />
      <nav data-testid="work-nav" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white" style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}>
        {([
          ['today', 'Today'],
          ['diary', 'Diary'],
          ['snags', 'Snags'],
          ['safety', 'Safety'],
          ['programme', 'Programme'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={`min-h-11 flex-1 text-xs font-black ${tab === id ? 'text-[#0f172a]' : 'text-slate-500'}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
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
        <p className="mt-2 text-sm text-slate-600">Sign in to open the site app.</p>
        <button type="button" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a]" data-primary="1" onClick={() => login()}>
          Sign in
        </button>
        <p className="mt-4 text-sm">
          <Link className="font-bold text-[#0077b6]" href="/preview/constructiongraph/work">Open the sample site app</Link>
        </p>
      </main>
    );
  }
  const caps = constructionPwaCapabilities(role);
  if (caps.role === 'none') {
    return <main className="p-6 text-sm font-bold">Not available for your role.</main>;
  }
  return <WorkTabs />;
}
