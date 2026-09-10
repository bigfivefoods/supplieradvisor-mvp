'use client';

import Link from 'next/link';
import {
  ConstructionEmptyHint,
  ConstructionLoadingBlock,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';

export default function ConstructiongraphSafetyPage() {
  const { store, loading } = useConstructiongraph();
  return (
    <ConstructiongraphWorkbench
      title="Safety"
      description="Site toolbox talks, inspections, permits and incidents. Company-wide SHEQ stays on the Core SHEQ hub."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-3 text-sm">
          {store.safety.length === 0 ? (
            <ConstructionEmptyHint>No site safety rows yet.</ConstructionEmptyHint>
          ) : (
            <div className="rounded-2xl border border-stone-300 bg-white p-4 space-y-2">
              {store.safety.map((row) => (
                <div key={row.id} className="border-t first:border-t-0 pt-2 first:pt-0">
                  <b>{row.kind}</b> · {row.title} · {row.date || '—'} · {row.status}
                </div>
              ))}
            </div>
          )}
          <div className="rounded-2xl border border-stone-300 bg-white p-4">
            Company incidents, NCR and CAPA live on Core SHEQ.
            <div className="mt-2">
              <Link href="/dashboard/sheq" className="text-amber-800 underline">
                Open SHEQ
              </Link>
            </div>
          </div>
        </div>
      )}
    </ConstructiongraphWorkbench>
  );
}
