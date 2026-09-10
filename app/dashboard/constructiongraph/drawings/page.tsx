'use client';

import {
  ConstructionEmptyHint,
  ConstructionLoadingBlock,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';

export default function ConstructiongraphDrawingsPage() {
  const { store, loading } = useConstructiongraph();
  return (
    <ConstructiongraphWorkbench
      title="Drawings"
      description="Issued-for-construction drawings and the bill of quantities keyed to the same site."
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
              store.drawings.map((row) => (
                <div key={row.id} className="text-xs py-1 border-t first:border-t-0">
                  {row.drawing_no} · {row.title} · rev {row.revision || '—'} · {row.discipline} ·{' '}
                  {row.status}
                </div>
              ))
            )}
          </div>
          <div className="rounded-2xl border border-stone-300 bg-white p-4">
            <h3 className="font-black mb-2">BOQ ({store.boq.length})</h3>
            {store.boq.length === 0 ? (
              <ConstructionEmptyHint>No BOQ lines yet.</ConstructionEmptyHint>
            ) : (
              store.boq.map((row) => (
                <div key={row.id} className="text-xs py-1 border-t first:border-t-0">
                  {row.item_no} · {row.description} · {row.qty} {row.uom} @ R{' '}
                  {Number(row.rate).toLocaleString('en-ZA')}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </ConstructiongraphWorkbench>
  );
}
