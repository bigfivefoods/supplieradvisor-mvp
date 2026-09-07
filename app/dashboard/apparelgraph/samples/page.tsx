'use client';

import { ApparelLoadingBlock, ApparelgraphWorkbench, useApparelgraph } from '@/components/apparel/ApparelgraphWorkbench';

export default function ApparelgraphSamplesPage() {
  const { store, loading } = useApparelgraph();
  return (
    <ApparelgraphWorkbench title="Samples" description="Proto, fit, PP and shipment sample states for each style.">
      {loading || !store ? <ApparelLoadingBlock /> : (
        <div className="rounded-2xl border border-cyan-200 bg-white p-4 text-sm space-y-2">
          {store.samples.map((s) => (
            <div key={s.id} className="border-t first:border-t-0 pt-2 first:pt-0">
              <b>{s.style_code}</b> · {s.stage} · {s.status} · due {s.due_date || '—'}
            </div>
          ))}
        </div>
      )}
    </ApparelgraphWorkbench>
  );
}
