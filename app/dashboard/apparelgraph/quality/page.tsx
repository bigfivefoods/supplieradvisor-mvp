'use client';

import Link from 'next/link';
import { ApparelLoadingBlock, ApparelgraphWorkbench, useApparelgraph } from '@/components/apparel/ApparelgraphWorkbench';

export default function ApparelgraphQualityPage() {
  const { store, summary, loading } = useApparelgraph();
  return (
    <ApparelgraphWorkbench title="Quality" description="4-point, shade, gold-seal, AQL and NBC expiry gates with QA hold handoff.">
      {loading || !store || !summary ? <ApparelLoadingBlock /> : (
        <div className="space-y-3 text-sm">
          <div className="rounded-2xl border border-cyan-200 bg-white p-4">
            Gate status: 4-point {summary.gates.fourPoint} · shade {summary.gates.shade} · gold-seal {summary.gates.goldSeal} · AQL {summary.gates.aql} · NBC expired {summary.gates.expiredNbc ? 'yes' : 'no'}.
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-white p-4">
            Hold path: use <b>{summary.holdGateCode}</b> with HTTP 409 through Quality holds.
            <div className="mt-2">
              <Link href="/dashboard/quality/inspections" className="text-cyan-700 underline">Open Quality holds</Link>
            </div>
          </div>
        </div>
      )}
    </ApparelgraphWorkbench>
  );
}
