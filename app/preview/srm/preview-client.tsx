'use client';

import { Providers } from '@/components/Providers';
import { srmPreviewJson } from '@/lib/suppliers/srm-preview';
import type { CardQuery } from '@/lib/relationship/card-filter';
import NetworkPage from '@/app/dashboard/suppliers/network/page';

const COMPANY_ID = '91002';

function installPreviewFetch() {
  if (typeof window === 'undefined') return;
  const w = window as Window & { __saSrmPreviewFetch?: boolean };
  if (w.__saSrmPreviewFetch) return;
  w.__saSrmPreviewFetch = true;
  try {
    localStorage.setItem('selectedCompanyId', COMPANY_ID);
    localStorage.setItem('selectedCompanyName', 'Kelpac Marine');
  } catch {
    /* ignore */
  }
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method === 'GET') {
      const body = srmPreviewJson(url);
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

export default function SrmPreviewClient({
  initialId,
  query,
  sort,
}: {
  initialId: number;
  query: CardQuery;
  sort: string;
}) {
  const id = Number.isFinite(initialId) && initialId !== 0 ? initialId : null;
  return (
    <Providers>
      <div className="sa-page min-h-screen">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#0077b6]">
          SupplierAdvisor® · sample supply book · not saved
        </p>
        <NetworkPage preview={{ companyId: 91002, id, query, sort }} />
      </div>
    </Providers>
  );
}
