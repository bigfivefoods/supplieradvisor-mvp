'use client';

import Link from 'next/link';
import { ApparelLoadingBlock, ApparelgraphWorkbench, useApparelgraph } from '@/components/apparel/ApparelgraphWorkbench';

export default function ApparelgraphShipPage() {
  const { summary, loading } = useApparelgraph();
  return (
    <ApparelgraphWorkbench title="Ship" description="Release readiness linked to Core lots, purchase orders and quality holds.">
      {loading || !summary ? <ApparelLoadingBlock /> : (
        <div className="rounded-2xl border border-cyan-200 bg-white p-4 text-sm space-y-2">
          <div>Linked lots: <b>{summary.linkedLots}</b></div>
          <div>Linked POs: <b>{summary.linkedPos}</b></div>
          <div>Open QA holds: <b>{summary.qaHolds}</b></div>
          <div>Release: <b>{summary.holdBlocked ? 'Blocked' : 'Ready'}</b></div>
          <div className="pt-1 text-cyan-700">
            <Link href="/dashboard/inventory/lots" className="underline">Inventory lots</Link>
            {' · '}
            <Link href="/dashboard/suppliers/po" className="underline">Supplier POs</Link>
            {' · '}
            <Link href="/dashboard/quality/inspections" className="underline">Quality holds</Link>
          </div>
        </div>
      )}
    </ApparelgraphWorkbench>
  );
}
