'use client';

import { ApparelLoadingBlock, ApparelgraphWorkbench, useApparelgraph } from '@/components/apparel/ApparelgraphWorkbench';

export default function ApparelgraphMaterialsPage() {
  const { store, loading } = useApparelgraph();
  return (
    <ApparelgraphWorkbench title="Materials" description="Roll register with lot and PO links plus ownership (customer CMT vs factory).">
      {loading || !store ? <ApparelLoadingBlock /> : (
        <div className="rounded-2xl border border-cyan-200 bg-white p-4 text-sm space-y-2">
          {store.rolls.map((r) => (
            <div key={r.id} className="border-t first:border-t-0 pt-2 first:pt-0">
              <b>{r.roll_no}</b> · {r.material} · {r.ownership} · {r.length_m}m · lot {r.lot_number || '—'} · PO {r.po_number || '—'}
            </div>
          ))}
        </div>
      )}
    </ApparelgraphWorkbench>
  );
}
