'use client';

import { ApparelLoadingBlock, ApparelgraphWorkbench, useApparelgraph } from '@/components/apparel/ApparelgraphWorkbench';

export default function ApparelgraphFloorPage() {
  const { store, loading } = useApparelgraph();
  return (
    <ApparelgraphWorkbench title="Floor" description="Cut/sew ticket flow by style and quantity on the production floor.">
      {loading || !store ? <ApparelLoadingBlock /> : (
        <div className="rounded-2xl border border-cyan-200 bg-white p-4 text-sm space-y-2">
          {store.tickets.map((t) => (
            <div key={t.id} className="border-t first:border-t-0 pt-2 first:pt-0">
              <b>{t.ticket_no}</b> · {t.style_code} · {t.units} units · shade {t.shade || '—'}
            </div>
          ))}
        </div>
      )}
    </ApparelgraphWorkbench>
  );
}
