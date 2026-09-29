'use client';

import {
  ConstructionEmptyHint,
  ConstructionLoadingBlock,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';
import {
  boqActualAmount,
  boqAmount,
} from '@/lib/construction/constructiongraph';

function zar(n: number) {
  return `R ${Number(n || 0).toLocaleString('en-ZA')}`;
}

export default function ConstructiongraphDrawingsPage() {
  const { store, loading } = useConstructiongraph();
  return (
    <ConstructiongraphWorkbench
      title="Drawings"
      description="Issued-for-construction drawings and the bill of quantities keyed to the same project — planned BOQ versus posted actuals."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="grid lg:grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-stone-300 bg-white p-4">
            <h3 className="font-black mb-2">Drawings ({store.drawings.length})</h3>
            {store.drawings.length === 0 ? (
              <ConstructionEmptyHint>No drawings on this book yet.</ConstructionEmptyHint>
            ) : (
              store.drawings.map((row) => {
                const site = store.sites.find((s) => s.id === row.site_id);
                return (
                  <div key={row.id} className="text-xs py-1 border-t first:border-t-0">
                    {row.drawing_no} · {row.title} · rev {row.revision || '—'} ·{' '}
                    {row.discipline} · {row.status}
                    {site ? ` · ${site.code}` : ''}
                  </div>
                );
              })
            )}
          </div>
          <div className="rounded-2xl border border-stone-300 bg-white p-4">
            <h3 className="font-black mb-2">BOQ ({store.boq.length})</h3>
            {store.boq.length === 0 ? (
              <ConstructionEmptyHint>No BOQ lines yet.</ConstructionEmptyHint>
            ) : (
              store.boq.map((row) => (
                <div key={row.id} className="text-xs py-1 border-t first:border-t-0">
                  {row.item_no} · {row.description} · {row.qty} {row.uom} @{' '}
                  {zar(row.rate)} · planned {zar(boqAmount(row))} · actual{' '}
                  {zar(boqActualAmount(row))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </ConstructiongraphWorkbench>
  );
}
