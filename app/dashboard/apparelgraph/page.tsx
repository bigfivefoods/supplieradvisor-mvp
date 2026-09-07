'use client';

import { Loader2, Shirt } from 'lucide-react';
import { toast } from 'sonner';
import {
  ApparelLoadingBlock,
  ApparelgraphWorkbench,
  useApparelgraph,
} from '@/components/apparel/ApparelgraphWorkbench';

export default function ApparelgraphOverviewPage() {
  const { summary, loading, post, saving } = useApparelgraph();

  const seed = async () => {
    await post({ action: 'seed_demo' });
    toast.success('ApparelAdvisor® starter data loaded');
  };

  return (
    <ApparelgraphWorkbench
      title="Overview"
      description="ApparelAdvisor® command view for capability, style matrix, sample gates, roll ownership, tickets, quality holds and shipping readiness."
    >
      {loading || !summary ? (
        <ApparelLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-3">
            {[
              ['Lines', summary.lines],
              ['Operators', summary.operators],
              ['Units/day', summary.unitsPerDay],
              ['QA holds', summary.qaHolds],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-cyan-200 bg-white px-4 py-3">
                <div className="text-[10px] uppercase font-black text-cyan-700">{label}</div>
                <div className="text-2xl font-black text-slate-900">{String(value)}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm text-slate-700">
            Hold gate: <span className="font-black">{summary.holdBlocked ? 'Blocked' : 'Clear'}</span> · code <span className="font-mono">{summary.holdGateCode} 409</span> · 4-point {summary.gates.fourPoint} · shade {summary.gates.shade} · gold-seal {summary.gates.goldSeal} · AQL {summary.gates.aql} · NBC expired {summary.gates.expiredNbc ? 'yes' : 'no'}.
          </div>
          <button
            type="button"
            onClick={() => void seed()}
            disabled={saving}
            className="btn-secondary !py-2 !px-4 text-sm inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shirt className="w-4 h-4" />}
            Seed ApparelAdvisor® demo
          </button>
        </div>
      )}
    </ApparelgraphWorkbench>
  );
}
