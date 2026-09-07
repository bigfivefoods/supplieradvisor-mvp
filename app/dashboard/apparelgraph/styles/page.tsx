'use client';

import { ApparelLoadingBlock, ApparelgraphWorkbench, useApparelgraph } from '@/components/apparel/ApparelgraphWorkbench';

export default function ApparelgraphStylesPage() {
  const { store, loading } = useApparelgraph();
  return (
    <ApparelgraphWorkbench title="Styles" description="Style matrix, tech packs and BOM lines share one apparel record.">
      {loading || !store ? <ApparelLoadingBlock /> : (
        <div className="grid lg:grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl border border-cyan-200 bg-white p-4">
            <h3 className="font-black mb-2">Matrix ({store.styles.matrix.length})</h3>
            {store.styles.matrix.map((row) => (
              <div key={row.id} className="text-xs py-1 border-t first:border-t-0">
                {row.style_code} · {row.colour} · {row.size} · {row.planned_qty}
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-white p-4">
            <h3 className="font-black mb-2">Tech pack ({store.styles.techPack.length})</h3>
            {store.styles.techPack.map((row) => (
              <div key={row.id} className="text-xs py-1 border-t first:border-t-0">
                {row.style_code} · {row.version} · {row.approved_at?.slice(0, 10) || 'pending'}
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-white p-4">
            <h3 className="font-black mb-2">BOM ({store.styles.bom.length})</h3>
            {store.styles.bom.map((row) => (
              <div key={row.id} className="text-xs py-1 border-t first:border-t-0">
                {row.style_code} · {row.item} · {row.consumption} {row.uom}
              </div>
            ))}
          </div>
        </div>
      )}
    </ApparelgraphWorkbench>
  );
}
