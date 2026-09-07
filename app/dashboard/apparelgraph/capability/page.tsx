'use client';

import { ApparelLoadingBlock, ApparelgraphWorkbench, useApparelgraph } from '@/components/apparel/ApparelgraphWorkbench';

export default function ApparelgraphCapabilityPage() {
  const { store, loading } = useApparelgraph();
  return (
    <ApparelgraphWorkbench title="Capability" description="Line capacity, operator coverage and lead-time commitments.">
      {loading || !store ? <ApparelLoadingBlock /> : (
        <div className="rounded-2xl border border-cyan-200 bg-white p-4 text-sm space-y-2">
          <div><b>Lines:</b> {store.capability.lines}</div>
          <div><b>Operators:</b> {store.capability.operators}</div>
          <div><b>Units per day:</b> {store.capability.units_per_day}</div>
          <div><b>Lead days:</b> {store.capability.lead_days}</div>
          <div><b>CMT only:</b> {store.capability.cmt_only ? 'Yes' : 'No'}</div>
          <div><b>Notes:</b> {store.capability.notes || '—'}</div>
        </div>
      )}
    </ApparelgraphWorkbench>
  );
}
