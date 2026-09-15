'use client';

import {
  ApparelLoadingBlock,
  ApparelgraphWorkbench,
  useApparelgraph,
} from '@/components/apparel/ApparelgraphWorkbench';
import {
  rangeReport,
  styleBomCost,
  wholesaleReport,
} from '@/lib/apparel/apparelgraph';

function zar(n: number) {
  return `R ${Number(n || 0).toLocaleString('en-ZA')}`;
}

export default function ApparelgraphReportsPage() {
  const { store, loading, summary } = useApparelgraph();
  const range = store ? rangeReport(store) : [];
  const wholesale = store ? wholesaleReport(store) : null;

  return (
    <ApparelgraphWorkbench
      title="Reports"
      description="Range sell-through, WIP, landed cost and available-to-sell — one pack for the brand and the factory."
    >
      {loading || !store || !summary || !wholesale ? (
        <ApparelLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-cyan-800 bg-cyan-950 text-white p-4 grid sm:grid-cols-4 gap-3">
            {[
              ['ATS', String(wholesale.ats)],
              ['Prebooked', String(wholesale.booked)],
              ['QA holds', String(summary.qaHolds)],
              ['Late path', String(summary.latePath)],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-[10px] uppercase font-black text-cyan-200">{label}</div>
                <div className="text-xl font-black">{value}</div>
              </div>
            ))}
          </div>
          {range.map((row) => (
            <div
              key={row.season.id}
              className="rounded-2xl border border-cyan-200 bg-white p-4 text-sm"
            >
              <div className="font-black">
                {row.season.code} · {row.season.name}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {row.styleCount} styles · planned {row.planned} · sewn {row.sew} · landed{' '}
                {zar(row.cost)} · sell-through {Math.round(row.sellThrough)}%
              </div>
            </div>
          ))}
          {store.styleBook.map((style) => (
            <div key={style.id} className="rounded-2xl border border-cyan-200 bg-white p-4 text-xs">
              <b>
                {style.code} · {style.name}
              </b>{' '}
              · landed {zar(styleBomCost(store, style.code))} · {style.status}
            </div>
          ))}
        </div>
      )}
    </ApparelgraphWorkbench>
  );
}
