'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { TradeBookProvider } from '@/components/trades/TradeBook';
import { TradeDeskApp } from '@/components/trades/TradeDeskApp';
import { WorkPwa } from '@/components/trades/WorkPwa';

export default function PreviewTradeViewPage() {
  const params = useParams<{ view: string }>();
  const view = params.view || 'home';
  if (view === 'work') {
    return (
      <Suspense fallback={<p className="p-6 text-sm">Opening the work app…</p>}>
        <PreviewWork />
      </Suspense>
    );
  }
  return <TradeDeskApp base="/preview/tradegraph" view={view} />;
}

function PreviewWork() {
  const params = useSearchParams();
  const role = params.get('role') === 'technician' ? 'technician' : 'owner';
  const memberId = params.get('member') || (role === 'technician' ? 'tm_lerato' : 'tm_amina');
  return (
    <TradeBookProvider>
      <WorkPwa role={role} memberId={memberId} />
    </TradeBookProvider>
  );
}
