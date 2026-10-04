'use client';

import Link from 'next/link';
import { Shirt } from 'lucide-react';
import { toast } from 'sonner';
import {
  ApparelLoadingBlock,
  ApparelgraphWorkbench,
  useApparelgraph,
} from '@/components/apparel/ApparelgraphWorkbench';

function zar(n: number) {
  return `R ${Number(n || 0).toLocaleString('en-ZA')}`;
}

export default function ApparelgraphOverviewPage() {
  const { summary, loading, post, saving } = useApparelgraph();

  const seed = async () => {
    await post({ action: 'seed_demo' });
    toast.success('ApparelAdvisor® starter range loaded');
  };

  return (
    <ApparelgraphWorkbench
      title="Overview"
      description="ApparelAdvisor® for factories and brands: seasons, style/color/size, landed BOM, critical path, QA holds that actually stop ship, wholesale ATS, and a buyer line-sheet PWA — on the same books as suppliers, customers and finance."
    >
      {loading || !summary ? (
        <ApparelLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-3">
            {[
              ['Styles', summary.styleCount],
              ['ATS', summary.ats],
              ['Prebooks', summary.booked],
              ['QA holds', summary.qaHolds],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-cyan-200 bg-white px-4 py-3">
                <div className="text-[10px] uppercase font-black text-cyan-700">{label}</div>
                <div className="text-2xl font-black text-slate-900">{String(value)}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm text-slate-700">
            Hold gate:{' '}
            <span className="font-black">{summary.holdBlocked ? 'Blocked' : 'Clear'}</span> · 4-point{' '}
            {summary.gates.fourPoint} · shade {summary.gates.shade} · gold-seal {summary.gates.goldSeal}{' '}
            · AQL {summary.gates.aql} · late path {summary.latePath} · booked {zar(summary.booked)} vs
            ATS {summary.ats}.
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/apparelgraph/wholesale" className="btn-primary !py-2 !px-4 text-sm">
              Wholesale ATS
            </Link>
            <Link href="/dashboard/apparelgraph/costing" className="btn-secondary !py-2 !px-4 text-sm">
              Landed costing
            </Link>
            <Link href="/dashboard/apparelgraph/path" className="btn-secondary !py-2 !px-4 text-sm">
              Critical path
            </Link>
            <Link href="/dashboard/apparelgraph/portal" className="btn-secondary !py-2 !px-4 text-sm">
              Buyer PWA
            </Link>
            <button
              type="button"
              onClick={() => void seed()}
              disabled={saving}
              className="btn-secondary !py-2 !px-4 text-sm inline-flex items-center gap-2"
            >
              <Shirt className="w-4 h-4" />
              Seed ApparelAdvisor® demo
            </button>
          </div>
        </div>
      )}
    </ApparelgraphWorkbench>
  );
}
