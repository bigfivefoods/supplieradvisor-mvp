'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import GymDebitFlow from '@/components/fitness/netcash/GymDebitFlow';
import { StatementLive } from '@/components/fitness/netcash/LiveDesks';
import { FitgraphWorkbench } from '@/components/fitness/FitgraphWorkbench';

function StatementBody() {
  const memberId = useSearchParams().get('member') || '';
  return <StatementLive memberId={memberId} />;
}

export default function StatementPage() {
  return (
    <FitgraphWorkbench
      title="Statement"
      titleAccent="member"
      description="Invoices, VAT, debit results, and credit notes for one GymAdvisor® member."
    >
      <GymDebitFlow />
      <Suspense fallback={<p className="text-sm font-bold text-slate-500">Loading the statement…</p>}>
        <StatementBody />
      </Suspense>
    </FitgraphWorkbench>
  );
}
