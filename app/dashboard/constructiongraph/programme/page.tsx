'use client';

import {
  ConstructionEmptyHint,
  ConstructionLoadingBlock,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';

export default function ConstructiongraphProgrammePage() {
  const { store, loading } = useConstructiongraph();
  return (
    <ConstructiongraphWorkbench
      title="Programme"
      description="Site programme activities — planned, in progress, delayed, complete."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : store.programme.length === 0 ? (
        <ConstructionEmptyHint>No programme rows yet.</ConstructionEmptyHint>
      ) : (
        <div className="rounded-2xl border border-stone-300 bg-white p-4 text-sm space-y-2">
          {store.programme.map((row) => (
            <div key={row.id} className="border-t first:border-t-0 pt-2 first:pt-0">
              <b>{row.activity}</b> · {row.status || '—'} · {row.pct_complete ?? 0}% ·{' '}
              {row.start_date || '—'} → {row.end_date || 'open'}
            </div>
          ))}
        </div>
      )}
    </ConstructiongraphWorkbench>
  );
}
