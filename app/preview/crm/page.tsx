'use client';

import { Suspense, useEffect, useState } from 'react';
import { Providers } from '@/components/Providers';
import { crmPreviewJson } from '@/lib/customers/crm-preview';
import CustomersHub from '@/app/dashboard/customers/page';
import ProfilesPage from '@/app/dashboard/customers/profiles/page';
import LeadsPage from '@/app/dashboard/customers/leads/page';
import Customers360Page from '@/app/dashboard/customers/360/page';
import SalesTasksPage from '@/app/sales/tasks/page';

const COMPANY_ID = '91001';

function installPreviewFetch() {
  if (typeof window === 'undefined') return;
  const w = window as Window & { __saCrmPreviewFetch?: boolean };
  if (w.__saCrmPreviewFetch) return;
  w.__saCrmPreviewFetch = true;
  try {
    localStorage.setItem('selectedCompanyId', COMPANY_ID);
    localStorage.setItem('selectedCompanyName', 'Harbour & Co');
  } catch {
    /* ignore */
  }
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method === 'GET') {
      const body = crmPreviewJson(url);
      if (body && url.includes('/api/')) {
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    if (url.includes('/api/') && method !== 'GET') {
      return new Response(
        JSON.stringify({
          error: 'Sample book only — nothing was saved on SupplierAdvisor®',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return original(input, init);
  };
}

installPreviewFetch();

function Screen() {
  const [screen, setScreen] = useState('hub');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    installPreviewFetch();
    const params = new URLSearchParams(window.location.search);
    setScreen(params.get('screen') || 'hub');
    setReady(true);
  }, []);

  if (!ready) {
    return <p className="p-6 text-sm font-semibold text-slate-700">Opening the SupplierAdvisor® customer book…</p>;
  }

  return (
    <div className="sa-page crm-module min-h-screen">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#0077b6]">
        SupplierAdvisor® · sample book · not saved
      </p>
      {screen === 'profiles' ? <ProfilesPage /> : null}
      {screen === 'leads' || screen === 'pipeline' ? <LeadsPage /> : null}
      {screen === '360' ? <Customers360Page /> : null}
      {screen === 'tasks' ? <SalesTasksPage /> : null}
      {screen === 'hub' ? <CustomersHub /> : null}
    </div>
  );
}

export default function CrmPreviewPage() {
  return (
    <Providers>
      <Suspense fallback={null}>
        <Screen />
      </Suspense>
    </Providers>
  );
}
