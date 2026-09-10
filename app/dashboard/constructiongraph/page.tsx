'use client';

import Link from 'next/link';
import { Hammer } from 'lucide-react';
import { toast } from 'sonner';
import {
  ConstructionLoadingBlock,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';

function zar(n: number) {
  return `R ${Number(n || 0).toLocaleString('en-ZA')}`;
}

export default function ConstructiongraphOverviewPage() {
  const { summary, loading, post, saving } = useConstructiongraph();

  const seed = async () => {
    await post({ action: 'seed_demo' });
    toast.success('ConstructionAdvisor® starter site loaded');
  };

  return (
    <ConstructiongraphWorkbench
      title="Command"
      description="ConstructionAdvisor® for building contractors: sites, drawings and BOQ, subcontractors, materials and plant, programme, site safety, variations, payment certificates, and snag / handover."
    >
      {loading || !summary ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-3">
            {[
              ['Sites', summary.sites, `${summary.onSite} on site`],
              ['Contract value', zar(summary.contractValue), `${summary.boqLines} BOQ lines`],
              ['Certified', zar(summary.certified), `${summary.certificateCount} certificates`],
              ['Open snags', summary.openSnags, `${zar(summary.variations)} in VOs`],
            ].map(([label, value, sub]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-stone-300 bg-white px-4 py-3"
              >
                <div className="text-[10px] uppercase font-black text-amber-800">
                  {label}
                </div>
                <div className="text-2xl font-black text-slate-900">{String(value)}</div>
                <div className="text-xs text-stone-500 mt-1">{sub}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-700">
            Drawings {summary.drawings} · subcontractors {summary.subcontractors} · materials{' '}
            {summary.materials} · plant {summary.plant} · programme rows {summary.programmeRows} ·
            open safety {summary.safetyOpen}. Core Projects stays a separate hub — this OS is the
            building site book.
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/constructiongraph/sites"
              className="btn-primary !py-2 !px-4 text-sm"
            >
              Open sites
            </Link>
            <button
              type="button"
              onClick={() => void seed()}
              disabled={saving}
              className="btn-secondary !py-2 !px-4 text-sm inline-flex items-center gap-2"
            >
              <Hammer className="w-4 h-4" />
              Seed ConstructionAdvisor® demo
            </button>
          </div>
        </div>
      )}
    </ConstructiongraphWorkbench>
  );
}
