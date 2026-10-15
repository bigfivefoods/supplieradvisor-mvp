'use client';

import { useState } from 'react';
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

type IssuedLink = { id: string; kind: string; token: string; path: string };

export default function ConstructiongraphOverviewPage() {
  const { summary, loading, post, saving } = useConstructiongraph();
  const [issued, setIssued] = useState<IssuedLink[] | null>(null);

  const seed = async () => {
    const data = await post({ action: 'seed_demo' });
    const links = Array.isArray(data?.issued) ? (data.issued as IssuedLink[]) : [];
    if (links.length) setIssued(links);
    toast.success('ConstructionAdvisor® starter programme loaded');
  };

  const copyLink = async (path: string) => {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <ConstructiongraphWorkbench
      title="Command"
      description="ConstructionAdvisor® for contractors: one customer, many projects. Quote from a BOQ, run the project plan, allocate actuals, certify, and roll every project into a programme report — with a client and contractor PWA."
    >
      {loading || !summary ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-3">
            {[
              ['Clients', summary.clients, `${summary.sites} projects · ${summary.onSite} on site`],
              ['BOQ quoted', zar(summary.boqAmount), `${summary.quotesAccepted} accepted / ${summary.quotes} quotes`],
              ['Budget vs costs', zar(summary.costs), `${zar(summary.variance)} remaining vs budget`],
              ['Cash plan', zar(summary.paidBillings), `planned ${zar(summary.plannedBillings)} · due ${zar(summary.outstandingBillings)}`],
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
            Quote from the BOQ, date the work programme and progress payments, post
            actual costs, then roll project reports into the contractor programme.
            Open snags {summary.openSnags}
            {summary.overduePayments
              ? ` · ${summary.overduePayments} overdue payments`
              : ''}
            . Core Projects stays a separate hub.
          </div>
          {issued?.length ? (
            <div
              className="rounded-2xl border px-4 py-3 text-sm space-y-2"
              style={{ background: '#00b4d8', color: '#0f172a', borderColor: '#00b4d8' }}
            >
              <p className="font-black">
                This link is shown once. Copy it now; if you lose it, reissue.
              </p>
              {issued.map((link) => (
                <div key={link.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-bold uppercase text-[10px]">{link.kind}</span>
                  <code className="text-xs break-all">{link.path}</code>
                  <button
                    type="button"
                    className="rounded-lg bg-[#0f172a] px-3 py-1 text-xs font-bold text-white"
                    onClick={() => void copyLink(link.path)}
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/constructiongraph/payments"
              className="btn-primary !py-2 !px-4 text-sm"
            >
              Progress payments
            </Link>
            <Link
              href="/dashboard/constructiongraph/quotes"
              className="btn-secondary !py-2 !px-4 text-sm"
            >
              BOQ quotes
            </Link>
            <Link
              href="/dashboard/constructiongraph/reports"
              className="btn-secondary !py-2 !px-4 text-sm"
            >
              Programme reports
            </Link>
            <Link
              href="/dashboard/constructiongraph/portal"
              className="btn-secondary !py-2 !px-4 text-sm"
            >
              Client / contractor PWA
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
