'use client';

import GymDebitFlow from '@/components/fitness/netcash/GymDebitFlow';
import { ModeBanner, RunsDesk } from '@/components/fitness/netcash/Desks';
import { PreviewFrame } from '@/components/fitness/netcash/PreviewFrame';
import { sampleAudit, sampleRuns, sampleSettings } from '@/lib/fitness/netcash/fixtures';

export default function PreviewRunsPage() {
  return (
    <PreviewFrame screen="billing-runs">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">GymAdvisor®</p>
      <h1 className="text-3xl font-black tracking-tight text-[#0f172a] sm:text-4xl">Billing runs <span className="text-[#00b4d8]">preview first</span></h1>
      <p className="mt-2 mb-5 max-w-3xl text-sm text-slate-600">November moves off Sunday the 1st onto Monday the 2nd. October is already with Netcash in test mode.</p>
      <GymDebitFlow linkFor={(href) => (href.endsWith('/billing-runs') ? '/preview/fitgraph/billing-runs' : href.endsWith('/netcash') ? '/preview/fitgraph/netcash' : href.endsWith('/debit-orders') ? '/preview/fitgraph/debit-orders' : '/preview/fitgraph/collections')} />
      <ModeBanner mode={sampleSettings.mode} />
      <RunsDesk runs={sampleRuns} audit={sampleAudit} />
    </PreviewFrame>
  );
}
