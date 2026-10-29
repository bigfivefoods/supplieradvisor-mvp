'use client';

import GymDebitFlow from '@/components/fitness/netcash/GymDebitFlow';
import { PreviewFrame } from '@/components/fitness/netcash/PreviewFrame';
import { CollectionsDesk } from '@/components/fitness/netcash/Desks';
import { SAMPLE_GYM, sampleHolds, sampleLines, sampleOverview, sampleSettings } from '@/lib/fitness/netcash/fixtures';

export default function PreviewCollectionsPage() {
  return (
    <PreviewFrame screen="collections">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">GymAdvisor®</p>
      <h1 className="text-3xl font-black tracking-tight text-[#0f172a] sm:text-4xl">Collections <span className="text-[#00b4d8]">debit orders</span></h1>
      <p className="mt-2 mb-5 max-w-3xl text-sm text-slate-600">{SAMPLE_GYM} on SupplierAdvisor®. Expected against collected, unpaid reasons, and the next run.</p>
      <GymDebitFlow linkFor={previewHref} />
      <CollectionsDesk
        overview={sampleOverview}
        lines={sampleLines}
        holds={sampleHolds}
        mode={sampleSettings.mode}
        statementHref={(memberId) => `/preview/fitgraph/statement?member=${encodeURIComponent(memberId)}`}
      />
    </PreviewFrame>
  );
}

function previewHref(href: string): string {
  if (href.endsWith('/netcash')) return '/preview/fitgraph/netcash';
  if (href.endsWith('/debit-orders')) return '/preview/fitgraph/debit-orders';
  if (href.endsWith('/billing-runs')) return '/preview/fitgraph/billing-runs';
  return '/preview/fitgraph/collections';
}
